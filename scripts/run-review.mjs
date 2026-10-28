#!/usr/bin/env node
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { finished } from 'node:stream/promises';

const execute = promisify(execFile);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TERMINAL = new Set(['completed', 'failed', 'killed']);
const PUBLICATION_SUCCESS = { local: 'not_requested', 'dry-run': 'rendered', github: 'confirmed' };

export const usage = `Usage: node scripts/run-review.mjs --repository PATH --base REF --output PATH [options]

  --head REF                 Reviewed revision; must match checkout HEAD (default HEAD)
  --target TEXT              Human-readable review target
  --publication MODE         local (default), dry-run, or github
  --github OWNER/REPO#NUMBER  Required for dry-run or github publication
  --profile PATH             Source Pi profile (default PI_CODING_AGENT_DIR or ~/.pi/agent)
  --plugin-root PATH         Installed @tintinweb/pi-subagents (or PI_REVIEW_PLUGIN_ROOT)
  --pi PATH                  Pi executable (default pi on PATH)
  --timeout SECONDS          Maximum workflow duration (default 1800)
  --context-file PATH        Additional read-only context; repeatable
  --wrapper-skill-root PATH  Additional review wrapper root; repeatable
  --help                     Show this help

The output directory must be empty and outside the reviewed checkout. This command
uses a private temporary Pi profile and does not modify the selected profile.
`;

/**
 * Parse explicit review inputs without enabling publication implicitly.
 */
export function parseArguments(argv, env = process.env) {
  const options = {
    head: 'HEAD', publication: 'local', profile: env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent'),
    pluginRoot: env.PI_REVIEW_PLUGIN_ROOT, pi: env.PI_REVIEW_PI ?? 'pi', timeoutMs: 30 * 60 * 1000,
    contextFiles: [], wrapperSkillRoots: [],
  };
  const fields = new Map([
    ['repository', 'repository'], ['base', 'base'], ['head', 'head'], ['target', 'target'],
    ['output', 'output'], ['profile', 'profile'], ['plugin-root', 'pluginRoot'], ['pi', 'pi'],
    ['publication', 'publication'], ['github', 'github'],
  ]);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') return { help: true };
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const equal = token.indexOf('=');
    const key = token.slice(2, equal === -1 ? undefined : equal);
    const value = equal === -1 ? argv[++i] : token.slice(equal + 1);
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    if (fields.has(key)) options[fields.get(key)] = value;
    else if (key === 'context-file') options.contextFiles.push(value);
    else if (key === 'wrapper-skill-root') options.wrapperSkillRoots.push(value);
    else if (key === 'timeout') {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 43_200) throw new Error('--timeout must be between 0 and 43200 seconds');
      options.timeoutMs = seconds * 1000;
    } else throw new Error(`Unknown option: --${key}`);
  }
  for (const field of ['repository', 'base', 'output']) {
    if (!options[field]) throw new Error(`Missing --${field}`);
  }
  if (!Object.hasOwn(PUBLICATION_SUCCESS, options.publication)) throw new Error('Publication must be local, dry-run, or github');
  if (options.publication !== 'local' && !options.github) throw new Error('--github is required for remote publication modes');
  if (options.github && !/^[\w.-]+\/[\w.-]+#[1-9]\d*$/.test(options.github)) throw new Error('--github must be OWNER/REPO#NUMBER');
  return options;
}

