#!/usr/bin/env python3
"""Run review skill evals defined in cases/*.md.

Each case becomes a small Git repository with a base and head commit. A
reviewer agent reviews it blind with a copy of the skills, then a grader agent
checks the saved report against the case's "Must find" and "Must not flag"
criteria. Process checks then confirm from the reviewer's transcript and saved
files that the review followed every step of the skill.
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
CASES_DIR = ROOT / 'cases'
SKILLS_DIR = ROOT.parents[1] / 'skills'

# Runs from the run directory, so file access is limited to the case repos and the skills copy.
# The stream-json transcript records every tool call, including subagents', for the process checks.
DEFAULT_REVIEWER = ('claude -p --output-format stream-json --verbose --permission-mode acceptEdits '
                    '--allowedTools "Bash(git:*)"')
DEFAULT_GRADER = 'claude -p'

SECTIONS = {'requirements', 'before', 'after', 'must find', 'must not flag', 'must read'}
CASE_ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
CODE_BLOCK = re.compile(r'^```[\w-]*\s+file=(\S+)[^\n]*\n(.*?)^```\s*$', re.MULTILINE | re.DOTALL)


@dataclass
class Case:
    category: str
    id: str
    title: str
    requirements: str
    before: dict = field(default_factory=dict)
    after: dict = field(default_factory=dict)
    must_find: list = field(default_factory=list)
    must_not_flag: list = field(default_factory=list)
    must_read: list = field(default_factory=list)

    @property
    def name(self):
        return f'{self.category}/{self.id}'


# Parsing


def parse_category(path):
    category = path.stem
    chunks = re.split(r'^## ', path.read_text(), flags=re.MULTILINE)[1:]
    return [parse_case(category, chunk) for chunk in chunks]


def parse_case(category, chunk):
    heading, _, body = chunk.partition('\n')
    case_id, _, title = heading.partition(':')
    case = Case(category, case_id.strip(), title.strip(), '')
    where = f'{category}.md: {heading.strip()}'
    if not CASE_ID.match(case.id) or not case.title:
        raise ValueError(f'{where}: use "## kebab-case-id: Title"')

    sections = re.split(r'^### ', body, flags=re.MULTILINE)[1:]
    for section in sections:
        name, _, text = section.partition('\n')
        name = name.strip().lower()
        if name not in SECTIONS:
            raise ValueError(f'{where}: unknown section "### {name}"')
        if name == 'requirements':
            case.requirements = text.strip()
        elif name in ('before', 'after'):
            setattr(case, name, {path: code for path, code in CODE_BLOCK.findall(text)})
        else:
            bullets = [line[2:].strip().strip('`') for line in text.splitlines() if line.startswith('- ')]
            setattr(case, name.replace(' ', '_'), bullets)

    if not case.requirements:
        raise ValueError(f'{where}: missing "### Requirements"')
    if not case.after:
        raise ValueError(f'{where}: "### After" needs at least one ```lang file=path block')
    if not case.must_find and not case.must_not_flag:
        raise ValueError(f'{where}: add "### Must find" or "### Must not flag" bullets')
    return case


def load_cases(filters):
    cases = [case for path in sorted(CASES_DIR.glob('*.md')) for case in parse_category(path)]
    names = [case.name for case in cases]
    duplicates = {name for name in names if names.count(name) > 1}
    if duplicates:
        raise ValueError('Duplicate case ids: ' + ', '.join(sorted(duplicates)))
    if not filters:
        return cases
    selected = [case for case in cases if any(case.name == f or case.category == f for f in filters)]
    if not selected:
        raise SystemExit('No cases match: ' + ' '.join(filters))
    return selected


# Building


def git(path, *args):
    return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()


def write_files(repo, files):
    for relative, code in files.items():
        target = repo / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(code)


def build_case(case, out):
    case_dir = out / case.category / case.id
    repo = case_dir / 'repo'
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
    (case_dir / 'revisions.json').write_text(json.dumps({'base': base, 'head': head}) + '\n')
    (case_dir / 'prompt.md').write_text(reviewer_prompt(case, out, case_dir, base, head))
    return case_dir


def reviewer_prompt(case, out, case_dir, base, head):
    return f'''Review the change in {case_dir / 'repo'} from {base} to {head} using the review skill at {out / 'skills' / 'review' / 'SKILL.md'}.

PR title: {case.title}

PR description:
{case.requirements}

This is a local-only review of a local repository. There is no GitHub PR, CI, discussion, Slack, Notion or Linear context. Record those sources as unavailable and continue. Do not publish anything or modify the repository.

Use {case_dir / 'artefacts'} as the review artefact directory. Save the final report to {case_dir / 'review-report.md'}.
'''


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


def review_case(case, case_dir, args):
    print(f'Reviewing {case.name}', flush=True)
    run_agent(args.reviewer, (case_dir / 'prompt.md').read_text(), args.out,
              case_dir / 'transcript.jsonl', args.timeout)


def grader_prompt(case, report, diff):
    must_find = '\n'.join(f'{i}. {text}' for i, text in enumerate(case.must_find, 1)) or 'None.'
    must_not_flag = '\n'.join(f'{i}. {text}' for i, text in enumerate(case.must_not_flag, 1)) or 'None.'
    return f'''You are grading a code review report against fixed criteria.

Judge what the report actually says, not what it could have said. A finding counts when the report identifies the same problem and its consequence, even with different wording. A passing mention in a coverage table without a finding does not count. Optional suggestions and nits only violate a "must not flag" criterion when the criterion says so.

## Change under review

Title: {case.title}

Requirements:
{case.requirements}

```diff
{diff}
```

## Must find

{must_find}

## Must not flag

{must_not_flag}

## Review report

{report}

## Answer

Reply with only this JSON object:

{{"must_find": [{{"id": 1, "met": true, "evidence": "short quote from the report or why it is missing"}}],
 "must_not_flag": [{{"id": 1, "violated": false, "evidence": "short quote from the report, if violated"}}]}}
'''


def grade_case(case, case_dir, args):
    report_path = case_dir / 'review-report.md'
    process = check_process(case, case_dir)
    if not report_path.exists():
        return save_grade(case, case_dir, {'error': 'No review report was saved.'}, process)
    repo = case_dir / 'repo'
    diff = git(repo, 'diff', 'HEAD~1', 'HEAD')
    output = run_agent(args.grader, grader_prompt(case, report_path.read_text(), diff), case_dir,
                       case_dir / 'grader.log', args.timeout)
    try:
        grade = json.loads(output[output.index('{'):output.rindex('}') + 1])
    except ValueError:
        grade = {'error': 'Grader did not return JSON. See grader.log.'}
    return save_grade(case, case_dir, grade, process)


def save_grade(case, case_dir, grade, process=()):
    # Index rows by criterion id, ignoring any the grader invents for criteria that don't exist.
    found = {row.get('id'): row for row in grade.get('must_find', [])}
    flags = {row.get('id'): row for row in grade.get('must_not_flag', [])}
    ungraded = [text for i, text in enumerate(case.must_find, 1) if i not in found] \
        + [text for i, text in enumerate(case.must_not_flag, 1) if i not in flags]
    error = grade.get('error') or (f'Grader skipped: {"; ".join(ungraded)}' if ungraded else None)
    missed = [text for i, text in enumerate(case.must_find, 1) if i in found and not found[i].get('met')]
    flagged = [text for i, text in enumerate(case.must_not_flag, 1) if i in flags and flags[i].get('violated')]
    findings_passed = not error and not missed and not flagged
    process_failures = [check for check in process if not check['passed']]
    result = {'case': case.name, 'title': case.title, 'passed': findings_passed and not process_failures,
              'findings_passed': findings_passed, 'process_passed': not process_failures,
              'missed': missed, 'wrongly_flagged': flagged, 'error': error,
              'process': list(process), 'grade': grade}
    (case_dir / 'grade.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def summarise(results, out):
    passed = sum(row['passed'] for row in results)
    lines = [f'# Review evals: {passed}/{len(results)} passed', '',
             '| Case | Findings | Process | Notes |', '| --- | --- | --- | --- |']
    for row in results:
        notes = [f'Missed: {text}' for text in row['missed']]
        notes += [f'Wrongly flagged: {text}' for text in row['wrongly_flagged']]
        notes += [row['error']] if row['error'] else []
        notes += [f"Step skipped: {check['check']}: {check['detail']}" for check in row['process'] if not check['passed']]
        cell = '<br>'.join(text.replace('|', '\\|') for text in notes)
        mark = lambda passed: 'Pass' if passed else 'Fail'
        lines.append(f"| {row['case']} | {mark(row['findings_passed'])} | {mark(row['process_passed'])} | {cell} |")
    summary = '\n'.join(lines) + '\n'
    (out / 'summary.md').write_text(summary)
    (out / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(summary)


# Process checks
#
# Each check is one step the review skill requires. Evidence comes from the
# reviewer's stream-json transcript and the files it saved, never from what the
# report claims.

ASSESSMENTS = ['risk.md', 'research.md', 'product.md', 'system-fit.md', 'simplicity.md',
               'readability.md', 'correctness.md', 'rules.md']
REPORT_SECTIONS = ['## Assessment', '### Risk and scope', '## Findings', '## Verification summary',
                   '## References', '## Supporting details']
# Research, five review questions, the rule pass and the editorial pass.
MIN_SUBAGENTS = 8
LOCAL_CHECK = re.compile(r'(^|[\s;&|(])(npm|pnpm|yarn|npx|node|tsc|vitest|jest|eslint|bun|deno)\s')
RULE_LINK = re.compile(r'^\| \[(.+?)\]\((.+?\.md)\)', re.MULTILINE)


@dataclass
class Transcript:
    agents: list = field(default_factory=list)   # (position, prompt) for subagents the parent launched
    reads: list = field(default_factory=list)    # file paths read, or shell commands, by any agent
    writes: list = field(default_factory=list)   # (position, path) for files written by any agent
    commands: list = field(default_factory=list)
    denials: int = 0


def read_transcript(path):
    transcript = Transcript()
    if not path.exists():
        return None
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
                transcript.reads.append(tool_input.get('file_path', ''))
            elif name in ('Write', 'Edit'):
                transcript.writes.append((position, tool_input.get('file_path', '')))
            elif name == 'Bash':
                transcript.commands.append(tool_input.get('command', ''))
                transcript.reads.append(tool_input.get('command', ''))
    return transcript if transcript.agents or transcript.reads or transcript.commands else None


def check_process(case, case_dir):
    out = case_dir.parent.parent
    artefacts = case_dir / 'artefacts'
    transcript = read_transcript(case_dir / 'transcript.jsonl')
    checks = []

    def check(name, passed, detail):
        checks.append({'check': name, 'passed': bool(passed), 'detail': detail})

    def was_read(relative):
        return transcript and any(f'skills/{relative}' in entry for entry in transcript.reads)

    def first_write(name):
        positions = [position for position, path in transcript.writes if path.endswith(name)] if transcript else []
        return min(positions, default=None)

    missing = [name for name in ASSESSMENTS if not (artefacts / name).exists()]
    check('saved assessments', not missing, 'Missing: ' + ', '.join(missing) if missing else 'All saved.')

    report = case_dir / 'review-report.md'
    text = report.read_text() if report.exists() else ''
    absent = [section for section in REPORT_SECTIONS if section not in text]
    check('report sections', report.exists() and not absent,
          'Missing: ' + ', '.join(absent) if absent else 'All template sections present.')

    rules = RULE_LINK.findall((out / 'skills/review/rules/README.md').read_text())
    rule_text = (artefacts / 'rules.md').read_text() if (artefacts / 'rules.md').exists() else ''
    unaccounted = [title for title, link in rules if title not in rule_text and Path(link).stem not in rule_text]
    check('every rule accounted for', rule_text and not unaccounted,
          'Missing: ' + ', '.join(unaccounted) if unaccounted else f'All {len(rules)} rules listed.')

    revisions = json.loads((case_dir / 'revisions.json').read_text())
    repo = case_dir / 'repo'
    changed = git(repo, 'status', '--porcelain') or git(repo, 'rev-parse', 'HEAD') != revisions['head']
    check('no code changes', not changed, 'The repository was modified.' if changed else 'Repository unchanged.')

    if transcript is None:
        check('transcript', False, 'No stream-json transcript, so the remaining steps cannot be verified.')
        return checks

    check('subagents', len(transcript.agents) >= MIN_SUBAGENTS,
          f'{len(transcript.agents)} launched. Expected at least {MIN_SUBAGENTS}: research, five review '
          'questions, the rule pass and the editorial pass.')

    research = first_write('research.md')
    check('research delegated', research is not None and any(p < research for p, _ in transcript.agents),
          'A subagent ran before research.md was saved.' if research is not None else 'research.md never written.')

    skills = sorted({re.search(r'best-practices/[\w-]+', entry).group(0) for entry in transcript.reads
                     if re.search(r'skills/best-practices/[\w-]+/SKILL\.md', entry)})
    check('best-practice skills', skills, 'Read: ' + ', '.join(skills) if skills else 'None read.')

    unread = [link for _, link in rules if not was_read(f'review/rules/{link}')]
    check('rule index', was_read('review/rules/README.md'), 'Rule index read.' if was_read('review/rules/README.md')
          else 'rules/README.md never read.')

    report_written = first_write('review-report.md')
    check('editorial pass', report_written is not None and any(p > report_written for p, _ in transcript.agents),
          'A subagent ran after the report was first saved.' if report_written is not None
          else 'review-report.md never written.')

    local = [command for command in transcript.commands if LOCAL_CHECK.search(command)]
    check('no local checks', not local, 'Ran: ' + '; '.join(local) if local else 'No builds, tests or linters run.')

    unread_required = [path for path in case.must_read if not was_read(path)]
    if case.must_read:
        check('required guidance read', not unread_required,
              'Not read: ' + ', '.join(unread_required) if unread_required else 'All read.')

    checks.append({'check': 'rule files read', 'passed': True, 'info': True,
                   'detail': f'{len(rules) - len(unread)}/{len(rules)} rule files read. '
                             f'{transcript.denials} permission denials.'})
    return checks


# Commands


def command_list(args):
    for case in load_cases(args.cases):
        kind = 'control' if not case.must_find else f'{len(case.must_find)} to find'
        print(f'{case.name:50} {kind:12} {case.title}')


def command_build(args):
    cases = load_cases(args.cases)
    args.out.mkdir(parents=True, exist_ok=False)
    # Reviewers get a copy of the skills so they cannot read the expected answers.
    shutil.copytree(args.skills, args.out / 'skills')
    dirs = [build_case(case, args.out) for case in cases]
    print(f'Built {len(dirs)} cases in {args.out}')
    return cases, dirs


def command_run(args):
    cases, dirs = command_build(args)
    with ThreadPoolExecutor(args.jobs) as pool:
        list(pool.map(lambda pair: review_case(*pair, args), zip(cases, dirs)))
    command_grade(args, cases)


def command_grade(args, cases=None):
    cases = cases or [case for case in load_cases(args.cases)
                      if (args.out / case.category / case.id / 'repo').exists()]
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(lambda case: grade_case(case, args.out / case.category / case.id, args), cases))
    summarise(results, args.out)
    if not all(row['passed'] for row in results):
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest='command', required=True)
    for name, help_text in [('list', 'Validate and list cases.'),
                            ('build', 'Build case repositories and reviewer prompts without running.'),
                            ('run', 'Build, review and grade cases.'),
                            ('grade', 'Grade reports already saved in --out.')]:
        sub = commands.add_parser(name, help=help_text)
        sub.add_argument('cases', nargs='*', help='Categories or case names, such as valtio or valtio/mutate-snapshot.')
        if name == 'list':
            continue
        sub.add_argument('--out', type=Path, required=True, help='Run directory. build and run need a new path.')
        if name in ('build', 'run'):
            sub.add_argument('--skills', type=Path, default=SKILLS_DIR, help='Skills directory to review with. Default: this checkout.')
        if name != 'build':
            sub.add_argument('--jobs', type=int, default=4, help='Cases to review or grade in parallel.')
            sub.add_argument('--grader', default=DEFAULT_GRADER, help=f'Grader command. Reads the prompt on stdin. Default: {DEFAULT_GRADER}')
            sub.add_argument('--timeout', type=int, default=3600, help='Seconds allowed per agent call.')
        if name == 'run':
            sub.add_argument('--reviewer', default=DEFAULT_REVIEWER, help=f'Reviewer command. Reads the prompt on stdin. Default: {DEFAULT_REVIEWER}')
    args = parser.parse_args()
    {'list': command_list, 'build': command_build, 'run': command_run, 'grade': command_grade}[args.command](args)


if __name__ == '__main__':
    main()
