"""Junta extração + gabarito + classificação no formato do app e copia as figuras."""
import json, os, re, shutil
from PIL import Image
from taxonomy import T, AREA

REPO = "/home/claude/deixa-que-eu-corrijo-"
PUB = os.path.join(REPO, "public/banco/enem")
DATA = os.path.join(REPO, "src/data/banco")
os.makedirs(DATA, exist_ok=True)
if os.path.isdir(PUB):
    shutil.rmtree(PUB)
os.makedirs(PUB)

IDX = [(d, t, s) for d, tops in T.items() for t, subs in tops.items() for s in subs]
gab = json.load(open("gabaritos.json"))

# classificação revisada à mão (manual.txt): "ano" e "num:codigo,codigo"
manual, cur = {}, None
for line in open("manual.txt"):
    line = line.strip()
    if re.fullmatch(r"\d{4}", line):
        cur = line
        continue
    for tok in line.split():
        n, codes = tok.split(":")
        manual[f"{cur}-{n}"] = [int(c) for c in codes.split(",")]


def clean(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+(\^|_)\{", r"\1{", s)
    s = re.sub(r"(\^|_)\{\s*([^{}]*?)\s*\}", lambda m: m.group(1) + "{" + re.sub(r"\s+", "", m.group(2)) + "}", s)
    s = s.replace("–", "–")
    return s


def save_img(src, year):
    """Converte a figura (cinza → 8 bits; cor → paleta) e devolve o caminho público."""
    name = os.path.basename(src)
    im = Image.open(os.path.join("out/img", src)).convert("RGB")
    small = im.resize((64, 64))
    px = list(small.getdata())
    gray = all(abs(r - g) < 10 and abs(g - b) < 10 for r, g, b in px)
    q = im.convert("L") if gray else im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    os.makedirs(os.path.join(PUB, str(year)), exist_ok=True)
    q.save(os.path.join(PUB, str(year), name), optimize=True)
    return f"/banco/enem/{year}/{name}"


def blocks_text(blocks, year):
    parts = []
    for b in blocks:
        if b["t"] == "img":
            parts.append(f"[[img:{save_img(b['src'], year)}|{b['wmm']}]]")
        else:
            t = clean(b["s"])
            if t:
                parts.append(t)
    return "\n".join(parts)


out = []
for y in range(2017, 2026):
    for q in json.load(open(f"out/{y}.json")):
        n = q["number"]
        key = f"{y}-{n}"
        codes = manual[key]
        tags = [list(IDX[c - 1]) for c in codes]
        disc = tags[0][0]
        opts = {o["label"]: blocks_text(o["blocks"], y) for o in q["options"]}
        ans = gab[str(y)][str(n)]
        out.append({
            "id": f"enem-{y}-{n:03d}",
            "y": y,
            "n": n,
            "area": AREA[disc] if n < 136 else "Matemática e suas Tecnologias",
            "d": disc,
            "tags": tags,
            "st": blocks_text(q["statement"], y),
            "op": [opts.get(l, "") for l in "ABCDE"],
            "ans": None if ans == "X" else ans,
            "nul": ans == "X",
        })

json.dump(out, open(os.path.join(DATA, "enem.json"), "w"), ensure_ascii=False, separators=(",", ":"))
tax = [{"d": d, "topics": [{"t": t, "subs": list(subs)} for t, subs in tops.items()]} for d, tops in T.items()]
json.dump(tax, open(os.path.join(DATA, "taxonomia.json"), "w"), ensure_ascii=False, indent=1)
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(PUB) for f in fs)
print(len(out), "questões;", os.path.getsize(os.path.join(DATA, "enem.json")) // 1024, "KB de dados;", size // 1024, "KB de figuras")
