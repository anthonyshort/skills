"""Check case parsing, building, grading and code checks without calling an agent."""

import importlib.util
import json
from argparse import Namespace
from pathlib import Path
import shlex
import sys
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('run', Path(__file__).with_name('run.py'))
run = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(run)

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

### Inputs

```md file=research.md
## Callers

The total is read by billing.
```

### Must find

- Flags the breaking rename.

### Must not flag

- Reports a style nit as required.

### Must read

- `review-rules/rules/keep-api-changes-compatible.md`
'''

FULL_REVIEW = ['risk.md', 'research.md', 'guidance.md',
               'product.md, system-fit.md, simplicity.md, readability.md, correctness.md',
               'rules.md', 'review-report.md']


def parse(text, unit='review-rules'):
    return run.parse_case(unit, 'demo', text.removeprefix('## '))


def tool(name, parent=None, **tool_input):
    return {'type': 'assistant', 'parent_tool_use_id': parent,
            'message': {'content': [{'type': 'tool_use', 'name': name, 'input': tool_input}]}}


def grader(answer):
    script = f'import sys; sys.stdin.read(); print({json.dumps(answer)!r})'
    return shlex.join([sys.executable, '-c', script])


def build(case, directory):
    units = run.load_units()
    out = Path(directory)
    skills = run.build_skills(out, units[case.unit], run.SKILLS_DIR)
    return run.build_case(case, units[case.unit], out, skills), units[case.unit]


def write_transcript(directory, events):
    (directory / 'transcript.jsonl').write_text('\n'.join(json.dumps(event) for event in events))


def follow_workflow(directory, order=None):
    """Write a transcript of a full review that uses every unit, in the given file order."""
    skills = directory.parents[2] / 'review' / 'skills'
    events = []
    for name in order or [name for step in FULL_REVIEW for name in step.split(', ')]:
        unit = run.UNIT_FOR_FILE[name]
        if unit in run.DELEGATED_UNITS:
            events.append(tool('Agent', prompt=f'Follow {skills}/{unit}/SKILL.md'))
            events.append(tool('Read', parent='agent', file_path=f'{skills}/{unit}/SKILL.md'))
        else:
            events.append(tool('Read', file_path=f'{skills}/{unit}/SKILL.md'))
        events.append(tool('Write', file_path=str(directory / 'artefacts' / name)))
    write_transcript(directory, events)


def failed(case, unit, directory):
    return [check['check'] for check in run.run_checks(case, unit, directory) if not check['passed']]


class ParsingTest(unittest.TestCase):
    def test_every_case_file_parses(self):
        units, cases = run.load_cases([])
        self.assertTrue(cases)
        self.assertEqual({case.unit for case in cases}, set(units), 'every unit has cases')

    def test_parses_sections_and_files(self):
        case = parse(CASE)
        self.assertEqual(case.name, 'review-rules/demo/renamed-total')
        self.assertEqual(case.before, {'src/total.ts': 'export const total = 1;\n'})
        self.assertEqual(case.after, {'src/total.ts': 'export const sum = 1;\n'})
        self.assertEqual(case.inputs, {'research.md': '## Callers\n\nThe total is read by billing.\n'})
        self.assertEqual(case.must_find, ['Flags the breaking rename.'])
        self.assertEqual(case.must_read, ['review-rules/rules/keep-api-changes-compatible.md'])

    def test_repeats_blocks(self):
        case = parse(CASE.replace('```ts file=src/total.ts\nexport const sum', '```ts file=src/total.ts repeat=3\nexport const sum{n}'))
        self.assertEqual(case.after['src/total.ts'], 'export const sum1 = 1;\nexport const sum2 = 1;\nexport const sum3 = 1;\n')

    def test_rejects_unknown_sections(self):
        with self.assertRaisesRegex(ValueError, 'unknown section'):
            parse(CASE.replace('### Must find', '### Should find'))

    def test_every_rule_has_a_violation_case(self):
        rules = run.rule_index(run.SKILLS_DIR)
        _, cases = run.load_cases(['review-rules'])
        required = {path for case in cases if case.must_find for path in case.must_read}
        uncovered = [link for _, link in rules if f'review-rules/rules/{link}' not in required]
        self.assertEqual(uncovered, [])


class GradingTest(unittest.TestCase):
    def test_builds_the_case_and_prompt(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir, _ = build(case, directory)
            self.assertIn('+export const sum = 1;', run.git(case_dir / 'repo', 'diff', 'HEAD~1', 'HEAD'))
            self.assertEqual((case_dir / 'inputs/research.md').read_text(), '## Callers\n\nThe total is read by billing.\n')
            prompt = (case_dir / 'prompt.md').read_text()
            self.assertIn(str(case_dir / 'artefacts' / 'rules.md'), prompt)
            self.assertNotIn('{', prompt)

    def test_grades_criteria(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            args = lambda answer: Namespace(grader=grader(answer), timeout=30)

            result = run.grade_case(case, unit, case_dir, args({}))
            self.assertFalse(result['passed'])
            self.assertEqual(result['error'], 'No rules.md was saved.')

            (case_dir / 'artefacts/rules.md').write_text('The rename breaks callers.')
            passing = {'must_find': [{'id': 1, 'met': True}], 'must_not_flag': [{'id': 1, 'violated': False}]}
            self.assertTrue(run.grade_case(case, unit, case_dir, args(passing))['criteria_passed'])

            failing = {'must_find': [{'id': 1, 'met': False}], 'must_not_flag': [{'id': 1, 'violated': True}]}
            result = run.grade_case(case, unit, case_dir, args(failing))
            self.assertEqual(result['missed'], case.must_find)
            self.assertEqual(result['wrongly_flagged'], case.must_not_flag)

            extra = {**passing, 'must_not_flag': [{'id': 1, 'violated': False}, {'id': 2, 'violated': True}]}
            self.assertTrue(run.grade_case(case, unit, case_dir, args(extra))['criteria_passed'],
                            'criteria the case does not have are ignored')

            skipped = {**passing, 'must_find': []}
            result = run.grade_case(case, unit, case_dir, args(skipped))
            self.assertEqual(result['error'], 'Grader skipped: Flags the breaking rename.')


class CheckTest(unittest.TestCase):
    def test_rule_checks(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            skills = case_dir.parents[2] / 'review-rules' / 'skills'
            index = skills / 'review-rules/rules/README.md'
            (case_dir / 'artefacts/rules.md').write_text(index.read_text())
            write_transcript(case_dir, [
                tool('Read', file_path=str(index)),
                tool('Read', file_path=str(skills / 'review-rules/rules/keep-api-changes-compatible.md'))])
            self.assertEqual(failed(case, unit, case_dir), [])

            for command in ['cd rules && cat keep-api-changes-compatible.md', 'for f in review-rules/rules/*.md; do cat $f; done']:
                write_transcript(case_dir, [tool('Read', file_path=str(index)), tool('Bash', command=command)])
                self.assertEqual(failed(case, unit, case_dir), [], command)

            (case_dir / 'artefacts/rules.md').write_text(index.read_text().replace('bind-query-values', '')
                                                         .replace('Bind query values', ''))
            (case_dir / 'repo/src/total.ts').write_text('changed')
            write_transcript(case_dir, [tool('Bash', command='npm test')])
            self.assertEqual(failed(case, unit, case_dir), [
                'no code changes', 'every rule accounted for', 'rule index read', 'no local checks',
                'required guidance read'])

    def test_missing_transcript_fails(self):
        case = parse(CASE)
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            self.assertIn('transcript', failed(case, unit, case_dir))

    def workflow_case(self, steps=FULL_REVIEW):
        case = parse(CASE, unit='review')
        case.must_find, case.must_not_flag, case.must_read = [], [], []
        case.steps = steps
        return case

    def test_steps_pass_when_followed_in_order(self):
        case = self.workflow_case()
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            follow_workflow(case_dir)
            self.assertEqual(failed(case, unit, case_dir), [])

    def test_steps_catch_skipped_reordered_and_undelegated_work(self):
        case = self.workflow_case()
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            order = ['risk.md', 'guidance.md', 'research.md', 'product.md', 'system-fit.md',
                     'readability.md', 'correctness.md', 'review-report.md', 'rules.md']
            follow_workflow(case_dir, order)
            self.assertEqual(failed(case, unit, case_dir), ['steps run', 'step order'])

            events = [json.loads(line) for line in (case_dir / 'transcript.jsonl').read_text().splitlines()]
            write_transcript(case_dir, [event for event in events if event['message']['content'][0]['name'] != 'Agent'])
            self.assertIn('units delegated', failed(case, unit, case_dir))

    def test_steps_catch_extra_work(self):
        case = self.workflow_case(['review-report.md'])
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            follow_workflow(case_dir)
            self.assertEqual(failed(case, unit, case_dir), ['no unexpected steps'])

    def test_steps_without_a_unit_skip_the_unit_checks(self):
        case = self.workflow_case(['review-report.md (no unit)'])
        with tempfile.TemporaryDirectory() as directory:
            case_dir, unit = build(case, directory)
            write_transcript(case_dir, [tool('Write', file_path=str(case_dir / 'artefacts/review-report.md'))])
            self.assertEqual(failed(case, unit, case_dir), [])


if __name__ == '__main__':
    unittest.main()