async function git(repository, ...args) {
  const { stdout } = await execute('git', ['-C', repository, ...args], { maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

/**
 * Resolve symlinks in existing ancestors before checking output containment.
 */
async function canonicalPath(location) {
  const resolved = path.resolve(location);
  try { return await realpath(resolved); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = path.dirname(resolved);
    if (parent === resolved) throw error;
    return path.join(await canonicalPath(parent), path.basename(resolved));
  }
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function assertCheckout(repository, head) {
  if (await git(repository, 'rev-parse', 'HEAD') !== head) throw new Error('Checkout HEAD differs from the reviewed head');
  if (await git(repository, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('Reviewed checkout must be clean');
}

/**
 * Pin the full comparison and reject stale or unsafe output locations.
 */
export async function resolveReviewInputs(options, packageRoot = PACKAGE_ROOT) {
  const repository = await realpath(path.resolve(options.repository));
  const top = await realpath(await git(repository, 'rev-parse', '--show-toplevel'));
  if (top !== repository) throw new Error('--repository must name the checkout root');
  const base = await git(repository, 'rev-parse', '--verify', '--end-of-options', `${options.base}^{commit}`);
  const head = await git(repository, 'rev-parse', '--verify', '--end-of-options', `${options.head ?? 'HEAD'}^{commit}`);
  await assertCheckout(repository, head);
  const artifacts = await canonicalPath(options.output);
  if (within(repository, artifacts)) throw new Error('Output must be outside the reviewed checkout');
  const packagePath = await realpath(packageRoot);
  if (within(packagePath, artifacts)) throw new Error('Output must be outside the workflow package');
  const publication = { mode: options.publication ?? 'local' };
  if (options.github) {
    const match = /^([\w.-]+\/[\w.-]+)#([1-9]\d*)$/.exec(options.github);
    if (!match) throw new Error('--github must be OWNER/REPO#NUMBER');
    publication.repository = match[1];
    publication.prNumber = Number(match[2]);
    if (!Number.isSafeInteger(publication.prNumber)) throw new Error('PR number is too large');
  }
  if (!Object.hasOwn(PUBLICATION_SUCCESS, publication.mode)) throw new Error('Unknown publication mode');
  if (publication.mode !== 'local' && !publication.repository) throw new Error('--github is required for remote publication modes');
  return {
    workflowEnabled: true, packageRoot: packagePath, repository, base, head,
    target: options.target ?? (options.github ? `https://github.com/${publication.repository}/pull/${publication.prNumber}` : `${path.basename(repository)} ${base.slice(0, 12)}…${head.slice(0, 12)}`),
    artifacts, runId: `review_${randomUUID()}`, invocationId: randomUUID(),
    wrapperSkillRoots: await Promise.all((options.wrapperSkillRoots ?? []).map(root => realpath(path.resolve(root)))),
    contextFiles: await Promise.all((options.contextFiles ?? []).map(file => realpath(path.resolve(file)))),
    notification: null, publication,
  };
}

/**
 * Copy only model configuration and credentials; never load source-profile plugins.
 */
export async function createPrivateProfile(source, packageRoot, pluginRoot) {
  const settings = JSON.parse(await readFile(path.join(source, 'settings.json'), 'utf8'));
  for (const field of ['defaultProvider', 'defaultModel']) {
    if (typeof settings[field] !== 'string' || !settings[field]) throw new Error(`Selected profile must configure ${field}`);
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pi-review-profile-'));
  await chmod(directory, 0o700);
  try {
    const selected = { defaultProvider: settings.defaultProvider, defaultModel: settings.defaultModel };
    if (settings.defaultThinkingLevel !== undefined) selected.defaultThinkingLevel = settings.defaultThinkingLevel;
    await writeFile(path.join(directory, 'settings.json'), JSON.stringify({ ...selected, packages: [packageRoot, pluginRoot], quietStartup: true }), { mode: 0o600 });
    await writeFile(path.join(directory, 'subagents.json'), JSON.stringify({ workflowsEnabled: true, fallbackSubagent: 'none', strictAgentFiles: true, rememberAgents: true }), { mode: 0o600 });
    for (const name of ['auth.json', 'models.json', 'models-store.json']) {
      try {
        await copyFile(path.join(source, name), path.join(directory, name));
        await chmod(path.join(directory, name), 0o600);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function resolvePluginRoot(explicit, packageRoot) {
  const location = explicit ?? path.join(packageRoot, 'node_modules/@tintinweb/pi-subagents');
  let root;
  try { root = await realpath(location); }
  catch { throw new Error('Install the pinned pi-subagents development dependency or pass --plugin-root'); }
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (manifest.name !== '@tintinweb/pi-subagents' || manifest.version !== '0.22.0') throw new Error('The launcher requires @tintinweb/pi-subagents 0.22.0');
  return root;
}

export function bootstrapSource(inputs) {
  return `export const meta = { name: "review-launcher", description: "Run the packaged review workflow" };\nreturn await workflow("review", ${JSON.stringify(inputs)});\n`;
}

/**
 * Custom entries are persisted only after a conversation exists in Pi 1.4.
 */
async function seedSession(file, cwd) {
  const timestamp = new Date().toISOString();
  const entries = [
    { type: 'session', version: 3, id: randomUUID(), timestamp, cwd },
    { type: 'message', id: randomUUID().slice(0, 8), parentId: null, timestamp,
      message: { role: 'user', content: [{ type: 'text', text: 'The saved review workflow runs at startup. No parent model turn is needed.' }], timestamp: Date.now() } },
  ];
  await writeFile(file, entries.map(entry => JSON.stringify(entry)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
}

/**
 * Wait for persisted workflow completion rather than a successful process exit.
 */
export async function waitForWorkflowEntry(sessionFile, child, { timeoutMs, signal, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (signal?.aborted) throw new Error('Review cancelled');
    let content = '';
    try { content = await readFile(sessionFile, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const lines = content.split('\n');
    lines.pop();
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === 'custom' && entry.customType === 'subagents:workflow' && entry.data?.name === 'review-launcher' && TERMINAL.has(entry.data.status)) return entry.data;
    }
    if (child.spawnError) throw new Error('Could not start Pi; check the configured executable');
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Pi exited before a terminal workflow entry was saved (exit=${child.exitCode}, signal=${child.signalCode})`);
    if (Date.now() >= deadline) throw new Error('Review workflow timed out');
    await delay(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
  }
}

async function stopChild(child) {
  if (!child?.pid) return;
  const send = signal => {
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const closed = new Promise(resolve => child.once('close', resolve));
  send('SIGTERM');
  for (let i = 0; i < 20 && child.exitCode === null && child.signalCode === null; i++) await delay(50);
  send('SIGKILL');
  child.stdin.destroy();
  await Promise.race([closed, delay(1000)]);
}

/**
 * Recheck persisted identities and execute the package validator without a shell.
 */
export async function validateReviewResult(inputs, { python = 'python3', env = process.env, signal } = {}) {
  const result = JSON.parse(await readFile(path.join(inputs.artifacts, 'result.json'), 'utf8'));
  for (const key of ['runId', 'invocationId', 'base', 'head']) {
    if (result[key] !== inputs[key]) throw new Error(`Saved result has a mismatched ${key}`);
  }
  if (!['complete', 'split', 'incomplete'].includes(result.status)) throw new Error('Saved result has an unknown status');
  if (typeof result.fingerprint !== 'string' || !/^(?:[a-f0-9]{16}|[a-f0-9]{64})$/.test(result.fingerprint)) throw new Error('Saved result has no valid fingerprint');
  const bundlePath = path.join(inputs.artifacts, 'bundle.json');
  if (result.bundlePath !== bundlePath || await realpath(bundlePath) !== bundlePath) throw new Error('Saved result names an unexpected bundle');
  if (result.status === 'incomplete') {
    if (result.reportPath !== null) throw new Error('Incomplete result must not claim a canonical report');
  } else {
    const report = await realpath(result.reportPath);
    if (!within(inputs.artifacts, report)) throw new Error('Saved report is outside the output directory');
  }
  const validator = path.join(inputs.packageRoot, 'scripts/review/validate_bundle.py');
  try {
    const { stdout, stderr } = await execute(python, [validator, bundlePath, '--fingerprint', result.fingerprint], { env, signal, maxBuffer: 1024 * 1024, timeout: 30_000 });
    await writeFile(path.join(inputs.artifacts, 'validation.stdout.log'), stdout, { mode: 0o600 });
    await writeFile(path.join(inputs.artifacts, 'validation.stderr.log'), stderr, { mode: 0o600 });
  } catch (error) {
    await writeFile(path.join(inputs.artifacts, 'validation.stdout.log'), error.stdout ?? '', { mode: 0o600 });
    await writeFile(path.join(inputs.artifacts, 'validation.stderr.log'), error.stderr ?? 'Validator failed', { mode: 0o600 });
    throw new Error('Saved review bundle failed fresh validation; see validation.stderr.log');
  }
  if (result.status === 'incomplete') throw new Error(`Review is incomplete; inspect ${inputs.artifacts}`);
  if (result.publication?.mode !== inputs.publication.mode || result.publication.status !== PUBLICATION_SUCCESS[inputs.publication.mode]) throw new Error('Required publication is not confirmed');
  return result;
}

/**
 * Launch one explicitly requested review using a disposable Pi profile.
 */
export async function runReview(options, { packageRoot = PACKAGE_ROOT, env = process.env, signal, python = 'python3' } = {}) {
  const inputs = await resolveReviewInputs(options, packageRoot);
  const pluginRoot = await resolvePluginRoot(options.pluginRoot ?? env.PI_REVIEW_PLUGIN_ROOT, inputs.packageRoot);
  await mkdir(inputs.artifacts, { recursive: true, mode: 0o700 });
  if ((await readdir(inputs.artifacts)).length) throw new Error('Output directory must be empty');
  const runnerDirectory = path.join(inputs.artifacts, '.runner');
  const workspace = path.join(runnerDirectory, 'workspace');
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const bootstrap = path.join(runnerDirectory, 'start-review.js');
  await writeFile(bootstrap, bootstrapSource(inputs), { mode: 0o600 });
  await writeFile(path.join(runnerDirectory, 'inputs.json'), JSON.stringify(inputs, null, 2) + '\n', { mode: 0o600 });
  const sessionFile = path.join(inputs.artifacts, 'session.jsonl');
  await seedSession(sessionFile, workspace);
  const profile = await createPrivateProfile(path.resolve(options.profile ?? env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent')), inputs.packageRoot, pluginRoot);
  let child;
  const streams = [];
  try {
    const argv = ['--mode', 'rpc', '--session', sessionFile, '--no-context-files', '--no-mcp', '--offline', '--no-approve', '--no-prompt-templates', '--no-themes', `--subagents-workflow-file=${bootstrap}`];
    child = spawn(options.pi ?? env.PI_REVIEW_PI ?? 'pi', argv, {
      cwd: workspace, env: { ...env, PI_CODING_AGENT_DIR: profile, PI_OFFLINE: '1', PI_TELEMETRY: '0' },
      detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.on('error', error => { child.spawnError = error; });
    for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
      const log = createWriteStream(path.join(inputs.artifacts, `pi.${name}.log`), { flags: 'wx', mode: 0o600 });
      log.on('error', error => { child.spawnError = error; });
      stream.pipe(log);
      streams.push(log);
    }
    const completion = await waitForWorkflowEntry(sessionFile, child, { timeoutMs: options.timeoutMs ?? 30 * 60 * 1000, signal });
    if (completion.status !== 'completed') throw new Error(`Pi workflow ${completion.status}; inspect ${inputs.artifacts}`);
    await stopChild(child);
    child = undefined;
    await assertCheckout(inputs.repository, inputs.head);
    if (signal?.aborted) throw new Error('Review cancelled');
    const result = await validateReviewResult(inputs, { python, env, signal });
    await assertCheckout(inputs.repository, inputs.head);
    return result;
  } finally {
    try {
      await stopChild(child);
      for (const stream of streams) {
        if (!stream.writableEnded) stream.end();
        await finished(stream).catch(() => {});
      }
    } finally {
      try {
        await cp(path.join(profile, 'sessions'), path.join(inputs.artifacts, 'subagent-sessions'), { recursive: true, errorOnExist: true, force: false });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      } finally {
        await rm(profile, { recursive: true, force: true });
      }
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(usage); return; }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  try {
    const result = await runReview(options, { signal: controller.signal });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`Review failed: ${error.message}\n`); process.exitCode = 1; });
}
