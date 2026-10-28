import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { parseArguments, resolveReviewInputs, runReview } from '../scripts/run-review.mjs';

const execute = promisify(execFile);
const secret = 'private-auth-sentinel-' + randomUUID();
const fakePiSource = `#!/usr/bin/env node
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const session = args[args.indexOf('--session') + 1];
const flag = args.find(value => value.startsWith('--subagents-workflow-file='));
const source = readFileSync(flag.slice(flag.indexOf('=') + 1), 'utf8');
const input = JSON.parse(/return await workflow\\("review", (.*)\\);/.exec(source)[1]);
const profile = process.env.PI_CODING_AGENT_DIR;
const settings = JSON.parse(readFileSync(path.join(profile, 'settings.json'), 'utf8'));
const packageManifest = JSON.parse(readFileSync(path.join(input.packageRoot, 'package.json'), 'utf8'));
const workflowPath = path.join(input.packageRoot, packageManifest.pi.subagents.workflows[0], 'review.js');
if (!readFileSync(workflowPath, 'utf8').includes('name: "review"')) process.exit(18);
if (!readFileSync(session, 'utf8').includes('"role":"user"')) process.exit(19);
writeFileSync(path.join(input.artifacts, 'capture.json'), JSON.stringify({ args, input, profile, settings, authMode: statSync(path.join(profile, 'auth.json')).mode & 0o777 }));
process.stdin.resume();
process.stdin.on('end', () => process.exit(20));
const scenario = process.env.PI_REVIEW_TEST_SCENARIO;
if (scenario === 'exit-zero') process.exit(0);
if (scenario === 'timeout' || scenario === 'cancel') {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  writeFileSync(path.join(input.artifacts, 'grandchild.pid'), String(child.pid));
} else {
  setTimeout(() => {
    if (scenario !== 'terminal-failed') {
      const fingerprint = 'a'.repeat(64);
      const bundle = { fingerprint, valid: scenario !== 'invalid-bundle' };
      writeFileSync(path.join(input.artifacts, 'bundle.json'), JSON.stringify(bundle));
      writeFileSync(path.join(input.artifacts, 'review-report.md'), '# Review\\n');
      const status = scenario === 'incomplete' ? 'incomplete' : 'complete';
      const publication = { mode: input.publication.mode, status: { local: 'not_requested', 'dry-run': 'rendered', github: 'confirmed' }[input.publication.mode] };
      if (scenario === 'unconfirmed') publication.status = 'pending';
      const result = { status, runId: input.runId, invocationId: input.invocationId, base: input.base, head: input.head, bundlePath: path.join(input.artifacts, 'bundle.json'), reportPath: status === 'incomplete' ? null : path.join(input.artifacts, 'review-report.md'), fingerprint, publication };
      if (scenario === 'stale-result') result.invocationId = 'another-run';
      writeFileSync(path.join(input.artifacts, 'result.json'), JSON.stringify(result));
    }
    appendFileSync(session, JSON.stringify({ type: 'custom', customType: 'subagents:workflow', data: { name: 'review-launcher', status: scenario === 'terminal-failed' ? 'failed' : 'completed' } }) + '\\n');
  }, 120);
}
setInterval(() => {}, 1000);
`;

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'review-launcher-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = path.join(directory, 'repository');
  const packageRoot = path.join(directory, 'package');
  const pluginRoot = path.join(directory, 'plugin');
  const profile = path.join(directory, 'profile');
  await Promise.all([repository, pluginRoot, profile, path.join(packageRoot, 'scripts/review'), path.join(packageRoot, 'workflows')].map(location => mkdir(location, { recursive: true })));
  await writeFile(path.join(repository, 'sum.mjs'), 'export const sum = values => values.reduce((a, b) => a + b, 0);\n');
  await execute('git', ['init', '--quiet', repository]);
  await execute('git', ['-C', repository, 'add', '.']);
  await execute('git', ['-C', repository, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'feat: add fixture']);
  const { stdout } = await execute('git', ['-C', repository, 'rev-parse', 'HEAD']);
  const head = stdout.trim();
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'fixture-review-package', pi: { subagents: { workflows: ['./workflows'] } } }));
  await writeFile(path.join(packageRoot, 'workflows/review.js'), 'export const meta = { name: "review", description: "fixture" };\nreturn {};\n');
  await writeFile(path.join(packageRoot, 'scripts/review/validate_bundle.py'), `import json, pathlib, sys\nbundle = pathlib.Path(sys.argv[1])\ndata = json.loads(bundle.read_text())\n(bundle.parent / "validator-called").write_text("yes")\nassert sys.argv[2] == "--fingerprint"\nassert data["fingerprint"] == sys.argv[3]\nassert data["valid"]\n`);
  await writeFile(path.join(pluginRoot, 'package.json'), JSON.stringify({ name: '@tintinweb/pi-subagents', version: '0.22.0' }));
  const sourceSettings = JSON.stringify({ defaultProvider: 'fixture-provider', defaultModel: 'inherited-model', defaultThinkingLevel: 'high', packages: ['must-not-load'], extensions: ['/must-not-load.js'] });
  await writeFile(path.join(profile, 'settings.json'), sourceSettings);
  await writeFile(path.join(profile, 'auth.json'), JSON.stringify({ fixture: { key: secret } }), { mode: 0o600 });
  const pi = path.join(directory, 'fake-pi.mjs');
  await writeFile(pi, fakePiSource, { mode: 0o700 });
  const options = { repository, base: head, head, output: path.join(directory, 'output'), profile, pluginRoot, pi, publication: 'local', timeoutMs: 3000 };
  return { directory, repository, packageRoot, profile, options, sourceSettings };
}

