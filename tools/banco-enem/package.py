"""Junta extração + gabarito + classificação no formato do app e copia as figuras."""
import json, os, re, shutil
from PIL import Image
from taxonomy import T, T1, AREA

REPO = "/home/claude/deixa-que-eu-corrijo-"
PUB = os.path.join(REPO, "public/banco/enem")
DATA = os.path.join(REPO, "src/data/banco")
os.makedirs(DATA, exist_ok=True)
if os.path.isdir(PUB):
    shutil.rmtree(PUB)
os.makedirs(PUB)

IDX = [(d, t, s) for d, tops in T.items() for t, subs in tops.items() for s in subs]
IDX1 = [(d, t, s) for d, tops in T1.items() for t, subs in tops.items() for s in subs]
gab = json.load(open("gabaritos.json"))
gab1 = json.load(open("gabaritos1.json"))
SCALE = {2019: 0.65, 2021: 0.65}  # provas ampliadas: figuras medidas em página maior

# classificação revisada à mão (manual.txt): "ano" e "num:codigo,codigo"
def read_manual(path):
    m, cur = {}, None
    for line in open(path):
        line = line.strip()
        if re.fullmatch(r"\d{4}", line):
            cur = line
            continue
        for tok in line.split():
            n, codes = tok.split(":")
            m[f"{cur}-{n}"] = [int(c) for c in codes.split(",")]
    return m


manual = read_manual("manual.txt")
manual1 = read_manual("manual1.txt")


def clean(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+(\^|_)\{", r"\1{", s)
    s = re.sub(r"(\^|_)\{\s*([^{}]*?)\s*\}", lambda m: m.group(1) + "{" + re.sub(r"\s+", "", m.group(2)) + "}", s)
    s = s.replace("–", "–")
    return s


def save_img(src, year, base="out"):
    """Converte a figura (cinza → 8 bits; cor → paleta) e devolve o caminho público."""
    name = os.path.basename(src)
    im = Image.open(os.path.join(base, "img", src)).convert("RGB")
    small = im.resize((64, 64))
    px = list(small.getdata())
    gray = all(abs(r - g) < 10 and abs(g - b) < 10 for r, g, b in px)
    q = im.convert("L") if gray else im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    os.makedirs(os.path.join(PUB, str(year)), exist_ok=True)
    q.save(os.path.join(PUB, str(year), name), optimize=True)
    return f"/banco/enem/{year}/{name}"


def blocks_text(blocks, year, base="out"):
    parts = []
    for b in blocks:
        if b["t"] == "img":
            w = b["wmm"]
            if base == "out1" and year in SCALE:
                w = round(min(180.0, w * SCALE[year]), 1)
            parts.append(f"[[img:{save_img(b['src'], year, base)}|{w}]]")
        else:
            t = clean(b["s"])
            if t:
                parts.append(t)
    return "\n".join(parts)


out = []
LC, CH = "Linguagens, Códigos e suas Tecnologias", "Ciências Humanas e suas Tecnologias"
for y in range(2017, 2026):
    for q in json.load(open(f"out1/{y}.json")):
        n, k = q["number"], q["key"]
        area = LC if n <= 45 else CH
        tags = [list(IDX1[c - 1]) for c in manual1[f"{y}-{k}"]]
        tags.sort(key=lambda t: AREA[t[0]] != area)  # disciplina principal = da área da questão
        disc = tags[0][0]
        if q.get("lang") == "i":
            disc = "Língua Inglesa"
        elif q.get("lang") == "e":
            disc = "Língua Espanhola"
        opts = {o["label"]: blocks_text(o["blocks"], y, "out1") for o in q["options"]}
        ans = gab1[str(y)][k]
        suf = q.get("lang") or ""
        e = {
            "id": f"enem-{y}-{n:03d}{suf}",
            "y": y,
            "n": n,
            "area": area,
            "d": disc,
            "tags": tags,
            "st": blocks_text(q["statement"], y, "out1"),
            "op": [opts.get(l, "") for l in "ABCDE"],
            "ans": None if ans == "X" else ans,
            "nul": ans == "X",
        }
        if suf:
            e["lang"] = suf
        out.append(e)
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
tax = [{"d": d, "topics": [{"t": t, "subs": list(subs)} for t, subs in tops.items()]} for d, tops in list(T1.items()) + list(T.items())]
json.dump(tax, open(os.path.join(DATA, "taxonomia.json"), "w"), ensure_ascii=False, indent=1)
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(PUB) for f in fs)
print(len(out), "questões;", os.path.getsize(os.path.join(DATA, "enem.json")) // 1024, "KB de dados;", size // 1024, "KB de figuras")
