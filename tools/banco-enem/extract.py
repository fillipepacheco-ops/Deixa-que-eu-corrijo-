"""Extrai as questões do ENEM (2º dia, caderno 5 amarelo) com texto fiel e figuras recortadas.

Uso: python3 extract.py ANO PDF OUTDIR
Saída: OUTDIR/ANO.json e OUTDIR/img/ANO/qNNN-k.png
"""
import json, re, sys, os, subprocess, statistics
import pdfplumber
import cidfix
cidfix.patch_pdfminer()
from PIL import Image

YEAR, PDF, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
DPI = 200
S = DPI / 72
IMGDIR = os.path.join(OUT, "img", YEAR)
os.makedirs(IMGDIR, exist_ok=True)
ANCHOR = re.compile(r"^QUEST.O$", re.I)
SUBS = "₀₁₂₃₄₅₆₇₈₉"


def is_white(c):
    if c is None:
        return True
    if isinstance(c, (int, float)):
        return c >= 0.98
    c = tuple(c)
    if len(c) == 1:
        return c[0] >= 0.98
    if len(c) == 3:
        return min(c) >= 0.98
    if len(c) == 4:
        return max(c) <= 0.02
    return False


pdf = pdfplumber.open(PDF)
pages = pdf.pages
for _p in pages:
    cidfix.fix_chars(_p)
    cidfix.fix_symbols(_p)


def good_chars(p):
    return [c for c in p.chars if c.get("upright", True) and c["size"] >= 4 and c["text"].strip() != "" or (c.get("upright", True) and c["size"] >= 4 and c["text"] == " ")]


# ---------- âncoras "QUESTÃO N" ----------
def anchors_of(p):
    ws = p.extract_words(extra_attrs=["size", "fontname"])
    out = []
    for i, w in enumerate(ws):
        if ANCHOR.match(w["text"]) and "Bold" in w["fontname"] and i + 1 < len(ws):
            n = ws[i + 1]["text"]
            if n.isdigit() and abs(ws[i + 1]["top"] - w["top"]) < 3 and 91 <= int(n) <= 180:
                out.append({"n": int(n), "x0": w["x0"], "top": w["top"] - 1, "bottom": max(w["bottom"], ws[i + 1]["bottom"]) + 1})
    return out


page_anchors = [anchors_of(p) for p in pages]
all_anchor_tops = [a["top"] for pa in page_anchors for a in pa]
all_anchor_x = [a["x0"] for pa in page_anchors for a in pa]
MARGIN_L = min(all_anchor_x) - 4
W = pages[0].width
H = pages[0].height
MID = W / 2
# topo do conteúdo: o menor topo de âncora entre as páginas
CONTENT_TOP = min(all_anchor_tops) - 4


def footer_top(p):
    tops = []
    for w in p.extract_words():
        if w["top"] > H * 0.85 and re.search(r"^(Caderno|CADERNO|Página|PÁGINA)$", w["text"]):
            tops.append(w["top"])
    # linha horizontal longa logo acima do rodapé
    t = min(tops) - 3 if tops else H - 40
    for l in p.lines:
        if l["width"] > W * 0.6 and abs(l["top"] - l["bottom"]) < 2 and t - 25 < l["top"] < t + 2:
            t = min(t, l["top"] - 1)
    return t


# ---------- colunas ----------
def col_of(x0, x1):
    c = (x0 + x1) / 2
    return 0 if c < MID else 1


def col_bounds(ci):
    right = W - MARGIN_L
    return (MARGIN_L, MID - 4) if ci == 0 else (MID + 4, right)


