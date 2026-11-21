#!/usr/bin/env python3
"""
Собирает частотный словарь европейского португальского для LusoLearn.

Источник рангов: частотный список словоформ из субтитров OpenSubtitles (pt),
https://github.com/hermitdave/FrequencyWords (content/2018/pt/pt_50k.txt).
Леммы и русские переводы — вручную, в scripts/frequency/lemmas/*.txt.

Частота леммы = сумма частот всех её словоформ (спряжения, множественное число,
род). Если словоформа сама является заглавным словом другой леммы (например,
«casa» — и существительное, и форма глагола casar), она засчитывается только
этой лемме.

Использование:
    python3 scripts/frequency/build.py path/to/pt_50k.txt [--gaps 300]
Результат: data/frequencyDictionary.json
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEMMA_DIR = Path(__file__).resolve().parent / "lemmas"
WEIGHTS = Path(__file__).resolve().parent / "weights.txt"
OUT = ROOT / "data" / "frequencyDictionary.json"

ARTICLES = ("o ", "a ", "os ", "as ")
POS_ALLOWED = {"verb", "noun", "adj", "adv", "pron", "prep", "conj", "det", "num", "interj", "phrase"}


def strip_article(word: str) -> str:
    for art in ARTICLES:
        if word.startswith(art) and len(word) > len(art) + 1:
            return word[len(art):]
    return word


def verb_forms(inf: str) -> list[str]:
    if len(inf) < 3:
        return []
    stem, ending = inf[:-2], inf[-2:]
    if ending == "ar":
        suf = ["o", "as", "a", "amos", "ámos", "am", "ei", "aste", "ou", "aram", "ava", "avas", "ávamos", "avam",
               "arei", "arás", "ará", "aremos", "arão", "aria", "arias", "aríamos", "ariam", "e", "es", "emos", "em",
               "asse", "asses", "ássemos", "assem", "ares", "armos", "arem", "ado", "ada", "ados", "adas", "ando"]
    elif ending == "er":
        suf = ["o", "es", "e", "emos", "em", "i", "este", "eu", "eram", "ia", "ias", "íamos", "iam",
               "erei", "erás", "erá", "eremos", "erão", "eria", "erias", "eríamos", "eriam", "a", "as", "amos", "am",
               "esse", "essem", "eres", "ermos", "erem", "ido", "ida", "idos", "idas", "endo"]
    elif ending == "ir":
        suf = ["o", "es", "e", "imos", "em", "i", "iste", "iu", "iram", "ia", "ias", "íamos", "iam",
               "irei", "irás", "irá", "iremos", "irão", "iria", "irias", "iríamos", "iriam", "a", "as", "amos", "am",
               "isse", "issem", "ires", "irmos", "irem", "ido", "ida", "idos", "idas", "indo"]
    else:
        return []
    return [stem + s for s in suf]


def noun_plural(w: str) -> list[str]:
    if w.endswith("ão"):
        return [w[:-2] + "ões"]
    if w.endswith(("a", "e", "i", "o", "u", "á", "é", "ê", "ó", "ô")):
        return [w + "s"]
    if w.endswith(("r", "z", "s")):
        return [w + "es"] if not w.endswith("s") else []
    if w.endswith("al"):
        return [w[:-2] + "ais"]
    if w.endswith("el"):
        return [w[:-2] + "éis"]
    if w.endswith("ol"):
        return [w[:-2] + "óis"]
    if w.endswith("il"):
        return [w[:-1] + "s"]
    if w.endswith("m"):
        return [w[:-1] + "ns"]
    return []


def adj_forms(w: str) -> list[str]:
    if w.endswith("o"):
        return [w[:-1] + "a", w + "s", w[:-1] + "as"]
    return noun_plural(w)


def load_freq(path: Path) -> dict[str, int]:
    freq: dict[str, int] = defaultdict(int)
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) != 2:
                continue
            word, count = parts[0].lower(), int(parts[1])
            freq[word] += count
            if "-" in word:  # deixa-me -> deixa + me
                for piece in word.split("-"):
                    if piece:
                        freq[piece] += count
    return freq


def load_lemmas() -> list[dict]:
    entries, seen = [], set()
    for file in sorted(LEMMA_DIR.glob("*.txt")):
        for lineno, raw in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            while len(parts) < 4:
                parts.append("")
            word, pos, ru, extra = parts[:4]
            if not ru or ru == "—":
                continue
            irregular = pos.endswith("!")
            pos = pos.rstrip("!")
            if pos not in POS_ALLOWED:
                print(f"WARN {file.name}:{lineno} unknown pos '{pos}'", file=sys.stderr)
                continue
            key = (word.lower(), pos)
            if key in seen:
                print(f"WARN duplicate lemma {word} ({pos})", file=sys.stderr)
                continue
            seen.add(key)
            entries.append({"word": word, "pos": pos, "ru": ru, "irregular": irregular,
                            "extra": [f.lower() for f in extra.split() if f]})
    return entries


def load_weights(entries: list[dict]) -> dict[int, tuple[float, str | None]]:
    """weights.txt: @down <k> / @topic <code> <k>, then comma-separated lemmas."""
    index = {e["word"]: i for i, e in enumerate(entries)}
    result: dict[int, tuple[float, str | None]] = {}
    factor, topic = 1.0, None
    for raw in WEIGHTS.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("@"):
            parts = line[1:].split()
            if parts[0] == "down":
                factor, topic = float(parts[1]), None
            elif parts[0] == "topic":
                topic, factor = parts[1], float(parts[2])
            continue
        for word in (w.strip() for w in line.split(",")):
            if not word:
                continue
            if word not in index:
                print(f"WARN weights: unknown lemma '{word}'", file=sys.stderr)
                continue
            if index[word] in result:
                print(f"WARN weights: '{word}' listed twice", file=sys.stderr)
            result[index[word]] = (factor, topic)
    return result


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    freq = load_freq(Path(sys.argv[1]))
    gaps_n = int(sys.argv[sys.argv.index("--gaps") + 1]) if "--gaps" in sys.argv else 0
    entries = load_lemmas()

    headwords: dict[str, list[int]] = defaultdict(list)
    for i, e in enumerate(entries):
        base = strip_article(e["word"]).lower()
        e["base"] = base
        if " " not in base:
            headwords[base].append(i)

    claims: dict[str, set[int]] = defaultdict(set)
    for i, e in enumerate(entries):
        base = e["base"]
        if " " in base:
            continue
        forms = {base, *e["extra"]}
        if e["pos"] == "verb" and not e["irregular"]:
            forms.update(verb_forms(base))
        elif e["pos"] == "noun":
            forms.update(noun_plural(base))
        elif e["pos"] == "adj":
            forms.update(adj_forms(base))
        for f in forms:
            claims[f].add(i)

    scores = [0.0] * len(entries)
    for form, owners in claims.items():
        count = freq.get(form, 0)
        if not count:
            continue
        heads = [i for i in headwords.get(form, []) if i in owners]
        winners = heads or list(owners)
        for i in winners:
            scores[i] += count / len(winners)

    # Многословные выражения: по самому редкому слову, с понижающим коэффициентом
    for i, e in enumerate(entries):
        if " " in e["base"]:
            tokens = [t for t in re.split(r"[\s-]+", e["base"]) if t]
            scores[i] = min(freq.get(t, 0) for t in tokens) * 0.15 + sum(freq.get(f, 0) for f in e["extra"]) * 0.2

    # Поправки под быт: ранжируем по скорректированной частоте, ipm остаётся честным
    weights = load_weights(entries)
    adjusted = [scores[i] * weights.get(i, (1.0, None))[0] for i in range(len(entries))]
    order = sorted(range(len(entries)), key=lambda i: -adjusted[i])
    total = sum(freq.values())
    out = []
    for rank, i in enumerate(order, 1):
        e = entries[i]
        item = {"r": rank, "w": e["word"], "ru": e["ru"], "p": e["pos"],
                "ipm": round(scores[i] / total * 1_000_000, 1)}
        if e["irregular"] and e["pos"] == "verb":
            item["irr"] = True
        topic = weights.get(i, (1.0, None))[1]
        if topic:
            item["t"] = topic
        out.append(item)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    covered = sum(freq.get(f, 0) for f in claims)
    print(f"{len(out)} lemmas -> {OUT.relative_to(ROOT)}; token coverage {covered / total:.1%}")

    if gaps_n:
        missing = [(w, c) for w, c in sorted(freq.items(), key=lambda x: -x[1])
                   if w not in claims and "-" not in w and w.isalpha()][:gaps_n]
        print("TOP MISSING:", " ".join(w for w, _ in missing))


if __name__ == "__main__":
    main()
