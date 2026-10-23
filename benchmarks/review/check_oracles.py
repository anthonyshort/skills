#!/usr/bin/env python3
"""Verify benchmark expectations without exposing them to review agents."""
import argparse
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key', type=Path, required=True)
    parser.add_argument('--node', default='node')
    parser.add_argument('--node-modules', type=Path, required=True)
    args = parser.parse_args()
    root = args.key.resolve().parent
    modules = root / 'node_modules'
    if not modules.exists():
        modules.symlink_to(args.node_modules.resolve(), target_is_directory=True)
    results = []
    for case in json.loads(args.key.read_text()):
        source = Path(case['repository']) / 'service.ts'
        runner = root / (case['id'] + '.mjs')
        runner.write_text(
            "import assert from 'node:assert/strict';\n"
            + 'const mod = await import(' + json.dumps(source.as_uri()) + ');\n'
            + case['oracle'] + '\n'
        )
        run = subprocess.run([args.node, str(runner)], text=True, capture_output=True)
        correct = (run.returncode != 0) if case['kind'] == 'bug' else (run.returncode == 0)
        result = {'id': case['id'], 'kind': case['kind'], 'exit': run.returncode,
                  'expected_result': correct, 'output': run.stdout + run.stderr}
        supplied_test = source.with_name('service.test.ts')
        if supplied_test.exists():
            supplied = subprocess.run([args.node, str(supplied_test)], text=True, capture_output=True)
            result['supplied_tests_pass'] = supplied.returncode == 0
        results.append(result)
    (root / 'oracle-results.json').write_text(json.dumps(results, indent=2) + '\n')
    failures = [row['id'] for row in results if not row['expected_result']]
    if failures:
        raise SystemExit('Unexpected fixture results: ' + ', '.join(failures))
    print(f'All {len(results)} fixture outcomes independently reproduced.')


if __name__ == '__main__':
    main()
