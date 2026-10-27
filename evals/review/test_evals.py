"""Check case parsing, repository building and grading without calling an agent."""

import importlib.util
import json
from pathlib import Path
import shlex
import shutil
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


def tool(name, **tool_input):
    return {'type': 'assistant', 'parent_tool_use_id': None,
            'message': {'content': [{'type': 'tool_use', 'name': name, 'input': tool_input}]}}


def build(case, directory):
    out = Path(directory)
    shutil.copytree(evals.SKILLS_DIR, out / 'skills')
    return evals.build_case(case, out)


def follow_skill(case_dir):
    """Save everything a complete review leaves behind."""
    skills = case_dir.parent.parent / 'skills'
    artefacts = case_dir / 'artefacts'
    artefacts.mkdir()
    for name in evals.ASSESSMENTS:
        (artefacts / name).write_text('Assessment.')
    (artefacts / 'rules.md').write_text((skills / 'review/rules/README.md').read_text())
    (case_dir / 'review-report.md').write_text('\n'.join(evals.REPORT_SECTIONS))
    events = [tool('Read', file_path=str(skills / 'review/rules/README.md')),
              tool('Read', file_path=str(skills / 'best-practices/valtio/SKILL.md')),
              tool('Agent', prompt='Research the change.'),
              tool('Write', file_path=str(artefacts / 'research.md'))]
    events += [tool('Agent', prompt='Answer one review question.') for _ in range(6)]
    events += [tool('Write', file_path=str(case_dir / 'review-report.md')),
               tool('Agent', prompt='Shorten the report.')]
    (case_dir / 'transcript.jsonl').write_text('\n'.join(json.dumps(event) for event in events))


def failed_checks(case, case_dir):
    return [check['check'] for check in evals.check_process(case, case_dir) if not check['passed']]


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
            case_dir = build(case, directory)
            diff = evals.git(case_dir / 'repo', 'diff', 'HEAD~1', 'HEAD')
            self.assertIn('+export const sum = 1;', diff)

            missing = evals.grade_case(case, case_dir, Namespace(grader=grader({}), timeout=30))
            self.assertFalse(missing['passed'])
            self.assertEqual(missing['error'], 'No review report was saved.')

            follow_skill(case_dir)
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


    def test_process_passes_when_every_step_is_followed(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir = build(case, directory)
            follow_skill(case_dir)
            self.assertEqual(failed_checks(case, case_dir), [])

    def test_process_catches_skipped_steps(self):
        case = parse(CASE)
        case.must_read = ['review/rules/bind-query-values.md']
        with tempfile.TemporaryDirectory() as directory:
            case_dir = build(case, directory)
            follow_skill(case_dir)
            (case_dir / 'artefacts/simplicity.md').unlink()
            rules = case_dir / 'artefacts/rules.md'
            rules.write_text(rules.read_text().replace('bind-query-values', '').replace('Bind query values', ''))
            (case_dir / 'repo/src/total.ts').write_text('changed')
            transcript = case_dir / 'transcript.jsonl'
            transcript.write_text(transcript.read_text() + '\n' + json.dumps(tool('Bash', command='npm test')))
            self.assertEqual(failed_checks(case, case_dir), [
                'saved assessments', 'every rule accounted for', 'no code changes',
                'no local checks', 'required guidance read'])

    def test_process_without_transcript_cannot_pass(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir = build(case, directory)
            follow_skill(case_dir)
            (case_dir / 'transcript.jsonl').unlink()
            self.assertEqual(failed_checks(case, case_dir), ['transcript'])

    def test_every_rule_has_a_case_that_must_read_it(self):
        rules = evals.RULE_LINK.findall((evals.SKILLS_DIR / 'review/rules/README.md').read_text())
        required = {path for case in evals.load_cases([]) for path in case.must_read}
        uncovered = [link for _, link in rules if f'review/rules/{link}' not in required]
        self.assertEqual(uncovered, [])


if __name__ == '__main__':
    unittest.main()
