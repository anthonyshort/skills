#!/usr/bin/env python3
"""Build pinned, isolated review cases and a separate scoring key."""
import argparse
import json
from pathlib import Path
import subprocess

CASES = [
    {
        'id': 'A01', 'title': 'Connect the retry action',
        'requirements': 'Retry must increment the client retry count once. registerRetry retains the callback and invokes it as a plain function. Keep the existing public retry method.',
        'base': '''export class Client {
  retries = 0;
  retry(): void { this.retries += 1; }
}
export function connect(client: Client, registerRetry: (callback: () => void) => void): void {
  registerRetry(() => client.retry());
}
''',
        'head': '''export class Client {
  retries = 0;
  retry(): void { this.retries += 1; }
}
export function connect(client: Client, registerRetry: (callback: () => void) => void): void {
  registerRetry(client.retry);
}
''',
        'kind': 'bug', 'expected': 'Detached retry method loses this. Invoking the retained callback throws instead of updating the client.',
        'oracle': '''const client = new mod.Client(); let callback;
mod.connect(client, value => { callback = value; });
callback(); assert.equal(client.retries, 1);''',
    },
    {
        'id': 'A02', 'title': 'Add a keyboard clear action',
        'requirements': 'Clearing the cart must remove all items and close the cart. Both the menu and keyboard entry points perform this same domain operation.',
        'base': '''export type Cart = { itemIds: string[]; isOpen: boolean };
export function clearFromMenu(cart: Cart): void {
  cart.itemIds = [];
  cart.isOpen = false;
}
''',
        'head': '''export type Cart = { itemIds: string[]; isOpen: boolean };
export function clearFromMenu(cart: Cart): void {
  cart.itemIds = [];
  cart.isOpen = false;
}
export function clearFromKeyboard(cart: Cart): void {
  cart.itemIds = [];
}
''',
        'kind': 'bug', 'expected': 'Keyboard path fails to close cart. Consolidating the operation prevents callers drifting from the same invariant.',
        'oracle': '''const cart = { itemIds: ['x'], isOpen: true };
mod.clearFromKeyboard(cart); assert.deepEqual(cart, { itemIds: [], isOpen: false });''',
    },
    {
        'id': 'A03', 'title': 'Add a mean helper',
        'requirements': 'mean returns the arithmetic mean of all supplied values, counting duplicates as separate samples. Empty input returns undefined. Existing sum callers must continue to work.',
        'base': '''export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
''',
        'head': '''export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
export function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return sum(values) / new Set(values).size;
}
''',
        'tests': '''import assert from 'node:assert/strict';
import { mean } from './service.ts';
assert.equal(mean([2, 2, 8]), 6);
assert.equal(mean([]), undefined);
console.log('Assertions passed');
''',
        'kind': 'bug', 'expected': 'Mean divides by distinct-value count. [2,2,8] should return4, but returns6. Supplied passing test encodes the bug.',
        'oracle': '''assert.equal(mod.mean([2, 2, 8]), 4); assert.equal(mod.mean([]), undefined);''',
    },
    {
        'id': 'A04', 'title': 'Add a counter action',
        'requirements': 'counter is a Valtio v1 proxy. Consumers subscribe to counter. increment must update its observed count by one and publish that change. The original plain object is not passed to consumers.',
        'base': '''import { proxy } from 'valtio/vanilla';
const initial = { count: 0 };
export const counter = proxy(initial);
''',
        'head': '''import { proxy } from 'valtio/vanilla';
const initial = { count: 0 };
export const counter = proxy(initial);
export function increment(): void {
  initial.count += 1;
}
''',
        'kind': 'bug', 'expected': 'Writes through raw initial object bypass observed proxy and do not notify subscribers.',
        'oracle': '''const { subscribe } = await import('valtio/vanilla');
let changes = 0; const stop = subscribe(mod.counter, () => { changes += 1; }, true);
mod.increment(); stop(); assert.equal(changes, 1); assert.equal(mod.counter.count, 1);''',
    },
    {
        'id': 'A05', 'title': 'Add a scoped watcher group',
        'requirements': 'startGroup starts A then B. Stop B before A when disposing. Cleanup handles are nonthrowing. If B setup throws, stop A and propagate the original error. Repeated disposal must do nothing.',
        'base': '''export type Stop = () => void;
''',
        'head': '''export type Stop = () => void;
export function startGroup(startA: () => Stop, startB: () => Stop): Stop {
  const stopA = startA();
  let stopB: Stop;
  try { stopB = startB(); }
  catch (error) { stopA(); throw error; }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    stopB();
    stopA();
  };
}
''',
        'kind': 'clean', 'expected': 'No defect. Nonthrowing cleanup is an explicit contract. Do not demand unrelated async/plugin infrastructure.',
        'oracle': '''const events = []; const stop = mod.startGroup(() => () => events.push('A'), () => () => events.push('B'));
stop(); stop(); assert.deepEqual(events, ['B', 'A']);
const error = new Error('setup'); const failed = [];
assert.throws(() => mod.startGroup(() => () => failed.push('A'), () => { throw error; }), e => e === error);
assert.deepEqual(failed, ['A']);''',
    },
    {
        'id': 'A06', 'title': 'Parse a bounded selection',
        'requirements': 'parseSelection accepts only objects with an ids array containing at most100 nonempty strings. Empty selection is valid. Invalid input returns undefined. Return a fresh array so later caller mutation does not alter input.',
        'base': '''export type Selection = { ids: string[] };
''',
        'head': '''export type Selection = { ids: string[] };
export function parseSelection(value: unknown): Selection | undefined {
  if (typeof value !== 'object' || value === null || !('ids' in value)) return undefined;
  const ids = value.ids;
  if (!Array.isArray(ids) || ids.length > 100) return undefined;
  const output: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) return undefined;
    output.push(id);
  }
  return { ids: output };
}
''',
        'kind': 'clean', 'expected': 'No defect. No canonical schema/dependency exists in this tiny package. A library migration alone is not a correctness finding.',
        'oracle': '''assert.deepEqual(mod.parseSelection({ ids: [] }), { ids: [] });
for (const value of [null, 'x', {}, { ids: [1] }, { ids: [''] }, { ids: Array(101).fill('a') }]) assert.equal(mod.parseSelection(value), undefined);
const input = { ids: ['a'] }; const output = mod.parseSelection(input); output.ids.push('b'); assert.deepEqual(input.ids, ['a']);''',
    },
    {
        'id': 'A07', 'title': 'Save the issued invoice total',
        'requirements': 'An issued invoice is an immutable historical snapshot. Copy line amounts and save totalAtIssue. Later edits to draft lines must not affect either saved lines or the total. Plain in-memory persistence is intentional for this module.',
        'base': '''export type Line = { amount: number };
export type Invoice = { lines: Line[] };
export function issue(lines: readonly Line[]): Invoice {
  return { lines: lines.map(line => ({ ...line })) };
}
''',
        'head': '''export type Line = { amount: number };
export type Invoice = { lines: Line[]; totalAtIssue: number };
export function issue(lines: readonly Line[]): Invoice {
  const savedLines = lines.map(line => ({ ...line }));
  return {
    lines: savedLines,
    totalAtIssue: savedLines.reduce((sum, line) => sum + line.amount, 0),
  };
}
''',
        'kind': 'exception', 'expected': 'Do not flag duplicate derived state. totalAtIssue is an intentional historical snapshot, not a live cache.',
        'oracle': '''const lines = [{ amount: 10 }, { amount: 20 }]; const invoice = mod.issue(lines);
lines[0].amount = 90; assert.equal(invoice.totalAtIssue, 30); assert.equal(invoice.lines[0].amount, 10);''',
    },
    {
        'id': 'A08', 'title': 'Expose an authorised invoice reader',
        'requirements': 'withInvoiceAccess is the public boundary for untrusted callers. requireRead must complete successfully before any underlying get. Rejections propagate unchanged. Direct readers are internal trusted capabilities. No other configuration is needed.',
        'base': '''export type Invoice = { id: string };
export type Reader = { get(id: string): Promise<Invoice> };
''',
        'head': '''export type Invoice = { id: string };
export type Reader = { get(id: string): Promise<Invoice> };
export function withInvoiceAccess(reader: Reader, requireRead: (id: string) => Promise<void>): Reader {
  return {
    async get(id) {
      await requireRead(id);
      return reader.get(id);
    },
  };
}
''',
        'kind': 'exception', 'expected': 'Do not remove this apparently thin wrapper. It enforces access and required ordering at a real trust boundary.',
        'oracle': '''const events = []; const error = new Error('denied');
const protectedReader = mod.withInvoiceAccess({ get: async id => { events.push('read'); return { id }; } }, async () => { events.push('auth'); });
assert.deepEqual(await protectedReader.get('a'), { id: 'a' }); assert.deepEqual(events, ['auth', 'read']);
const blocked = mod.withInvoiceAccess({ get: async () => { throw new Error('should not read'); } }, async () => { throw error; });
await assert.rejects(blocked.get('a'), e => e === error);''',
    },
]