# ---------- linhas de texto ----------
def build_lines(chars, body):
    """Agrupa caracteres em linhas; caracteres menores fora da linha de base viram índice/expoente."""
    big = [c for c in chars if c["size"] >= body * 0.85]
    small = [c for c in chars if c["size"] < body * 0.85]

    def overl(a, b):
        w = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
        h = min(a["bottom"], b["bottom"]) - max(a["top"], b["top"])
        return w > 0 and h > 0 and w * h > 0.3 * (a["x1"] - a["x0"]) * (a["bottom"] - a["top"])
    # caractere pequeno por cima de texto normal: rótulo fora do lugar, descarta
    small = [c for c in small if not any(overl(c, b) for b in big if abs(b["top"] - c["top"]) < 12)]
    big.sort(key=lambda c: (round(c["bottom"]), c["x0"]))
    lines = []
    for c in sorted(big, key=lambda c: c["bottom"]):
        for L in lines:
            if abs(L["base"] - c["bottom"]) < max(2.0, c["size"] * 0.3):
                L["chars"].append(c)
                break
        else:
            lines.append({"base": c["bottom"], "chars": [c]})
    # caracteres pequenos: primeiro em linhas próprias; depois, os grupos curtos dentro
    # da faixa de uma linha normal viram índice/expoente dela
    sgroups = []
    for c in sorted(small, key=lambda c: c["bottom"]):
        for G in sgroups:
            if abs(G["base"] - c["bottom"]) < 1.2:
                G["chars"].append(c)
                break
        else:
            sgroups.append({"base": c["bottom"], "chars": [c]})
    for G in sgroups:
        rest = []
        attached = []
        for c in sorted(G["chars"], key=lambda c: c["x0"]):
            cy = (c["top"] + c["bottom"]) / 2
            best = None
            for L in lines:
                if L.get("small"):
                    continue
                x0 = min(k["x0"] for k in L["chars"]) - 4
                x1 = max(k["x1"] for k in L["chars"]) + 4
                if not (x0 <= c["x0"] <= x1):
                    continue
                lt = min(k["top"] for k in L["chars"] if k["size"] >= body * 0.85)
                lo, hi = lt, L["base"] + 2.5
                d = 0 if lo <= cy <= hi else min(abs(cy - lo), abs(cy - hi))
                if d < 0.3 and (best is None or d < best[0]):
                    best = (d, L)
            # só vale como índice/expoente se houver um caractere normal vizinho (até 3 pt)
            if best and (any(abs(k["x0"] - c["x1"]) < 3 or abs(c["x0"] - k["x1"]) < 3 for k in best[1]["chars"] if k["size"] >= body * 0.85)
                         or any(abs(c["x0"] - k["x1"]) < 2.5 for k in attached)):
                best[1]["chars"].append(c)
                attached.append(c)
            else:
                rest.append(c)
        if rest:
            lines.append({"base": G["base"], "chars": rest, "small": True})
    # separa pedaços da mesma linha de base muito afastados (ex.: alternativas em duas colunas)
    split = []
    for L in lines:
        cs = sorted(L["chars"], key=lambda c: c["x0"])
        cur = [cs[0]]
        for c in cs[1:]:
            gap = c["x0"] - max(k["x1"] for k in cur)
            lone = len(cur) == 1 and "Bundesbahn" in cur[0]["fontname"]
            if gap > max(16, 1.8 * c["size"]) or ("Bundesbahn" in c["fontname"] and gap > 8) or (lone and gap > 1):
                split.append({"base": L["base"], "chars": cur})
                cur = [c]
            else:
                cur.append(c)
        split.append({"base": L["base"], "chars": cur})
    lines = split
    out = []
    for L in lines:
        cs = sorted(L["chars"], key=lambda c: c["x0"])
        base = statistics.median([c["bottom"] for c in cs if c["size"] >= body * 0.85] or [L["base"]])
        size = statistics.median([c["size"] for c in cs])
        txt = ""
        prev = None
        mode = None
        for c in cs:
            ch = c["text"]
            m = None
            if c["size"] < size * 0.85:
                if c["bottom"] > base + 0.8:
                    m = "sub"
                elif c["bottom"] < base - 1.5:
                    m = "sup"
            if prev is not None:
                gap = c["x0"] - prev["x1"]
                if gap > min(c["size"], prev["size"]) * 0.18 and not txt.endswith(" ") and ch != " ":
                    if mode:
                        txt += "}"
                        mode = None
                    txt += " "
            if m != mode:
                if mode:
                    txt += "}"
                if m:
                    txt += "_{" if m == "sub" else "^{"
                mode = m
            txt += ch
            prev = c
        if mode:
            txt += "}"
        txt = txt.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff").replace("\u00ad", "")
        txt = re.sub(r"\s+", " ", txt).strip()
        txt = re.sub(r"(ffi|ffl|fi|fl|ff) (?=[a-zà-ÿ])", r"\1", txt)
        if re.match(r"^(MATEM[ÁA]TICA|CI[ÊE]NCIAS DA NATUREZA) E SUAS TECNOLOGIAS|^Quest[õo]es de \d+ a \d+", txt):
            continue  # cabeçalho de seção
        if not txt:
            continue
        out.append({
            "text": txt,
            "x0": cs[0]["x0"], "x1": max(c["x1"] for c in cs),
            "top": min(c["top"] for c in cs), "bottom": max(c["bottom"] for c in cs),
            "size": size,
            "font": statistics.mode([c["fontname"] for c in cs]),
            "first_font": cs[0]["fontname"],
        })
    out.sort(key=lambda l: (l["top"], l["x0"]))
    # junta linhas com o mesmo topo (ex.: marcador da alternativa e texto)
    merged = []
    for l in out:
        if merged and abs(merged[-1]["top"] - l["top"]) < 3 and abs(merged[-1]["bottom"] - l["bottom"]) < 3 and "Bundesbahn" not in l["first_font"] and not is_alt_marker(merged[-1]):
            m = merged[-1]
            if m["x1"] <= l["x0"] < m["x1"] + 16:
                m["text"] += " " + l["text"]
                m["x1"] = l["x1"]
                continue
        merged.append(l)
    return merged


