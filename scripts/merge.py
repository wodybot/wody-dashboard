import json, sys, io

LOCALES = ["en", "ro", "fr", "de", "es", "it", "pt", "nl", "tr"]
BASE = "/home/claude/work/wody-dashboard/messages/{}.json"

def merge_panel(panel_key, data_by_locale):
    """data_by_locale: {locale: {key: value}}"""
    for loc in LOCALES:
        path = BASE.format(loc)
        with io.open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        d.setdefault("guildSettings", {})
        existing = d["guildSettings"].get(panel_key, {})
        existing.update(data_by_locale[loc])
        d["guildSettings"][panel_key] = existing
        with io.open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"Merged panel '{panel_key}' into {len(LOCALES)} locale files.")

if __name__ == "__main__":
    pass
