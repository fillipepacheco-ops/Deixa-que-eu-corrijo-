"""Classifica as questões extraídas: área > disciplina > tópico > subtópico(s)."""
import json, re, sys, collections
from taxonomy import T, AREA

COMP = {d: {t: {s: [re.compile(p, re.I) for p in ps] for s, ps in subs.items()} for t, subs in tops.items()} for d, tops in T.items()}

# palavras que puxam a disciplina em Ciências da Natureza
DISC_HINT = {
    "Física": [r"\bvelocidade\b", r"\bfor[çc]a\b", r"\benergia\b", r"\bcorrente\b", r"\btens[ãa]o\b", r"\bondas?\b", r"\bluz\b", r"\bcalor\b", r"\btemperatura\b", r"\bpress[ãa]o\b", r"\bpot[êe]ncia\b", r"\bfrequ[êe]ncia\b", r"\bm/s\b", r"\bresist", r"\bcircuito", r"\bespelho", r"\blente", r"\bsom\b", r"\bmassa\b", r"\bacelera"],
    "Química": [r"\brea[çc][ãa]o\b", r"\bmol\b", r"\bsolu[çc][ãa]o\b", r"\b[áa]cid", r"\b[íi]ons?\b", r"\bmol[ée]cula", r"\bsubst[âa]ncia", r"\bcomposto", r"\belemento qu[íi]mico", r"\bqu[íi]mic", r"\b[CHNOS]_\{\d", r"\bcarbono", r"\boxig[êe]nio\b", r"\bhidrog[êe]nio\b", r"\bpH\b", r"\bconcentra[çc]", r"\bf[óo]rmula estrutural", r"\bcombust[ãa]o"],
    "Biologia": [r"\bc[ée]lula", r"\bgen[ée]tic", r"\bDNA\b", r"\besp[ée]cies?\b", r"\borganismo", r"\bplanta", r"\banima", r"\bdoen[çc]a", r"\bv[íi]rus", r"\bbact[ée]ri", r"\becol[óo]g", r"\bbioma", r"\bhorm[ôo]n", r"\bprote[íi]na", r"\bpopula[çc][ãa]o\b", r"\bevolu", r"\bsangue", r"\bvacina", r"\bsa[úu]de", r"\bindiv[íi]duos?\b"],
}
DISC_HINT = {d: [re.compile(p, re.I) for p in ps] for d, ps in DISC_HINT.items()}


def text_of(q):
    parts = [b["s"] for b in q["statement"] if b["t"] == "p" and not b.get("src")]
    opts = [b["s"] for o in q["options"] for b in o["blocks"] if b["t"] == "p"]
    return " ".join(parts), " ".join(opts)


def score_disc(d, st, op):
    tot = 0.0
    for t, subs in COMP[d].items():
        for s, ps in subs.items():
            for p in ps:
                tot += len(p.findall(st)) * 1.0 + len(p.findall(op)) * 0.6
    tot += sum(len(p.findall(st)) + 0.6 * len(p.findall(op)) for p in DISC_HINT.get(d, [])) * 1.5
    return tot


def classify(q):
    st, op = text_of(q)
    n = q["number"]
    if n >= 136:
        disc = "Matemática"
    else:
        sc = {d: score_disc(d, st, op) for d in ("Física", "Química", "Biologia")}
        disc = max(sc, key=sc.get)
    scores = []
    for t, subs in COMP[disc].items():
        for s, ps in subs.items():
            v = 0.0
            for p in ps:
                a, b = len(p.findall(st)), len(p.findall(op))
                if a or b:
                    v += 1 + 0.3 * (a + b - 1) + (0.2 if b and not a else 0)
            if v:
                scores.append((v, t, s))
    # regras especiais de sequências
    names = {s for v, t, s in scores}
    if disc == "Matemática":
        pa = any(s.startswith("PA") for s in names) and re.search(r"progress[ãa]o aritm|\bP\.?A\.?\b|\braz[ãa]o\b|\bacrescid|\baument[ao]\b.{0,40}\b(a cada|por)\b|\bconstante\b|\bsequ[êe]ncia", st, re.I)
        pg = re.search(r"progress[ãa]o geom|\bP\.?G\.?\b|\bdobr|\btriplic|\bmetade\b", st, re.I)
        soma = re.search(r"\bsoma\b|\btotal\b|\bao todo\b|\bacumulad", st, re.I)
        seq = re.search(r"progress[ãa]o|\bsequ[êe]ncia|\bpadr[ãa]o\b|\bP\.?[AG]\.?\b|\ba cada (m[êe]s|dia|semana|ano)\b.*\b(aument|acresc|diminu)", st, re.I)
        filt = []
        for v, t, s in scores:
            if t == "Sequências":
                if not seq:
                    continue
                if s == "PA: soma dos termos" and not (soma and not pg):
                    continue
                if s == "PG: soma dos termos" and not (soma and pg):
                    continue
                if s == "PG: termo geral" and not pg:
                    continue
                if s == "PA: termo geral" and (pg and not pa):
                    continue
            filt.append((v, t, s))
        scores = filt
    scores.sort(reverse=True)
    picked = []
    if scores:
        best = scores[0][0]
        for v, t, s in scores:
            if v >= max(1.0, best * 0.55) and len(picked) < 3:
                picked.append({"topic": t, "sub": s})
    if not picked:
        picked = [{"topic": "Outros", "sub": "Outros"}]
    return {"area": AREA[disc], "discipline": disc, "topics": picked}


if __name__ == "__main__":
    stats = collections.Counter()
    out = {}
    for y in range(2017, 2026):
        for q in json.load(open(f"out/{y}.json")):
            c = classify(q)
            out[f"{y}-{q['number']}"] = c
            stats[(c["discipline"], c["topics"][0]["topic"], c["topics"][0]["sub"])] += 1
    json.dump(out, open("out/classes.json", "w"), ensure_ascii=False, indent=1)
    for k, v in sorted(stats.items()):
        print(v, k)