# ---------- objetos gráficos ----------
def graphics(p):
    objs = []
    for im in p.images:
        objs.append(("img", im["x0"], im["top"], im["x1"], im["bottom"]))
    for r in p.rects:
        objs.append(("rect", r["x0"], r["top"], r["x1"], r["bottom"], bool(r["fill"]) and not r["stroke"]))
    for l in p.lines:
        objs.append(("line", l["x0"], l["top"], l["x1"], l["bottom"]))
    for c in p.curves:
        objs.append(("curve", c["x0"], c["top"], c["x1"], c["bottom"], bool(c.get("fill")) and not c.get("stroke")))
    return objs


def _has_sep(p):
    return any(abs(l["x0"] - l["x1"]) < 1 and abs(l["x0"] - MID) < 15 and l["bottom"] - l["top"] > 250 for l in p.lines) or \
        any(r["x1"] - r["x0"] < 2 and abs(r["x0"] - MID) < 15 and r["bottom"] - r["top"] > 250 for r in p.rects)


_cpages = [p for i, p in enumerate(pages) if page_anchors[i]]
HAS_SEP = sum(_has_sep(p) for p in _cpages) > len(_cpages) * 0.6

# ---------- imagem da página (cache) ----------
_page_img = {}


def page_image(pi):
    if pi not in _page_img:
        base = f"/tmp/enem_pages/{YEAR}"
        os.makedirs(base, exist_ok=True)
        fn = f"{base}/p{pi+1:02d}.png"
        if not os.path.exists(fn):
            subprocess.run(["pdftoppm", "-f", str(pi + 1), "-l", str(pi + 1), "-r", str(DPI), "-png", "-singlefile", PDF, fn[:-4]], check=True)
        _page_img[pi] = Image.open(fn).convert("RGB")
    return _page_img[pi]


_integ = {}


def integ(pi):
    if pi not in _integ:
        import numpy as np
        a = np.asarray(page_image(pi).convert("L"), dtype=np.uint8) < 200
        _integ[pi] = np.pad(a.cumsum(0).cumsum(1), ((1, 0), (1, 0))).astype(np.int64)
    return _integ[pi]


def ink_fast(pi, box):
    I = integ(pi)
    h, w = I.shape[0] - 1, I.shape[1] - 1
    x0 = max(0, min(w, int(box[0] * S))); x1 = max(0, min(w, int(box[2] * S) + 1))
    y0 = max(0, min(h, int(box[1] * S))); y1 = max(0, min(h, int(box[3] * S) + 1))
    if x1 <= x0 or y1 <= y0:
        return 0.0
    tot = I[y1, x1] - I[y0, x1] - I[y1, x0] + I[y0, x0]
    return tot / ((x1 - x0) * (y1 - y0))


def ink(pi, box, chars=()):
    """Fração de pontos pintados na região, sem contar onde há letras (retângulo invisível = 0)."""
    im = page_image(pi)
    x0, t, x1, b = box
    n = hit = 0
    for i in range(12):
        for j in range(12):
            x = x0 + (x1 - x0) * (i + 0.5) / 12
            y = t + (b - t) * (j + 0.5) / 12
            if any(c["x0"] - 1 <= x <= c["x1"] + 1 and c["top"] - 1 <= y <= c["bottom"] + 1 for c in chars):
                continue
            px = im.getpixel((min(im.width - 1, int(x * S)), min(im.height - 1, int(y * S))))
            n += 1
            if sum(px) / 3 < 248:
                hit += 1
    return hit / n if n else 1.0


# ---------- percorre as páginas em ordem de leitura ----------
segments = []  # (page_index, col, top, bottom, qn)
current = None
items_by_q = {}

