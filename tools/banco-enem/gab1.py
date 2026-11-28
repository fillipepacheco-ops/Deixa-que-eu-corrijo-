import re, subprocess, json
files = {2017:"f76c87b6-2017cad_2_gabarito_amarelo_5112017.pdf",2018:"888ed1f0-GAB_ENEM_2018_DIA_1_AMARELO.pdf",2019:"687110aa-2019gabarito_1_dia_caderno_2_amarelo_ampliada_aplicacao_regular.pdf",2020:"61e0037f-2020_GB_impresso_D1_CD2.pdf",2021:"5437dff6-2021_GB_impresso_D1_CD2.pdf",2022:"374cd61c-2022_GB_impresso_D1_CD2.pdf",2023:"3b69f855-2023_GB_impresso_D1_CD2.pdf",2024:"d98ce855-2024_GB_impresso_D1_CD2.pdf",2025:"d3bedd4b-2025_GB_impresso_D1_CD2.pdf"}
A = r"(Anulad[oa]|[A-E])"
out = {}
for y, f in files.items():
    t = subprocess.run(["pdftotext","-layout",f"/mnt/user-data/uploads/{f}","-"],capture_output=True,text=True).stdout
    ans = {}
    for line in t.splitlines():
        toks = line.split()
        nums = [i for i, w in enumerate(toks) if w.isdigit()]
        i = 0
        while i < len(toks):
            w = toks[i]
            if w.isdigit() and 1 <= int(w) <= 90:
                n = int(w); vals = []
                j = i + 1
                while j < len(toks) and re.fullmatch(A, toks[j]):
                    vals.append("X" if toks[j].startswith("Anul") else toks[j]); j += 1
                if n <= 5 and len(vals) >= 2:
                    ans[f"{n}i"], ans[f"{n}e"] = vals[0], vals[1]
                elif vals:
                    ans[str(n)] = vals[0]
                i = j
            else:
                i += 1
    need = [f"{n}{s}" for n in range(1,6) for s in "ie"] + [str(n) for n in range(6,91)]
    miss = [k for k in need if k not in ans]
    for k in miss: ans[k] = "X"
    out[y] = ans
    print(y, len(ans), "faltando:", miss, "anuladas:", [k for k in need if ans[k]=="X"])
json.dump(out, open("gabaritos1.json","w"), indent=0)
