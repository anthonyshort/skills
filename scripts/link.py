#!/usr/bin/env python3
"""Link the checkout into the shared agent and Claude Code skill directories."""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home(), help="Agent home directory (defaults to your home)")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent.parent / "skills"
    destinations = [args.home / ".agents/skills", args.home / ".claude/skills"]
    links = [(directory / skill.name, skill) for directory in destinations
             for skill in sorted(path.parent for path in source.rglob("SKILL.md"))]
    conflicts = [destination for destination, skill in links
                 if (destination.exists() or destination.is_symlink())
                 and not (destination.is_symlink() and destination.resolve() == skill.resolve())]
    if conflicts:
        parser.exit(1, "Existing skills would be overwritten; resolve these first:\n"
                    + "".join(f"  {destination}\n" for destination in conflicts))
    for destination, skill in links:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.is_symlink():
            destination.symlink_to(skill, target_is_directory=True)
        print(f"{destination} -> {skill}")


if __name__ == "__main__":
    main()