for pi, p in enumerate(pages):
    anchors = page_anchors[pi]
    if not anchors and current is None:
        continue
    ftop = footer_top(p)
    chars = []
    _seen = set()
    for c in p.chars:
        if not c.get("upright", True) or c["size"] < 4:
            continue
        key = (c["text"], round(c["x0"]), round(c["top"]))
        if key in _seen:
            continue
        _seen.add(key)
        chars.append(c)
    sizes = [round(c["size"], 1) for c in chars if c["text"].isalpha()]
    body = statistics.mode(sizes) if sizes else 10
    gobjs = []
    for g in graphics(p):
        if len(g) == 6:
            near = [c for c in p.chars if c["x1"] >= g[1] and c["x0"] <= g[3] and c["bottom"] >= g[2] and c["top"] <= g[4]]
            if g[5] and ink(pi, g[1:5], near) < 0.3:
                continue  # preenchimento invisível (branco)
            g = g[:5]
        gobjs.append(g)
    rows = {}
    for c in chars:
        if c["size"] >= 7 and CONTENT_TOP <= c["top"] <= ftop:
            rows.setdefault(round(c["bottom"]), []).append(c)
    nx = 0
    for rc in rows.values():
        rc.sort(key=lambda c: c["x0"])
        ok = any(c["x0"] < MID - 1 and c["x1"] > MID + 1 and c["text"].strip() for c in rc)
        for u, v in zip(rc, rc[1:]):
            if u["x1"] <= MID + 1 and v["x0"] >= MID - 1 and v["x0"] - u["x1"] < 4.5:
                ok = True
        nx += ok
    sep = any(abs(l["x0"] - l["x1"]) < 1 and abs(l["x0"] - MID) < 15 and l["bottom"] - l["top"] > 250 for l in p.lines) or \
        any(r["x1"] - r["x0"] < 2 and abs(r["x0"] - MID) < 15 and r["bottom"] - r["top"] > 250 for r in p.rects)
    deco = any(
        abs((g[2] + g[4]) / 2 - (a["top"] + a["bottom"]) / 2) < 6 and g[4] - g[2] < 12 and g[1] < MID - 20 and g[3] > MID + 40
        for a in anchors for g in gobjs if g[0] in ("line", "rect", "curve"))
    single = nx >= 3 or (HAS_SEP and not sep and bool(anchors)) or deco
    ncols = 1 if single else 2
    for ci in range(ncols):
        x0b, x1b = (MARGIN_L, W - MARGIN_L) if single else col_bounds(ci)
        col_anchors = sorted([a for a in anchors if single or col_of(a["x0"], a["x0"] + 40) == ci], key=lambda a: a["top"])
        cchars = [c for c in chars if x0b - 2 <= (c["x0"] + c["x1"]) / 2 <= x1b + 2 and CONTENT_TOP <= c["top"] and c["bottom"] <= ftop]
        # remove os caracteres das âncoras
        def in_anchor(c):
            return any(a["top"] - 1 <= c["top"] and c["bottom"] <= a["bottom"] + 1 and c["x0"] >= a["x0"] - 1 and c["x0"] < a["x0"] + 90 for a in col_anchors)
        cchars = [c for c in cchars if not in_anchor(c)]
        cg = []
        for g in gobjs:
            k, gx0, gt, gx1, gb = g
            if gt < CONTENT_TOP - 2 or gb > ftop + 2:
                continue
            if gb - gt > (ftop - CONTENT_TOP) * 0.9:
                continue  # separador de colunas
            if gx1 - gx0 > (x1b - x0b) * 1.3:
                continue
            if not (x0b - 6 <= (gx0 + gx1) / 2 <= x1b + 6):
                continue
            # decoração da âncora
            if any(a["top"] - 3 <= (gt + gb) / 2 <= a["bottom"] + 3 and gb - gt < 18 for a in col_anchors):
                continue
            cg.append(g)
        bounds = [CONTENT_TOP] + [a["top"] for a in col_anchors] + [ftop]
        owners = [current] + [a["n"] for a in col_anchors]
        for k in range(len(owners)):
            qn = owners[k]
            top = bounds[k] if k == 0 else col_anchors[k - 1]["bottom"]
            bot = bounds[k + 1]
            if qn is None:
                continue
            seg = {"page": pi, "col": ci, "top": top, "bottom": bot, "x0": x0b, "x1": x1b, "body": body,
                   "chars": [c for c in cchars if top - 1 <= (c["top"] + c["bottom"]) / 2 < bot],
                   "g": [g for g in cg if top - 1 <= (g[2] + g[4]) / 2 < bot]}
            items_by_q.setdefault(qn, []).append(seg)
        if col_anchors:
            current = col_anchors[-1]["n"]
        if current == 180 and not col_anchors:
            current = None
    if current is None and any(a["n"] == 180 for a in anchors):
        break

def crop(pi, box, name):
    x0, t, x1, b = box
    im = page_image(pi)
    pad = 2
    c = im.crop((int((x0 - pad) * S), int((t - pad) * S), int((x1 + pad) * S + 1), int((b + pad) * S + 1)))
    path = os.path.join(IMGDIR, name)
    c.save(path, optimize=True)
    return {"src": f"{YEAR}/{name}", "wmm": round((x1 - x0 + 2 * pad) * 25.4 / 72, 1), "w": c.width, "h": c.height}


SOURCE_RE = re.compile(r"(Disponível|Acesso em|adaptado|Adaptado|Fonte:|FONTE:|In:|Editora|Ed\.|p\. \d|\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}, [A-Z]\.)")


def is_alt_marker(l):
    return "Bundesbahn" in l["first_font"] and re.match(r"^[A-E]\b", l["text"])


def chunk_text(cs):
    cs = sorted(cs, key=lambda c: c["x0"])
    big = max(c["size"] for c in cs)
    base = statistics.median([c["bottom"] for c in cs if c["size"] >= big * 0.85])
    t = ""
    prev = None
    mode = None
    for c in cs:
        m = None
        if c["size"] < big * 0.85:
            if c["bottom"] < base - 1.5:
                m = "^"
            elif c["bottom"] > base + 0.8:
                m = "_"
        if prev is not None and c["x0"] - prev["x1"] > c["size"] * 0.2:
            if mode:
                t += "}"
                mode = None
            t += " "
        if m != mode:
            if mode:
                t += "}"
            if m:
                t += m + "{"
            mode = m
        t += c["text"]
        prev = c
    if mode:
        t += "}"
    return re.sub(r"\s+", " ", t).strip()


