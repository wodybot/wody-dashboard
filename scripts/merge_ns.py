import json, io

LOCALES = ["en", "ro", "fr", "de", "es", "it", "pt", "nl", "tr"]
BASE = "/home/claude/wody-project/wody-dashboard-main/messages/{}.json"


def merge_namespace(ns_key, data_by_locale):
    """data_by_locale: {locale: {key: value}}, merges (shallow, one level of
    nesting supported via dict values) into top-level messages[ns_key]."""
    for loc in LOCALES:
        path = BASE.format(loc)
        with io.open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        existing = d.get(ns_key, {})
        existing.update(data_by_locale[loc])
        d[ns_key] = existing
        with io.open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"Merged namespace '{ns_key}' into {len(LOCALES)} locale files.")
