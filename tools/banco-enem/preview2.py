import json, sys, html, re, random
d = json.load(open('/home/claude/deixa-que-eu-corrijo-/src/data/banco/enem.json'))
ids = sys.argv[1].split(',')
def fmt(s):
    out = []
    for line in s.split('\n'):
        m = re.fullmatch(r'\[\[img:(.*?)\|(.*?)\]\]', line)
        if m:
            out.append(f"<img src='/home/claude/deixa-que-eu-corrijo-/public{m.group(1)}' style='width:{m.group(2)}mm;max-width:100%'>")
            continue
        t = html.escape(line)
        t = re.sub(r'\\frac\{(.*?)\}\{(.*?)\}', r'<span style="display:inline-flex;flex-direction:column;text-align:center;vertical-align:middle;font-size:11px"><span style="border-bottom:1px solid">\1</span><span>\2</span></span>', t)
        t = re.sub(r'_\{(.*?)\}', r'<sub>\1</sub>', t); t = re.sub(r'\^\{(.*?)\}', r'<sup>\1</sup>', t)
        out.append(f"<p>{t}</p>")
    return ''.join(out)
h = "<html><head><meta charset=utf-8><style>body{font:13px Arial;width:95mm;margin:8px} p{margin:3px 0;text-align:justify} h4{margin:14px 0 4px;color:#137a1a} .o{display:flex;gap:6px} img{display:block;margin:4px auto}</style></head><body>"
for q in d:
    if q['id'] in ids:
        h += f"<h4>{q['id']} · {' | '.join(t[2] for t in q['tags'])} · gab {q['ans']}</h4>" + fmt(q['st'])
        for l, o in zip('ABCDE', q['op']):
            h += f"<div class=o><b>{l}</b><div>{fmt(o)}</div></div>"
open('/home/claude/enem/out/prev2.html', 'w').write(h + "</body></html>")
