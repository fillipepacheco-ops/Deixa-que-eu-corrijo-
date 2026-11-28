"""Decodifica caracteres "(cid:N)" de fontes Arial subconjunto sem ToUnicode completo.

Os nomes dos glifos (gNN) são índices da ordem de glifos da Arial, que segue a
ordem padrão do Macintosh até 171 e fica deslocada de 1 a partir daí
(a Arial não tem o glifo 'nonbreakingspace').
"""
import re
from fontTools.ttLib.standardGlyphOrder import standardGlyphOrder as STD
from fontTools.agl import toUnicode
from pdfminer.pdftypes import resolve1

OVERRIDE = {237: "−"}


def arial_glyph(k):
    if k in OVERRIDE:
        return OVERRIDE[k]
    if k <= 171:
        name = STD[k]
    elif k + 1 < len(STD):
        name = STD[k + 1]
    else:
        return None
    if name in (".notdef", ".null"):
        return None
    if name in ("nonmarkingreturn",):
        return " "
    u = toUnicode(name)
    return u or None


def glyph_unicode(name):
    m = re.fullmatch(r"g(\d+)", name)
    if m:
        return arial_glyph(int(m.group(1)))
    u = toUnicode(name)
    return u or None


def _fonts(res, out, depth=0):
    res = resolve1(res) or {}
    for k, v in (resolve1(res.get("Font")) or {}).items():
        f = resolve1(v)
        base = str(f.get("BaseFont", "")).strip("/'")
        enc = resolve1(f.get("Encoding"))
        mp = {}
        if isinstance(enc, dict) and "Differences" in enc:
            code = 0
            for it in resolve1(enc["Differences"]):
                if isinstance(it, int):
                    code = it
                else:
                    n = str(it).strip("/'")
                    u = glyph_unicode(n)
                    if u:
                        mp[code] = u
                    code += 1
        sub = str(f.get("Subtype", "")).strip("/'")
        out.setdefault(base, {"map": {}, "sub": sub})["map"].update(mp)
    if depth < 3:
        for k, v in (resolve1(res.get("XObject")) or {}).items():
            x = resolve1(v)
            try:
                r = x.attrs.get("Resources")
            except Exception:
                r = None
            if r:
                _fonts(r, out, depth + 1)


CID = re.compile(r"^\(cid:(\d+)\)$")


def fix_chars(page):
    """Corrige o texto dos caracteres da página in-place. Devolve quantos ficaram sem decodificação."""
    fonts = {}
    _fonts(page.page_obj.resources, fonts)
    bad = 0
    for c in page.chars:
        m = CID.match(c["text"])
        if not m:
            continue
        code = int(m.group(1))
        info = fonts.get(c["fontname"])
        u = None
        if info:
            u = info["map"].get(code)
            if u is None and info["sub"] in ("TrueType", "Type0", "CIDFontType2") and not info["map"]:
                u = arial_glyph(code)  # TrueType sem Differences: o código é o índice do glifo
        elif "Arial" in c["fontname"]:
            u = arial_glyph(code)
        if u is None:
            bad += 1
        else:
            c["text"] = u
    return bad


def patch_pdfminer():
    """Faz o pdfminer usar a ordem de glifos da Arial para nomes gNN e códigos sem ToUnicode."""
    from pdfminer import pdffont

    orig_init = pdffont.PDFSimpleFont.__init__
    orig_uni = pdffont.PDFSimpleFont.to_unichr

    def init(self, descriptor, widths, spec):
        orig_init(self, descriptor, widths, spec)
        gmap = {}
        enc = resolve1(spec.get("Encoding"))
        if isinstance(enc, dict) and "Differences" in enc:
            code = 0
            for it in resolve1(enc["Differences"]):
                if isinstance(it, int):
                    code = it
                else:
                    n = str(it).strip("/'")
                    if re.fullmatch(r"g\d+", n):
                        u = glyph_unicode(n)
                        if u:
                            gmap[code] = u
                    code += 1
        self._gmap = gmap
        self._arial = "Arial" in str(spec.get("BaseFont", ""))

    def to_unichr(self, cid):
        g = getattr(self, "_gmap", None)
        if g and cid in g:
            return g[cid]
        try:
            return orig_uni(self, cid)
        except Exception:
            if getattr(self, "_arial", False):
                u = arial_glyph(cid)
                if u:
                    return u
            raise

    pdffont.PDFSimpleFont.__init__ = init
    pdffont.PDFSimpleFont.to_unichr = to_unichr


SYM_GREEK = dict(zip("abcdefghiklmnopqrstuwxyzDFGLPQSWXY", "αβχδεφγηικλμνοπθρστυωξψζΔΦΓΛΠΘΣΩΞΨ"))
SYM_LATIN1 = {"ì": "×", "´": "×", "×": "×"}
BAD_SYMBOL = set("«÷ÿ◊èÃÇÕÖŒ⎡⎢⎣⎤⎥⎦")


ODD = {"¢": "2", "ˆ": "3", "Î": "φ"}


def fix_symbols(page):
    """Ajustes para fontes Symbol: Latin-1 trocado, área privada F0xx e glifos de delimitadores grandes."""
    for c in page.chars:
        fn = c["fontname"]
        t = c["text"]
        if t == "_":
            c["text"] = "(cid:0)"  # traço de fração feito com sublinhados: a linha vira imagem
            continue
        if t in ODD and "Arial" in fn:
            c["text"] = ODD[t]
            continue
        if t == "∂" and "Symbol" in fn:
            c["text"] = "·"
            continue
        if "Symbol" in fn or "MT-Extra" in fn:
            m = re.match(r"^\(cid:(\d+)\)$", t)
            if m:
                k = int(m.group(1)) + 29
                if 32 <= k < 127:
                    ch = chr(k)
                    c["text"] = "−" if ch == "-" else SYM_GREEK.get(ch, ch)
                continue
            if len(t) == 1 and 0xF020 <= ord(t) <= 0xF07E:
                ch = chr(ord(t) - 0xF000)
                c["text"] = "−" if ch == "-" else SYM_GREEK.get(ch, ch) if "Symbol" in fn else "(cid:0)"
                continue
            if t in SYM_LATIN1:
                c["text"] = SYM_LATIN1[t]
            elif t in BAD_SYMBOL or (len(t) == 1 and 0xF000 <= ord(t) <= 0xF0FF):
                c["text"] = "(cid:0)"  # delimitador grande: a linha vira imagem
