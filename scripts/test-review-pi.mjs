#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseArguments, runReview } from './run-review.mjs';

const execute = promisify(execFile);

async function git(repository, ...args) {
  const { stdout } = await execute('git', ['-C', repository, '-c', 'user.name=Review fixture', '-c', 'user.email=review-fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args]);
  return stdout.trim();
}

/**
 * Run a real inherited-model review against a self-contained arithmetic defect.
 */
export async function testReviewWithPi(argv = []) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'review-pi-fixture-'));
  const repository = path.join(directory, 'repository');
  await mkdir(repository);
  await git(repository, 'init', '--quiet');
  const file = path.join(repository, 'sum.mjs');
  await writeFile(file, 'export function sum(values) {\n  return values.reduce((total, value) => total + value, 0);\n}\n');
  await git(repository, 'add', 'sum.mjs');
  await git(repository, 'commit', '--quiet', '-m', 'feat: add arithmetic total');
  const base = await git(repository, 'rev-parse', 'HEAD');
  await writeFile(file, 'export function sum(values) {\n  return values.reduce((total, value) => total + value, 1);\n}\n');
  await git(repository, 'add', 'sum.mjs');
  await git(repository, 'commit', '--quiet', '-m', 'refactor: adjust accumulator');
  const head = await git(repository, 'rev-parse', 'HEAD');
  const context = path.join(directory, 'requirements.md');
  await writeFile(context, `# Arithmetic utility review context\n\nThe sum API returns the arithmetic total of all supplied numbers. An empty array returns 0. For example, sum([2, 3]) returns 5 and sum([-2, 2]) returns 0.\n\nThis is a self-contained local fixture. These supplied requirements are the authoritative product context. There are no remote PRs, review threads, related changes, CI runs or organisational decisions. Do not contact GitHub, Slack, Notion, Linear, search engines or other external sources. Record source and CI limits honestly. Do not execute local project tests, install dependencies, start services, publish anything or send notifications. Perform the normal complete review using source evidence.\n`);
  const options = parseArguments(['--repository', repository, '--base', base, '--head', head, '--output', path.join(directory, 'review'), '--target', 'Local arithmetic utility fixture', ...argv]);
  if (options.help) throw new Error('Use scripts/run-review.mjs --help for launcher options');
  if (options.publication !== 'local' || options.github) throw new Error('The real-Pi fixture only permits local publication');
  options.contextFiles.push(context);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  try {
    const result = await runReview(options, { signal: controller.signal });
    assert.equal(result.status, 'complete', 'The small fixture must receive a complete review');
    assert.equal(result.publication.status, 'not_requested');
    const bundle = JSON.parse(await readFile(result.bundlePath, 'utf8'));
    const expected = ['setup', 'research', 'product', 'system-fit', 'simplicity', 'readability', 'correctness', 'rules', 'consolidation', 'draft', 'editorial', 'report', 'decision'];
    for (const stage of expected) assert.ok(bundle.stages[stage], `Missing stage: ${stage}`);
    const defects = ['correctness', 'consolidation'].flatMap(stage =>
      (bundle.stages[stage].findings ?? []).map(finding => ({ stage, finding }))
    );
    const expectedDefect = defects.find(({ finding }) => {
      const text = JSON.stringify(finding).toLowerCase();
      return finding.kind === 'bug' && text.includes('sum.mjs') && /empty|initial|start|seed|off.by.one|one too|\+\s*1|\b1\b/.test(text) && /sum|total|accumulat/.test(text);
    });
    assert.ok(expectedDefect, 'Review must identify the incorrect arithmetic accumulator');
    const report = await readFile(result.reportPath, 'utf8');
    assert.match(report, /sum/i);
    assert.match(report, /empty|initial|accumulat|off.by.one|one more|\b1\b/i);
    const decisions = bundle.stages.report.decisions ?? [];
    const decision = decisions.find(item => item.sourceId === `${expectedDefect.stage}:${expectedDefect.finding.id}`);
    assert.ok(decision, 'Canonical report must account for the arithmetic defect');
    assert.ok(['retained', 'merged'].includes(decision.disposition), 'Expected defect must survive consolidation');
    assert.ok(decision.reportId && report.includes(decision.reportId), 'Report must contain the retained finding ID');
    assert.equal(await git(repository, 'rev-parse', 'HEAD'), head);
    assert.equal(await git(repository, 'status', '--porcelain=v1', '--untracked-files=all'), '');
    return { directory, ...result };
  } finally {
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  testReviewWithPi(process.argv.slice(2)).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }).catch(error => { process.stderr.write(`Real-Pi fixture failed: ${error.message}\n`); process.exitCode = 1; });
}