def fractions(seg):
    """Fração empilhada (número / traço / número) vira \\frac{a}{b} no texto."""
    if seg.get("_frac"):
        return
    seg["_frac"] = True
    keep = []
    for g in seg["g"]:
        k, x0, t, x1, b = g
        w = x1 - x0
        if k in ("line", "rect", "curve") and b - t < 1.6 and 3 < w < 90:
            y = (t + b) / 2
            inx = lambda c: x0 - 1.5 <= (c["x0"] + c["x1"]) / 2 <= x1 + 1.5
            num = [c for c in seg["chars"] if inx(c) and y - 4.5 <= c["bottom"] <= y + 0.8 and c["top"] < y - 2]
            if num:
                nb = min(c["top"] for c in num)
                num += [c for c in seg["chars"] if inx(c) and c not in num and c["size"] < max(k["size"] for k in num) * 0.85 and nb - 4 <= c["top"] and c["bottom"] < y - 2]
            den = [c for c in seg["chars"] if inx(c) and y - 0.8 <= c["top"] <= y + 4.5 and c["bottom"] > y + 2]
            if num and den and all(c["text"].strip() for c in num + den) and len(num) <= 14 and len(den) <= 14:
                # o traço cobre os dois números (fração de verdade, não sublinhado)
                nx0, nx1 = min(c["x0"] for c in num), max(c["x1"] for c in num)
                dx0, dx1 = min(c["x0"] for c in den), max(c["x1"] for c in den)
                if nx0 >= x0 - 2 and nx1 <= x1 + 2 and dx0 >= x0 - 2 and dx1 <= x1 + 2:
                    size = max(c["size"] for c in num + den)
                    body = seg["body"]
                    ids0 = {id(c) for c in num + den}
                    row = [c for c in seg["chars"] if id(c) not in ids0 and c["size"] >= body * 0.8 and c["top"] - 1 <= y <= c["bottom"] + 1 and abs((c["x0"] + c["x1"]) / 2 - (x0 + x1) / 2) < 80]
                    basel = statistics.median([c["bottom"] for c in row]) if row else y + body * 0.3
                    ids = {id(c) for c in num + den}
                    seg["chars"] = [c for c in seg["chars"] if id(c) not in ids]
                    seg["chars"].append({
                        "text": "\\frac{%s}{%s}" % (chunk_text(num), chunk_text(den)),
                        "x0": x0, "x1": x1, "top": basel - body, "bottom": basel,
                        "size": body, "fontname": num[0]["fontname"], "upright": True,
                    })
                    continue
        keep.append(g)
    seg["g"] = keep


def is_prose(l, seg):
    if abs(l["size"] - seg["body"]) > 0.6:
        return False
    toks = l["text"].split()
    words = [t for t in toks if re.match(r"^[A-Za-zÀ-ÿ]{2,}[,.;:?!)]*$", t)]
    return len(toks) >= 4 and len(words) >= len(toks) * 0.5


def continues_para(l, lines, seg):
    if abs(l["x0"] - seg["x0"]) > 4:
        return False
    for p in lines:
        if p is not l and 0 <= l["top"] - p["bottom"] < 4 and abs(p["x0"] - seg["x0"]) < 14 and is_prose(p, seg):
            return True
    return False


def owner_box(mk, b):
    """Alternativa dona de uma caixa (x0, top, x1, bottom)."""
    if not mk:
        return None
    first = min(m["top"] for m in mk)
    if b[3] < first - 2:
        return None
    cand = [m for m in mk if m["x0"] - 12 <= b[0] and b[2] >= m["x0"]]
    if not cand:
        return None
    cy = lambda m: (m["top"] + m["bottom"]) / 2
    inside = [m for m in cand if m["top"] <= b[3] + 1 and m["bottom"] >= b[1] - 1]
    if inside:
        return max(inside, key=lambda m: (m["x0"], -abs(cy(m) - (b[1] + b[3]) / 2)))["label"]
    above = [m for m in cand if cy(m) < b[1]]
    if above:
        top = max(cy(m) for m in above)
        row = [m for m in above if cy(m) > top - 30]
        return max(row, key=lambda m: m["x0"])["label"]
    return None


def splits_markers(mk, B):
    """True se a caixa cobre as linhas de duas alternativas diferentes (não pode juntar)."""
    n = 0
    for m in mk:
        c = (m["top"] + m["bottom"]) / 2
        if B[1] - 2 <= c <= B[3] + 2 and B[0] - 100 < m["x0"] <= B[2]:
            n += 1
    return n >= 2