def git(path, *args):
    return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--key', type=Path, required=True)
    parser.add_argument('--node-modules', type=Path, required=True)
    args = parser.parse_args()
    args.inputs.mkdir(parents=True, exist_ok=False)
    manifest = []
    key = []
    for case in CASES:
        path = args.inputs / case['id']
        path.mkdir()
        git(path, 'init', '-q')
        git(path, 'config', 'user.name', 'Review fixture')
        git(path, 'config', 'user.email', 'fixture@example.invalid')
        (path / 'package.json').write_text(json.dumps({'name': 'fixture-' + case['id'].lower(), 'private': True, 'type': 'module'}))
        (path / '.gitignore').write_text('node_modules\n')
        (path / 'SPEC.md').write_text('# Requirements\n\n' + case['requirements'] + '\n\nThis is a small internal TypeScript package. No canonical schema or framework exists beyond dependencies used in its source. No linked PR discussions, external decisions or wider migrations exist for this fixture. Review only the supplied change and supported callers.\n')
        (path / 'service.ts').write_text(case['base'])
        git(path, 'add', '.')
        git(path, 'commit', '-qm', 'Baseline')
        base = git(path, 'rev-parse', 'HEAD')
        (path / 'service.ts').write_text(case['head'])
        if 'tests' in case:
            (path / 'service.test.ts').write_text(case['tests'])
        git(path, 'add', '.')
        git(path, 'commit', '-qm', case['title'])
        head = git(path, 'rev-parse', 'HEAD')
        (path / 'node_modules').symlink_to(args.node_modules.resolve(), target_is_directory=True)
        manifest.append({'id': case['id'], 'title': case['title'], 'repository': str(path.resolve()), 'base': base, 'head': head})
        key.append({**manifest[-1], 'kind': case['kind'], 'expected': case['expected'], 'oracle': case['oracle']})
    (args.inputs / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    args.key.parent.mkdir(parents=True, exist_ok=True)
    args.key.write_text(json.dumps(key, indent=2) + '\n')
    print(f'Created {len(manifest)} pinned cases. Expected outcomes stored separately.')


if __name__ == '__main__':
    main()
