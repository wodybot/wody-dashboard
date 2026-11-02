"""Merges scripts/messages_new/*.py into messages/<locale>.json.

Each module defines LANGS (the column order), ROWS = {"dotted.path": (en, ro, fr, it, de, es, pt, nl, tr)} (a value may be a list
for texts kept as arrays) and optionally PATCH = fn(data, lang_index) for edits of existing entries, and optionally ARRAYS = {"dotted.path.to.array": fn(lang_index) -> list of items to append (skipped when an
item with the same "key" is already there)}. Run again after editing a text: existing keys are overwritten.
Run:  python3 scripts/apply-messages.py
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ["en", "ro", "fr", "it", "de", "es", "pt", "nl", "tr"]


def put(tree, path, value):
    node = tree
    parts = path.split(".")
    for p in parts[:-1]:
        node = node.setdefault(p, {})
    node[parts[-1]] = value


def get(tree, path):
    node = tree
    for p in path.split("."):
        node = node[p]
    return node


def main() -> int:
    mods = []
    for f in sorted((ROOT / "scripts" / "messages_new").glob("*.py")):
        spec = importlib.util.spec_from_file_location(f.stem, f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mods.append(mod)
    for i, lang in enumerate(LANGS):
        path = ROOT / "messages" / f"{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for mod in mods:
            for key, values in getattr(mod, "ROWS", {}).items():
                if len(values) != 9:
                    print("bad row", key, len(values))
                    return 1
                put(data, key, values[i])
            for key, fn in getattr(mod, "ARRAYS", {}).items():
                arr = get(data, key)
                for item in fn(i):
                    marker = item.get("key") if isinstance(item, dict) else None
                    at = next((n for n, x in enumerate(arr) if marker and isinstance(x, dict) and x.get("key") == marker), None)
                    if at is None:
                        after = getattr(mod, "AFTER", {}).get(key, {}).get(marker)
                        pos = next((n + 1 for n, x in enumerate(arr) if isinstance(x, dict) and x.get("key") == after), len(arr)) if after else len(arr)
                        arr.insert(pos, item)
                    else:
                        arr[at] = item
        for mod in mods:
            if hasattr(mod, "PATCH"):
                mod.PATCH(data, i)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("messages updated for", len(LANGS), "languages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
