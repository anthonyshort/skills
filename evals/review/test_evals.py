"""Check case parsing, repository building and grading without calling an agent."""

import importlib.util
import json
from pathlib import Path
import shlex
import sys
import tempfile
import unittest
from argparse import Namespace

SPEC = importlib.util.spec_from_file_location('evals', Path(__file__).with_name('evals.py'))
evals = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evals)

CASE = '''## renamed-total: Rename the total

### Requirements

Rename the field.

### Before

```ts file=src/total.ts
export const total = 1;
```

### After

```ts file=src/total.ts
export const sum = 1;
```

### Must find

- Flags the breaking rename.

### Must not flag

- Reports a style nit as required.
'''


def parse(text):
    return evals.parse_case('demo', text.removeprefix('## '))


def grader(answer):
    script = f'import sys; sys.stdin.read(); print({json.dumps(answer)!r})'
    return shlex.join([sys.executable, '-c', script])


class EvalsTest(unittest.TestCase):
    def test_every_case_file_parses(self):
        cases = evals.load_cases([])
        self.assertTrue(cases)
        for case in cases:
            self.assertTrue(case.after, case.name)

    def test_parses_sections_and_files(self):
        case = parse(CASE)
        self.assertEqual(case.name, 'demo/renamed-total')
        self.assertEqual(case.title, 'Rename the total')
        self.assertEqual(case.before, {'src/total.ts': 'export const total = 1;\n'})
        self.assertEqual(case.after, {'src/total.ts': 'export const sum = 1;\n'})
        self.assertEqual(case.must_find, ['Flags the breaking rename.'])
        self.assertEqual(case.must_not_flag, ['Reports a style nit as required.'])

    def test_rejects_unknown_sections(self):
        with self.assertRaisesRegex(ValueError, 'unknown section'):
            parse(CASE.replace('### Must find', '### Should find'))

    def test_builds_and_grades_a_case(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            case_dir = evals.build_case(case, out)
            diff = evals.git(case_dir / 'repo', 'diff', 'HEAD~1', 'HEAD')
            self.assertIn('+export const sum = 1;', diff)

            missing = evals.grade_case(case, case_dir, Namespace(grader=grader({}), timeout=30))
            self.assertFalse(missing['passed'])
            self.assertEqual(missing['error'], 'No review report was saved.')

            (case_dir / 'review-report.md').write_text('The rename breaks callers.')
            passing = {'must_find': [{'id': 1, 'met': True}], 'must_not_flag': [{'id': 1, 'violated': False}]}
            result = evals.grade_case(case, case_dir, Namespace(grader=grader(passing), timeout=30))
            self.assertTrue(result['passed'])

            failing = {'must_find': [{'id': 1, 'met': False}], 'must_not_flag': [{'id': 1, 'violated': True}]}
            result = evals.grade_case(case, case_dir, Namespace(grader=grader(failing), timeout=30))
            self.assertFalse(result['passed'])
            self.assertEqual(result['missed'], case.must_find)
            self.assertEqual(result['wrongly_flagged'], case.must_not_flag)

            extra = {**passing, 'must_not_flag': [{'id': 1, 'violated': False}, {'id': 2, 'violated': True}]}
            result = evals.grade_case(case, case_dir, Namespace(grader=grader(extra), timeout=30))
            self.assertTrue(result['passed'], 'criteria the case does not have are ignored')

            skipped = {**passing, 'must_find': []}
            result = evals.grade_case(case, case_dir, Namespace(grader=grader(skipped), timeout=30))
            self.assertFalse(result['passed'])
            self.assertEqual(result['error'], 'Grader skipped: Flags the breaking rename.')


if __name__ == '__main__':
    unittest.main()