async function runFixture(context, scenario = 'success', extra = {}) {
  return runReview({ ...context.options, ...extra }, { packageRoot: context.packageRoot, env: { ...process.env, PI_REVIEW_TEST_SCENARIO: scenario } });
}

async function assertProcessStopped(pid) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const status = await readFile(`/proc/${pid}/stat`, 'utf8');
      if (/^\d+ \(.+\) [ZX] /.test(status)) return;
    } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(`Process ${pid} remained active after cleanup`);
}

test('parses inherited profile and requires explicit remote publication target', () => {
  const options = parseArguments(['--repository', '/repo', '--base', 'main', '--output', '/output'], { PI_CODING_AGENT_DIR: '/selected' });
  assert.equal(options.profile, '/selected');
  assert.equal(options.publication, 'local');
  assert.equal(options.timeoutMs, 1800000);
  assert.throws(() => parseArguments(['--repository', '/repo', '--base', 'main', '--output', '/output', '--publication', 'github']), /--github is required/);
  assert.throws(() => parseArguments(['--repository', '/repo', '--base', 'main', '--output', '/output', '--timeout', 'NaN']), /timeout/);
});

test('pins refs and rejects dirty checkouts and output symlinked into source', async t => {
  const context = await fixture(t);
  const inputs = await resolveReviewInputs(context.options, context.packageRoot);
  assert.equal(inputs.base, context.options.head);
  assert.equal(inputs.head, context.options.head);
  await symlink(context.repository, path.join(context.directory, 'source-link'));
  await assert.rejects(resolveReviewInputs({ ...context.options, output: path.join(context.directory, 'source-link/artifacts') }, context.packageRoot), /outside/);
  await writeFile(path.join(context.repository, 'untracked'), 'new file');
  await assert.rejects(resolveReviewInputs(context.options, context.packageRoot), /clean/);
});

test('waits for workflow entry, inherits model, validates bundle and cleans private credentials', async t => {
  const context = await fixture(t);
  const result = await runFixture(context);
  assert.equal(result.status, 'complete');
  const capture = JSON.parse(await readFile(path.join(context.options.output, 'capture.json'), 'utf8'));
  assert.ok(capture.args.includes('--mode'));
  assert.ok(capture.args.includes('rpc'));
  assert.ok(!capture.args.includes('--print'));
  assert.ok(!capture.args.includes('--model'));
  assert.equal(capture.settings.defaultProvider, 'fixture-provider');
  assert.equal(capture.settings.defaultModel, 'inherited-model');
  assert.equal(capture.settings.defaultThinkingLevel, 'high');
  assert.deepEqual(capture.settings.packages, [context.packageRoot, context.options.pluginRoot]);
  assert.equal(capture.authMode, 0o600);
  assert.equal(capture.input.notification, null);
  assert.ok(await readFile(path.join(context.options.output, 'validator-called'), 'utf8'));
  await assert.rejects(stat(capture.profile), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(context.profile, 'settings.json'), 'utf8'), context.sourceSettings);
  for (const name of await readdir(context.options.output)) {
    if (name.endsWith('.log') || name === 'capture.json') assert.ok(!(await readFile(path.join(context.options.output, name), 'utf8')).includes(secret), 'Credentials leaked to output');
  }
});

for (const [scenario, expected] of [
  ['exit-zero', /before a terminal/], ['terminal-failed', /workflow failed/],
  ['stale-result', /mismatched invocationId/], ['invalid-bundle', /fresh validation/],
  ['incomplete', /incomplete/], ['unconfirmed', /not confirmed/],
]) {
  test(`rejects ${scenario} instead of reporting success`, async t => {
    const context = await fixture(t);
    await assert.rejects(runFixture(context, scenario), expected);
  });
}

for (const publication of ['dry-run', 'github']) {
  test(`requires ${publication} publication receipt matching the selected mode`, async t => {
    const context = await fixture(t);
    const result = await runFixture(context, 'success', { publication, github: 'example/app#123' });
    assert.equal(result.publication.mode, publication);
    assert.equal(result.publication.status, publication === 'github' ? 'confirmed' : 'rendered');
  });
}

test('timeout stops Pi and its child process', { skip: process.platform !== 'linux' }, async t => {
  const context = await fixture(t);
  await assert.rejects(runFixture(context, 'timeout', { timeoutMs: 350 }), /timed out/);
  const pid = Number(await readFile(path.join(context.options.output, 'grandchild.pid'), 'utf8'));
  await assertProcessStopped(pid);
});

test('cancellation stops Pi and its child process', { skip: process.platform !== 'linux' }, async t => {
  const context = await fixture(t);
  const controller = new AbortController();
  const running = runReview(context.options, { packageRoot: context.packageRoot, env: { ...process.env, PI_REVIEW_TEST_SCENARIO: 'cancel' }, signal: controller.signal });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await stat(path.join(context.options.output, 'grandchild.pid')); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  controller.abort();
  await assert.rejects(running, /cancelled/);
  const pid = Number(await readFile(path.join(context.options.output, 'grandchild.pid'), 'utf8'));
  await assertProcessStopped(pid);
});
