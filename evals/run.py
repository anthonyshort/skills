#!/usr/bin/env python3
"""Run evals for the review skills.

Each folder in evals/ tests one skill. It has a prompt.md template and Markdown
cases in cases/. Each case becomes a small Git repository with a base and head
commit, plus any fixed inputs the skill needs. An agent runs the skill on a
copy of skills/, then a grader agent checks the skill's output against the
case's criteria and code checks confirm what the transcript shows it did.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
import json
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SKILLS_DIR = ROOT.parent / 'skills'

# The stream-json transcript records every tool call, including subagents', for the code checks.
# Runs from the run directory, so file access is limited to the case and the skills copy.
DEFAULT_AGENT = ('claude -p --output-format stream-json --verbose --permission-mode acceptEdits '
                 '--allowedTools "Bash(git:*)"')
DEFAULT_GRADER = 'claude -p'

SECTIONS = {'requirements', 'before', 'after', 'inputs', 'guidance', 'steps',
            'must find', 'must not flag', 'must read'}
CASE_ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
CODE_BLOCK = re.compile(r'^```[\w-]*\s+file=(\S+)([^\n]*)\n(.*?)^```\s*$', re.MULTILINE | re.DOTALL)
REPEAT = re.compile(r'\brepeat=(\d+)')


@dataclass
class Case:
    unit: str
    category: str
    id: str
    title: str
    requirements: str = ''
    before: dict = field(default_factory=dict)
    after: dict = field(default_factory=dict)
    inputs: dict = field(default_factory=dict)
    guidance: list = field(default_factory=list)
    steps: list = field(default_factory=list)
    must_find: list = field(default_factory=list)
    must_not_flag: list = field(default_factory=list)
    must_read: list = field(default_factory=list)

    @property
    def name(self):
        return f'{self.unit}/{self.category}/{self.id}'


@dataclass
class Unit:
    name: str
    output: str      # The file the skill saves, which the grader reads. May use {category}.
    template: str
    stubs: dict      # Skill name to stub SKILL.md, replacing real units for orchestration tests.

    def output_for(self, case):
        return self.output.format(category=case.category)


# Parsing


def load_unit(directory):
    text = (directory / 'prompt.md').read_text()
    front, _, template = text.removeprefix('---\n').partition('\n---\n')
    settings = dict(line.split(': ', 1) for line in front.splitlines() if ': ' in line)
    stubs = {path.stem: path.read_text() for path in sorted((directory / 'stubs').glob('*.md'))}
    return Unit(directory.name, settings['output'], template.strip() + '\n', stubs)


def load_units():
    return {path.parent.name: load_unit(path.parent) for path in sorted(ROOT.glob('*/prompt.md'))}


def split_headings(text, marker):
    """Split text at lines starting with marker, ignoring lines inside fenced code blocks."""
    chunks, current, fenced = [], None, False
    for line in text.splitlines(keepends=True):
        if line.startswith('```'):
            fenced = not fenced
        if not fenced and line.startswith(marker):
            current = [line[len(marker):]]
            chunks.append(current)
        elif current is not None:
            current.append(line)
    return [''.join(chunk) for chunk in chunks]


def parse_category(unit, path):
    chunks = split_headings(path.read_text(), '## ')
    return [parse_case(unit, path.stem, chunk) for chunk in chunks]


def parse_case(unit, category, chunk):
    heading, _, body = chunk.partition('\n')
    case_id, _, title = heading.partition(':')
    case = Case(unit, category, case_id.strip(), title.strip())
    where = f'{unit}/cases/{category}.md: {heading.strip()}'
    if not CASE_ID.match(case.id) or not case.title:
        raise ValueError(f'{where}: use "## kebab-case-id: Title"')

    for section in split_headings(body, '### '):
        name, _, text = section.partition('\n')
        name = name.strip().lower()
        if name not in SECTIONS:
            raise ValueError(f'{where}: unknown section "### {name}"')
        if name == 'requirements':
            case.requirements = text.strip()
        elif name in ('before', 'after', 'inputs'):
            setattr(case, name, {path: expand(code, attributes) for path, attributes, code in CODE_BLOCK.findall(text)})
        else:
            bullets = [line[2:].strip().strip('`') for line in text.splitlines() if line.startswith('- ')]
            setattr(case, name.replace(' ', '_'), bullets)

    if not case.requirements:
        raise ValueError(f'{where}: missing "### Requirements"')
    if not case.after:
        raise ValueError(f'{where}: "### After" needs at least one ```lang file=path block')
    if not (case.must_find or case.must_not_flag or case.steps):
        raise ValueError(f'{where}: add "### Must find", "### Must not flag" or "### Steps" bullets')
    return case


def expand(code, attributes):
    """A block marked repeat=N is repeated N times, with {n} replaced by 1 to N. It builds large diffs."""
    repeat = REPEAT.search(attributes)
    if not repeat:
        return code
    return ''.join(code.replace('{n}', str(n)) for n in range(1, int(repeat.group(1)) + 1))


def load_cases(filters):
    units = load_units()
    cases = [case for unit in units for path in sorted((ROOT / unit / 'cases').glob('*.md'))
             for case in parse_category(unit, path)]
    names = [case.name for case in cases]
    duplicates = {name for name in names if names.count(name) > 1}
    if duplicates:
        raise ValueError('Duplicate case ids: ' + ', '.join(sorted(duplicates)))
    if not filters:
        return units, cases
    selected = [case for case in cases if any(case.name == f or case.name.startswith(f.rstrip('/') + '/')
                                              for f in filters)]
    if not selected:
        raise SystemExit('No cases match: ' + ' '.join(filters))
    return units, selected


# Building


def git(path, *args):
    return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()


def write_files(root, files):
    for relative, code in files.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(code)


def case_dir(out, case):
    return out / case.unit / case.category / case.id


def build_skills(out, unit, skills):
    # Each unit gets its own copy of the skills, so it cannot read the expected answers
    # and stubs for one unit's tests never leak into another's.
    target = out / unit.name / 'skills'
    if not target.exists():
        shutil.copytree(skills, target)
        for skill, stub in unit.stubs.items():
            (target / skill / 'SKILL.md').write_text(stub)
    return target


def build_case(case, unit, out, skills):
    directory = case_dir(out, case)
    repo = directory / 'repo'
    repo.mkdir(parents=True)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.name', 'Eval fixture')
    git(repo, 'config', 'user.email', 'eval@example.invalid')
    write_files(repo, case.before)
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'Baseline')
    base = git(repo, 'rev-parse', 'HEAD')
    write_files(repo, case.after)
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', f'{case.title}\n\n{case.requirements}')
    head = git(repo, 'rev-parse', 'HEAD')
    write_files(directory / 'inputs', case.inputs)
    (directory / 'artefacts').mkdir()
    (directory / 'revisions.json').write_text(json.dumps({'base': base, 'head': head}) + '\n')
    guidance = '\n'.join(f'- {skills / path}' for path in case.guidance) or 'None selected.'
    inputs = '\n'.join(f'- {directory / "inputs" / path}' for path in case.inputs) or 'None.'
    prompt = unit.template.format(
        repo=repo, base=base, head=head, skills=skills, title=case.title, requirements=case.requirements,
        category=case.category, artefacts=directory / 'artefacts', inputs=inputs, guidance=guidance,
        output=directory / 'artefacts' / unit.output_for(case))
    (directory / 'prompt.md').write_text(prompt)
    return directory


# Running and grading


def run_agent(command, prompt, cwd, log, timeout):
    try:
        run = subprocess.run(shlex.split(command), input=prompt, cwd=cwd, text=True,
                             capture_output=True, timeout=timeout)
        log.write_text(run.stdout + run.stderr)
        return run.stdout
    except subprocess.TimeoutExpired as error:
        log.write_text(f'Timed out after {timeout} seconds\n{error.stdout or ""}')
        return ''


def run_case(case, directory, args):
    print(f'Running {case.name}', flush=True)
    run_agent(args.agent, (directory / 'prompt.md').read_text(), args.out,
              directory / 'transcript.jsonl', args.timeout)


def numbered(items):
    return '\n'.join(f'{i}. {text}' for i, text in enumerate(items, 1)) or 'None.'


def grader_prompt(case, output_name, output, diff, inputs):
    supplied = '\n\n'.join(f'### {path}\n\n{text}' for path, text in inputs.items()) or 'None.'
    return f'''You are grading the output of one step of a code review against fixed criteria.

Judge what the output actually says, not what it could have said. A finding counts when the output identifies the same problem and its consequence, even with different wording. A passing mention in a coverage table without a finding does not count. Optional suggestions and nits only violate a "must not flag" criterion when the criterion says so.

## Change under review

Title: {case.title}

Requirements:
{case.requirements}

```diff
{diff}
```

## Inputs the step was given

{supplied}

## Must find

{numbered(case.must_find)}

## Must not flag

{numbered(case.must_not_flag)}

## Output to grade: {output_name}

{output}

## Answer

Reply with only this JSON object:

{{"must_find": [{{"id": 1, "met": true, "evidence": "short quote from the output or why it is missing"}}],
 "must_not_flag": [{{"id": 1, "violated": false, "evidence": "short quote from the output, if violated"}}]}}
'''


def grade_case(case, unit, directory, args):
    checks = run_checks(case, unit, directory)
    output_path = directory / 'artefacts' / unit.output_for(case)
    if not (case.must_find or case.must_not_flag):
        grade = {}
    elif not output_path.exists():
        grade = {'error': f'No {output_path.name} was saved.'}
    else:
        diff = git(directory / 'repo', 'diff', 'HEAD~1', 'HEAD')
        prompt = grader_prompt(case, output_path.name, output_path.read_text(), diff, case.inputs)
        output = run_agent(args.grader, prompt, directory, directory / 'grader.log', args.timeout)
        try:
            grade = json.loads(output[output.index('{'):output.rindex('}') + 1])
        except ValueError:
            grade = {'error': 'Grader did not return JSON. See grader.log.'}
    return save_result(case, directory, grade, checks)


def save_result(case, directory, grade, checks=()):
    # Index rows by criterion id, ignoring any the grader invents for criteria that don't exist.
    found = {row.get('id'): row for row in grade.get('must_find', [])}
    flags = {row.get('id'): row for row in grade.get('must_not_flag', [])}
    ungraded = [text for i, text in enumerate(case.must_find, 1) if i not in found] \
        + [text for i, text in enumerate(case.must_not_flag, 1) if i not in flags]
    error = grade.get('error') or (f'Grader skipped: {"; ".join(ungraded)}' if ungraded else None)
    missed = [text for i, text in enumerate(case.must_find, 1) if i in found and not found[i].get('met')]
    flagged = [text for i, text in enumerate(case.must_not_flag, 1) if i in flags and flags[i].get('violated')]
    criteria_passed = not error and not missed and not flagged
    failed_checks = [check for check in checks if not check['passed']]
    result = {'case': case.name, 'title': case.title, 'passed': criteria_passed and not failed_checks,
              'criteria_passed': criteria_passed, 'checks_passed': not failed_checks,
              'missed': missed, 'wrongly_flagged': flagged, 'error': error,
              'checks': list(checks), 'grade': grade}
    (directory / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def summarise(results, out):
    passed = sum(row['passed'] for row in results)
    mark = lambda passed: 'Pass' if passed else 'Fail'
    lines = [f'# Review evals: {passed}/{len(results)} passed', '',
             '| Case | Criteria | Checks | Notes |', '| --- | --- | --- | --- |']
    for row in results:
        notes = [f'Missed: {text}' for text in row['missed']]
        notes += [f'Wrongly flagged: {text}' for text in row['wrongly_flagged']]
        notes += [row['error']] if row['error'] else []
        notes += [f"{check['check']}: {check['detail']}" for check in row['checks'] if not check['passed']]
        cell = '<br>'.join(text.replace('|', '\\|') for text in notes)
        lines.append(f"| {row['case']} | {mark(row['criteria_passed'])} | {mark(row['checks_passed'])} | {cell} |")
    summary = '\n'.join(lines) + '\n'
    (out / 'summary.md').write_text(summary)
    (out / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(summary)


# Code checks
#
# Evidence comes from the agent's stream-json transcript and the files it saved,
# never from what its output claims.

ASSESSMENTS = ['product.md', 'system-fit.md', 'simplicity.md', 'readability.md', 'correctness.md']
WORKFLOW_FILES = ['risk.md', 'research.md', 'guidance.md', *ASSESSMENTS, 'rules.md', 'review-report.md']
UNIT_FOR_FILE = {'risk.md': 'review-risk', 'research.md': 'review-research', 'guidance.md': 'review-guidance',
                 'rules.md': 'review-rules', 'review-report.md': 'review-report',
                 **{name: 'review-assess' for name in ASSESSMENTS}}
DELEGATED_UNITS = {'review-research', 'review-guidance', 'review-assess', 'review-rules'}
NO_UNIT = '(no unit)'
REPORT_SECTIONS = ['## Assessment', '### Risk and scope', '## Findings', '## Verification summary',
                   '## References', '## Supporting details']
LOCAL_CHECK = re.compile(r'(^|[\s;&|(])(npm|pnpm|yarn|npx|node|tsc|vitest|jest|eslint|bun|deno)\s')
RULE_LINK = re.compile(r'^\| \[(.+?)\]\((.+?\.md)\)', re.MULTILINE)


@dataclass
class Transcript:
    agents: list = field(default_factory=list)   # (position, prompt) for subagents the parent launched
    reads: list = field(default_factory=list)    # (position, file path or shell command) by any agent
    writes: list = field(default_factory=list)   # (position, path) for files written by any agent
    commands: list = field(default_factory=list)
    denials: int = 0

    def first_read(self, needle):
        return min((position for position, entry in self.reads if needle in entry), default=None)

    def first_write(self, name):
        return min((position for position, path in self.writes if Path(path).name == name), default=None)


def read_transcript(path):
    if not path.exists():
        return None
    transcript = Transcript()
    for position, line in enumerate(path.read_text().splitlines()):
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get('type') == 'system' and event.get('subtype') == 'permission_denied':
            transcript.denials += 1
        if event.get('type') != 'assistant':
            continue
        for block in event['message'].get('content', []):
            if not isinstance(block, dict) or block.get('type') != 'tool_use':
                continue
            name, tool_input = block['name'], block.get('input', {})
            if name in ('Agent', 'Task') and event.get('parent_tool_use_id') is None:
                transcript.agents.append((position, tool_input.get('prompt', '')))
            elif name == 'Read':
                transcript.reads.append((position, tool_input.get('file_path', '')))
            elif name in ('Write', 'Edit'):
                transcript.writes.append((position, tool_input.get('file_path', '')))
            elif name == 'Bash':
                transcript.commands.append(tool_input.get('command', ''))
                transcript.reads.append((position, tool_input.get('command', '')))
    return transcript if transcript.agents or transcript.reads or transcript.writes or transcript.commands else None


def rule_index(skills):
    return RULE_LINK.findall((skills / 'review-rules/rules/README.md').read_text())


def run_checks(case, unit, directory):
    out = directory.parents[2]
    skills = out / unit.name / 'skills'
    artefacts = directory / 'artefacts'
    transcript = read_transcript(directory / 'transcript.jsonl')
    checks = []

    def check(name, passed, detail):
        checks.append({'check': name, 'passed': bool(passed), 'detail': detail})

    revisions = json.loads((directory / 'revisions.json').read_text())
    repo = directory / 'repo'
    changed = git(repo, 'status', '--porcelain') or git(repo, 'rev-parse', 'HEAD') != revisions['head']
    check('no code changes', not changed, 'The repository was modified.' if changed else 'Repository unchanged.')

    if case.must_find or case.must_not_flag:
        output = artefacts / unit.output_for(case)
        check('output saved', output.exists(), f'{output.name} saved.' if output.exists() else f'{output.name} missing.')

    for extra in UNIT_CHECKS.get(unit.name, []):
        extra(case, directory, skills, transcript, check)

    if transcript is None:
        check('transcript', False, 'No stream-json transcript, so the transcript checks cannot run.')
        return checks

    local = [command for command in transcript.commands if LOCAL_CHECK.search(command)]
    check('no local checks', not local, 'Ran: ' + '; '.join(local) if local else 'No builds, tests or linters run.')

    unread = [path for path in case.must_read if transcript.first_read(f'skills/{path}') is None]
    if case.must_read:
        check('required guidance read', not unread, 'Not read: ' + ', '.join(unread) if unread else 'All read.')
    if transcript.denials:
        check('permissions', False, f'{transcript.denials} tool calls were denied, which can hide skipped work.')
    return checks


def check_rules_accounted(case, directory, skills, transcript, check):
    rules = rule_index(skills)
    path = directory / 'artefacts' / 'rules.md'
    text = path.read_text() if path.exists() else ''
    missing = [title for title, link in rules if title not in text and Path(link).stem not in text]
    check('every rule accounted for', text and not missing,
          'Missing: ' + ', '.join(missing) if missing else f'All {len(rules)} rules listed.')
    if transcript:
        index_read = transcript.first_read('review-rules/rules/README.md') is not None
        check('rule index read', index_read, 'Rule index read.' if index_read else 'rules/README.md never read.')


def check_report_sections(case, directory, skills, transcript, check):
    path = directory / 'artefacts' / 'review-report.md'
    text = path.read_text() if path.exists() else ''
    absent = [section for section in REPORT_SECTIONS if section not in text]
    check('report sections', text and not absent,
          'Missing: ' + ', '.join(absent) if absent else 'All template sections present.')
    if transcript:
        written = transcript.first_write('review-report.md')
        edited = written is not None and any(position > written for position, _ in transcript.agents)
        check('editorial pass', edited, 'A subagent ran after the report was first saved.' if edited
              else 'No subagent ran after the report was first saved.')


def check_steps(case, directory, skills, transcript, check):
    """Each listed step's files are written in order, using its unit skill, and nothing else runs.

    A step marked "(no unit)" is written by the coordinator itself, such as a split-only report.
    """
    if not case.steps or transcript is None:
        return
    no_unit = {step.replace(NO_UNIT, '').strip() for step in case.steps if NO_UNIT in step}
    expected = [[name.strip() for name in step.replace(NO_UNIT, '').split(',')] for step in case.steps]
    listed = {name for step in expected for name in step}
    written = {name: transcript.first_write(name) for name in WORKFLOW_FILES}

    missing = [name for name in listed if written[name] is None]
    check('steps run', not missing, 'Not written: ' + ', '.join(missing) if missing else 'Every step ran.')
    extra = [name for name in WORKFLOW_FILES if name not in listed and written[name] is not None]
    check('no unexpected steps', not extra, 'Also wrote: ' + ', '.join(extra) if extra else 'No other steps ran.')

    order = [written[name] for step in expected for name in step if written[name] is not None]
    previous_end, out_of_order = -1, []
    for step in expected:
        positions = [written[name] for name in step if written[name] is not None]
        if positions and min(positions) < previous_end:
            out_of_order.append(', '.join(step))
        previous_end = max(positions + [previous_end])
    check('step order', not out_of_order and order,
          'Started before the previous step finished: ' + '; '.join(out_of_order) if out_of_order
          else 'Steps ran in order.')

    unread, undelegated = [], []
    for name in listed - no_unit:
        unit = UNIT_FOR_FILE[name]
        read = transcript.first_read(f'{unit}/SKILL.md')
        if read is None or (written[name] is not None and read > written[name]):
            unread.append(f'{unit} for {name}')
        if unit in DELEGATED_UNITS and not any(unit in prompt for _, prompt in transcript.agents):
            undelegated.append(unit)
    check('unit skills used', not unread, 'Not read first: ' + ', '.join(sorted(unread)) if unread
          else 'Each step read its unit skill before saving its output.')
    check('units delegated', not undelegated, 'No subagent was given: ' + ', '.join(sorted(set(undelegated)))
          if undelegated else 'Research, guidance, assessments and rules ran in subagents.')


UNIT_CHECKS = {
    'review': [check_steps],
    'review-rules': [check_rules_accounted],
    'review-report': [check_report_sections],
    'end-to-end': [check_rules_accounted, check_report_sections, check_steps],
}


# Commands


def command_list(args):
    _, cases = load_cases(args.cases)
    for case in cases:
        kind = f'{len(case.must_find)} to find' if case.must_find else 'steps' if case.steps else 'control'
        print(f'{case.name:60} {kind:10} {case.title}')


def command_build(args):
    units, cases = load_cases(args.cases)
    args.out.mkdir(parents=True, exist_ok=False)
    dirs = [build_case(case, units[case.unit], args.out, build_skills(args.out, units[case.unit], args.skills))
            for case in cases]
    print(f'Built {len(dirs)} cases in {args.out}')
    return units, cases, dirs


def command_run(args):
    units, cases, dirs = command_build(args)
    with ThreadPoolExecutor(args.jobs) as pool:
        list(pool.map(lambda pair: run_case(*pair, args), zip(cases, dirs)))
    command_grade(args, units, cases)


def command_grade(args, units=None, cases=None):
    if cases is None:
        units, cases = load_cases(args.cases)
        cases = [case for case in cases if case_dir(args.out, case).exists()]
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(
            lambda case: grade_case(case, units[case.unit], case_dir(args.out, case), args), cases))
    summarise(results, args.out)
    if not all(row['passed'] for row in results):
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest='command', required=True)
    for name, help_text in [('list', 'Validate and list cases.'),
                            ('build', 'Build cases and prompts without running them.'),
                            ('run', 'Build, run and grade cases.'),
                            ('grade', 'Grade outputs already saved in --out.')]:
        sub = commands.add_parser(name, help=help_text)
        sub.add_argument('cases', nargs='*',
                         help='Units, categories or cases, such as review-rules or review-assess/correctness.')
        if name == 'list':
            continue
        sub.add_argument('--out', type=Path, required=True, help='Run directory. build and run need a new path.')
        if name in ('build', 'run'):
            sub.add_argument('--skills', type=Path, default=SKILLS_DIR, help='Skills directory to test. Default: this checkout.')
        if name != 'build':
            sub.add_argument('--jobs', type=int, default=4, help='Cases to run or grade in parallel.')
            sub.add_argument('--grader', default=DEFAULT_GRADER, help=f'Grader command. Reads the prompt on stdin. Default: {DEFAULT_GRADER}')
            sub.add_argument('--timeout', type=int, default=3600, help='Seconds allowed per agent call.')
        if name == 'run':
            sub.add_argument('--agent', default=DEFAULT_AGENT, help=f'Agent command. Reads the prompt on stdin. Default: {DEFAULT_AGENT}')
    args = parser.parse_args()
    {'list': command_list, 'build': command_build, 'run': command_run, 'grade': command_grade}[args.command](args)


if __name__ == '__main__':
    main()
