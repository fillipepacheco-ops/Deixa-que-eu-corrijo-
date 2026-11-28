import re, subprocess, json, sys
files = {
 2017:"1c1ee622-2017.pdf", 2018:"6ffdc02c-GAB_ENEM_2018_DIA_2_AMARELO.pdf", 2019:"a46033c1-2019.pdf",
 2020:"8f4e9e95-2020_GB_impresso_D2_CD5.pdf", 2021:"8039c53e-2021_GB_impresso_D2_CD5.pdf", 2022:"d53e83c8-2022_GB_impresso_D2_CD5.pdf",
 2023:"1db31cb6-2023_GB_impresso_D2_CD5.pdf", 2024:"fbdad640-2024_GB_impresso_D2_CD5.pdf", 2025:"76f310d7-2025_GB_impresso_D2_CD5.pdf",
}
out = {}
for y, f in files.items():
    t = subprocess.run(["pdftotext","-layout",f"/mnt/user-data/uploads/{f}","-"],capture_output=True,text=True).stdout
    ans = {}
    for line in t.splitlines():
        for m in re.finditer(r"\b(9[1-9]|1[0-7]\d|180)\s+(Anulad[oa]|[A-E])\b", line):
            ans[int(m.group(1))] = "X" if m.group(2).startswith("Anul") else m.group(2)
    missing = [q for q in range(91,181) if q not in ans]
    for q in missing: ans[q] = "X"
    out[y] = {str(k): ans[k] for k in sorted(ans)}
    print(y, len(ans), "anuladas/faltando:", [q for q in range(91,181) if ans[q]=="X"])
json.dump(out, open("gabaritos.json","w"), indent=0)