def figure_boxes(seg, lines):
    """Agrupa objetos gráficos em figuras e anexa os rótulos de texto próximos."""
    colw = seg["x1"] - seg["x0"]
    paras = [l for l in lines if ((l["x1"] - l["x0"]) > colw * 0.6 or l["x0"] - seg["x0"] < 4) and abs(l["size"] - seg["body"]) < 0.6 and not is_alt_marker(l)]
    g = []
    for l in lines:
        if "(cid:" in l["text"]:
            l["fig"] = True
            g.append([l["x0"], l["top"], l["x1"], l["bottom"]])
    for x in seg["g"]:
        b = list(x[1:])
        b[1] = max(b[1], seg["top"])
        if b[2] <= seg["x0"] + 4 or b[0] >= seg["x1"] - 4:
            continue  # enfeite na margem
        if x[0] in ("line", "rect") and b[2] - b[0] < 8 and b[3] - b[1] < 2 and any(
                l["x0"] - 1 <= b[0] and b[2] <= l["x1"] + 1 and l["top"] - 1 <= b[1] and b[3] <= l["bottom"] + 2 for l in lines):
            continue  # traço de º/ª ou acento desenhado
        if any(m["x0"] - 4 <= b[0] and b[2] <= m["x1"] + 4 and m["top"] - 4 <= b[1] and b[3] <= m["bottom"] + 4 for m in lines if is_alt_marker(m)):
            continue  # bolinha do marcador da alternativa
        if x[0] == "img":
            # imagem com fundo transparente por baixo do texto: corta as linhas de texto de cima/baixo
            for l in sorted(paras, key=lambda l: l["top"]):
                if b[1] - 1 <= l["top"] and l["bottom"] <= b[1] + (b[3] - b[1]) * 0.5 and l["x0"] < b[2] and l["x1"] > b[0]:
                    b[1] = l["bottom"] + 1
            for l in sorted(paras, key=lambda l: -l["bottom"]):
                if l["bottom"] <= b[3] + 1 and l["top"] >= b[1] + (b[3] - b[1]) * 0.5 and l["x0"] < b[2] and l["x1"] > b[0]:
                    b[3] = l["top"] - 1
        # fio decorativo no fim da coluna
        if x[0] in ("line", "rect") and b[3] - b[1] < 2.5 and b[2] - b[0] > colw * 0.5 and seg["bottom"] - b[3] < 30 and not any(l["top"] > b[3] for l in lines):
            continue
        if b[3] - b[1] > 0.5 or x[0] == "line":
            g.append(b)
    # fio horizontal isolado (separador): não é figura
    def lonely_rule(b):
        if b[3] - b[1] > 1.5 or b[2] - b[0] < colw * 0.8:
            return False
        return not any(o is not b and o[1] - 8 <= b[3] and o[3] + 8 >= b[1] and not (o[3] - o[1] <= 1.5 and o[2] - o[0] >= colw * 0.8) for o in g)
    g = [b for b in g if not lonely_rule(b)]
    if not g:
        return []
    mk = [{"top": l["top"], "bottom": l["bottom"], "x0": l["x0"], "x1": l["x0"] + 8, "label": l["text"][0]} for l in lines if is_alt_marker(l)]

    def bown(b):
        return owner_box(mk, b)
    # clusters por proximidade (vertical/horizontal)
    boxes = []
    for b in sorted(g, key=lambda b: b[1]):
        for B in boxes:
            U = [min(b[0], B[0]), min(b[1], B[1]), max(b[2], B[2]), max(b[3], B[3])]
            if not splits_markers(mk, U) and b[1] <= B[3] + 8 and b[3] >= B[1] - 8 and b[0] <= B[2] + 40 and b[2] >= B[0] - 40:
                B[0], B[1], B[2], B[3] = min(B[0], b[0]), min(B[1], b[1]), max(B[2], b[2]), max(B[3], b[3])
                B[4] += 1
                break
        else:
            boxes.append(b + [1])
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                A, B = boxes[i], boxes[j]
                U = [min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3])]
                if not splits_markers(mk, U) and A[1] <= B[3] + 8 and A[3] >= B[1] - 8 and A[0] <= B[2] + 40 and A[2] >= B[0] - 40:
                    boxes[i] = [min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3]), A[4] + B[4]]
                    boxes.pop(j)
                    changed = True
                    break
            if changed:
                break
    # cada alternativa vira uma figura só (junta os pedaços com o mesmo dono)
    byown = {}
    merged = []
    for B in boxes:
        o = bown(B)
        if o is None:
            merged.append(B)
        elif o in byown and not splits_markers(mk, [min(byown[o][0], B[0]), min(byown[o][1], B[1]), max(byown[o][2], B[2]), max(byown[o][3], B[3])]):
            A = byown[o]
            A[0], A[1], A[2], A[3], A[4] = min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3]), A[4] + B[4]
        elif o in byown:
            merged.append(B)
        else:
            byown[o] = list(B)
            merged.append(byown[o])
    boxes = merged
    result = []
    for B in boxes:
        x0, t, x1, b, n = B
        # moldura simples em volta de texto (caixa de texto): não é figura
        inner = [l for l in lines if l["top"] >= t - 1 and l["bottom"] <= b + 1 and l["x0"] >= x0 - 1 and l["x1"] <= x1 + 1]
        if n <= 4 and len(inner) >= 2 and (x1 - x0) > colw * 0.6 and all(abs(l["size"] - seg["body"]) < 1 for l in inner):
            continue
        # linha de fração / sublinhado muito fino junto do texto: deixa como figura só se tiver altura útil
        result.append([x0, t, x1, b])
    # absorve textos que caem dentro ou colados na figura
    for R in result:
        grew = True
        while grew:
            grew = False
            for l in lines:
                if l.get("fig"):
                    continue
                if is_alt_marker(l):
                    continue
                full_in = l["x0"] >= R[0] - 1 and l["x1"] <= R[2] + 1 and l["top"] >= R[1] - 1 and l["bottom"] <= R[3] + 1
                lo = bown([l["x0"], l["top"], l["x1"], l["bottom"]])
                cy = (l["top"] + l["bottom"]) / 2
                inside_v = R[1] - 1 <= cy <= R[3] + 1
                overlap_h = l["x0"] <= R[2] + 25 and l["x1"] >= R[0] - 25
                strict = inside_v and l["x0"] < R[2] - 2 and l["x1"] > R[0] + 2
                if not full_in and not strict and lo is not None and lo != bown(R):
                    continue
                near = max(R[1] - l["bottom"], l["top"] - R[3]) <= 7 and l["x0"] >= R[0] - 45 and l["x1"] <= R[2] + 45 and not is_prose(l, seg) and not continues_para(l, lines, seg)
                label = (not re.search(r"[.;:?!]$", l["text"]) and len(l["text"].split()) <= 7 and len(l["text"]) < 50
                         and max(R[1] - l["bottom"], l["top"] - R[3]) <= 12 and l["x0"] >= R[0] - 10 and l["x1"] <= R[2] + 10
                         and not continues_para(l, lines, seg))
                if (inside_v and overlap_h) or ((near or label) and not SOURCE_RE.search(l["text"])):
                    l["fig"] = True
                    R[0], R[1], R[2], R[3] = min(R[0], l["x0"]), min(R[1], l["top"]), max(R[2], l["x1"]), max(R[3], l["bottom"])
                    grew = True
    return [R for R in result if R[3] - R[1] >= 6]


