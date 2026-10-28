"""Self-contained distribution test for the librarian skill.

Standard library only. A consumer may redistribute exactly this skill
directory, with no repository checkout or sibling skill alongside it, so the
test copies the directory into a temporary consumer root and checks that the
copy carries its runtime files and legal notices without escaping itself.
"""

import re
import shutil
import tempfile
import unittest
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]

RUNTIME_FILES = (
    "SKILL.md",
    "references/role.md",
    "LICENSE.txt",
    "NOTICE.md",
)

URI_SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
FENCE_MARKER = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
INLINE_CODE = re.compile(r"`[^`\n]*`")
LINK_TARGET = re.compile(r"\]\(\s*<?([^)\s>]+)>?(?:\s+[\"'][^\"']*[\"'])?\s*\)")


def markdown_prose(path: Path) -> str:
    """Return Markdown text with fenced blocks and inline code removed."""
    prose = []
    fence = None
    for line in path.read_text(encoding="utf-8").splitlines():
        marker = FENCE_MARKER.match(line)
        if fence is None:
            if marker:
                fence = (marker.group(1)[0], len(marker.group(1)))
                continue
            prose.append(line)
        elif marker and marker.group(1)[0] == fence[0] and len(marker.group(1)) >= fence[1]:
            fence = None
    return INLINE_CODE.sub("", "\n".join(prose))


def local_markdown_links(path: Path) -> list:
    """Return the relative link targets a Markdown file depends on.

    External URLs and pure anchors are skipped; code-fenced placeholders are
    ignored because they are examples, not real dependencies.
    """
    links = []
    for match in LINK_TARGET.finditer(markdown_prose(path)):
        target = match.group(1)
        if URI_SCHEME.match(target) or target.startswith("#"):
            continue
        target = target.split("#", 1)[0].split("?", 1)[0]
        if target:
            links.append(target)
    return links


class SelfContainedDistributionTests(unittest.TestCase):
    def collect_local_dependencies(self, copy_root: Path, entry: Path) -> set:
        """Resolve every local Markdown dependency reachable from ``entry``.

        Each dependency must stay inside ``copy_root`` and exist; Markdown
        targets are followed so a notice's own links are covered too.
        """
        copy_root = copy_root.resolve()
        referenced = set()
        checked = set()
        pending = [entry]
        while pending:
            source = pending.pop()
            if source in checked:
                continue
            checked.add(source)
            for target in local_markdown_links(source):
                resolved = (source.parent / target).resolve()
                self.assertTrue(
                    resolved == copy_root or copy_root in resolved.parents,
                    f"{source} references {target} outside the standalone copy",
                )
                self.assertTrue(
                    resolved.is_file(), f"{source} references missing file {target}"
                )
                referenced.add(resolved)
                if resolved.suffix.lower() == ".md" and resolved not in checked:
                    pending.append(resolved)
        return referenced

    def test_single_skill_directory_copy_is_self_contained(self):
        root = Path(tempfile.mkdtemp(prefix="librarian-skill-"))
        self.addCleanup(shutil.rmtree, root, True)
        # A consumer may redistribute exactly this directory, with no
        # repository checkout or sibling skill alongside it.
        copied = root / "consumer" / "librarian"
        shutil.copytree(SKILL_ROOT, copied, symlinks=True)

        for relative in RUNTIME_FILES:
            self.assertTrue(
                (copied / relative).is_file(),
                f"standalone copy is missing {relative}",
            )

        referenced = self.collect_local_dependencies(copied, copied / "SKILL.md")
        for legal in ("LICENSE.txt", "NOTICE.md"):
            self.assertIn(
                (copied / legal).resolve(),
                referenced,
                f"SKILL.md does not reach its local {legal}",
            )


if __name__ == "__main__":
    unittest.main()
