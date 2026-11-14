"""Write the starter files from Appendix A of MASTERSPEC.md, exactly as they appear there.

Run from the repo root:
    python extract_starter.py                        every file
    python extract_starter.py backend                only paths that start with "backend"
    python extract_starter.py .gitignore pipeline    several prefixes
A file that already exists is left alone.
"""
import re
import sys
from pathlib import Path

HEADING = "## Appendix A. " + "Starter files, copied exactly"
spec = Path("MASTERSPEC.md").read_text(encoding="utf-8")
appendix = spec.split("\n" + HEADING + "\n", 1)[1]
wanted = sys.argv[1:]
for path, code in re.findall(r"^### `([^`]+)`\n\n```[a-z]*\n(.*?)\n```$", appendix, flags=re.S | re.M):
    if wanted and not any(path.startswith(prefix) for prefix in wanted):
        continue
    target = Path(path)
    if target.exists():
        print("kept ", path)
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(code + "\n", encoding="utf-8", newline="\n")
    print("wrote", path)