# ---------- monta cada questão ----------
def owner_of(marks, x, y):
    best = None
    for m in marks:
        if m["top"] - 3 <= y and m["x0"] - 6 <= x:
            k = (round(m["top"] / 4), m["x0"])
            if best is None or k > best[0]:
                best = (k, m)
    return best[1]["label"] if best else None


corpus_words = set()
questions = {}
for qn, segs in sorted(items_by_q.items()):
    seq = []  # (kind, el, seg, owner)
    last_label = None
    for seg in segs:
        if not seg.get("_inkc"):
            seg["_inkc"] = True
            seg["chars"] = [c for c in seg["chars"] if c["text"] == " " or ink_fast(seg["page"], (c["x0"], c["top"], c["x1"], c["bottom"])) > 0.01]
        fractions(seg)
        lines = build_lines(seg["chars"], seg["body"])
        # texto invisível (camada oculta / posição errada): não há tinta onde ele estaria
        lines = [l for l in lines if ink_fast(seg["page"], (l["x0"], l["top"], l["x1"], l["bottom"])) > 0.01]
        marks = [{"top": l["top"], "x0": l["x0"], "label": l["text"][0], "line": l} for l in lines if is_alt_marker(l)]
        figs = figure_boxes(seg, lines)
        els = []
        for l in lines:
            if l.get("fig"):
                continue
            if is_alt_marker(l):
                els.append(("mark", l, l["text"][0], l["top"], l["x0"]))
                continue
            o = owner_of(marks, l["x0"], (l["top"] + l["bottom"]) / 2) or last_label
            els.append(("line", l, o, l["top"], l["x0"]))
        for f in figs:
            cy = (f[1] + f[3]) / 2
            mk = [{"top": m["top"], "bottom": m["line"]["bottom"], "x0": m["x0"], "x1": m["x0"] + 8, "label": m["label"]} for m in marks]
            o = owner_box(mk, f) if marks else None
            if o is None and not (marks and f[3] < min(m["top"] for m in marks) - 2):
                o = last_label
            els.append(("fig", f, o, f[1], f[0]))
        # alternativa com figura: a alternativa inteira vira uma imagem só (fiel ao original)
        with_fig = {e[2] for e in els if e[0] == "fig" and e[2] is not None}
        if with_fig:
            keep = []
            union = {}
            for e in els:
                kind, el, o = e[0], e[1], e[2]
                if o in with_fig and kind in ("fig", "line"):
                    bx = el if kind == "fig" else [el["x0"], el["top"], el["x1"], el["bottom"]]
                    u = union.setdefault(o, list(bx))
                    u[0], u[1], u[2], u[3] = min(u[0], bx[0]), min(u[1], bx[1]), max(u[2], bx[2]), max(u[3], bx[3])
                else:
                    keep.append(e)
            for o, u in union.items():
                keep.append(("fig", u, o, u[1], u[0]))
            els = keep
        # ordem: enunciado primeiro; depois cada alternativa na ordem de aparição do marcador
        def k(e):
            kind, el, o, t, x = e
            if kind == "mark":
                return (1, el["text"][0], 0, 0)
            if o is None:
                return (0, "", t, x)
            return (1, o, 1, t)
        els.sort(key=k)
        for e in els:
            seq.append((e[0], e[1], seg, e[2]))
        if marks:
            last_label = max(marks, key=lambda m: m["label"])["label"]
    questions[qn] = seq
    for kd, l, sg, o in seq:
        if kd in ("line", "mark"):
            corpus_words.update(re.findall(r"\w+(?:-\w+)*", l["text"]))


def join_lines(prev, nxt):
    if prev.endswith("-") and nxt[:1].islower():
        m1 = re.search(r"(\w+)-$", prev)
        m2 = re.match(r"(\w+)", nxt)
        if m1 and m2:
            whole = m1.group(1) + m2.group(1)
            hy = m1.group(1) + "-" + m2.group(1)
            if hy in corpus_words and whole not in corpus_words:
                return prev + nxt
            return prev[:-1] + nxt
    return prev + " " + nxt


out = []
for qn, seq in sorted(questions.items()):
    statement = []
    opts = {}
    order = []
    para = None
    para_owner = None
    last = None
    imgk = 0

    def blocks_of(o):
        if o is None:
            return statement
        if o not in opts:
            opts[o] = []
            order.append(o)
        return opts[o]

    def flush():
        global para
        if para is not None:
            blocks_of(para_owner).append({"t": "p", "s": para["s"], "src": para.get("src", False), "center": para.get("center", False)})
            para = None

    for kind, el, seg, owner in seq:
        if kind == "mark":
            flush()
            blocks_of(owner)
            rest = el["text"][1:].strip()
            para_owner = owner
            if rest:
                para = {"s": rest}
            last = el
            continue
        if owner != para_owner:
            flush()
            para_owner = owner
            last = None
        if kind == "fig":
            flush()
            imgk += 1
            info = crop(seg["page"], el, f"q{qn:03d}-{imgk}.png")
            blocks_of(owner).append({"t": "img", **info})
            last = None
            continue
        l = el
        colw = seg["x1"] - seg["x0"]
        is_src = l["size"] < seg["body"] - 0.8 and SOURCE_RE.search(l["text"])
        small = l["size"] < seg["body"] - 0.8
        if owner is not None:
            new_para = para is None or last is None or l["top"] - last["bottom"] > l["size"] * 0.9 or l["top"] < last["top"] - 2
        else:
            new_para = (
                para is None
                or bool(re.match(r"^[•●▪–]\s", l["text"]))
                or last is None
                or l["top"] - last["bottom"] > l["size"] * 0.9
                or l["top"] < last["top"] - 2
                or (l["x0"] - seg["x0"] > 8 and l["x0"] - last["x0"] > 6)
                or (last["x1"] < seg["x0"] + colw * 0.8 and not (re.search(r"[A-Za-zÀ-ÿ,]$", last["text"]) and l["text"][:1].islower() and l["top"] - last["bottom"] < l["size"] * 0.6))
                or abs(l["size"] - last["size"]) > 1
            )
            if para is not None and para.get("src") and small and last is not None and 0 <= l["top"] - last["bottom"] < l["size"]:
                new_para = False
            # frase que continua na linha de baixo (termina sem pontuação e a próxima começa minúscula)
            if (para is not None and last is not None and not re.search(r"[.:;?!]$", last["text"]) and l["text"][:1].islower()
                    and -1 <= l["top"] - last["bottom"] < l["size"] * 0.7 and abs(l["size"] - last["size"]) <= 1):
                new_para = False
        if new_para:
            flush()
            para = {"s": l["text"], "src": bool(is_src)}
            cx = (l["x0"] + l["x1"]) / 2
            if abs(cx - (seg["x0"] + seg["x1"]) / 2) < 6 and (l["x1"] - l["x0"]) < colw * 0.8 and l["x0"] - seg["x0"] > 15:
                para["center"] = True
        else:
            para["s"] = join_lines(para["s"], l["text"])
        last = l
    flush()
    options = [{"label": o, "blocks": opts[o]} for o in sorted(order)]
    if qn == 180 and len(options) == 5:
        # depois da última questão vem o fim do caderno: a alternativa E fica com o mesmo formato da D
        shape = [b["t"] for b in options[3]["blocks"]]
        options[4]["blocks"] = options[4]["blocks"][: len(shape)]
    out.append({"number": qn, "statement": statement, "options": options})

json.dump(out, open(os.path.join(OUT, f"{YEAR}.json"), "w"), ensure_ascii=False, indent=1)
print(YEAR, len(out), "questões;", sum(1 for q in out if len(q["options"]) != 5), "sem 5 alternativas:", [q["number"] for q in out if len(q["options"]) != 5])
