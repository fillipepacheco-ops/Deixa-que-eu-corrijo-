cd /home/claude/enem
mkdir -p out1
declare -A F=([2017]=93b596b8-2017cad_2_prova_amarelo_5112017.pdf [2018]=c1279db7-2018_PV_impresso_D1_CD2.pdf [2019]=ea93556e-2019caderno_de_questoes_1_dia_caderno_2_amarelo_ampliada_aplicacao_regular.pdf [2020]=ef556757-2020_PV_impresso_D1_CD2.pdf [2021]=eaf2dfe3-2021_PV_impresso_D1_CD2_ampliada.pdf [2022]=59904648-2022_PV_impresso_D1_CD2.pdf [2023]=07dc63b8-2023_PV_impresso_D1_CD2.pdf [2024]=65b2eaa1-2024_PV_impresso_D1_CD2.pdf [2025]=3e80354e-2025_PV_impresso_D1_CD2.pdf)
for y in ${YEARS:-2017 2018 2019 2020 2021 2022 2023 2024 2025}; do echo "$y /mnt/user-data/uploads/${F[$y]}"; done | xargs -P 3 -L 1 sh -c 'rm -rf out1/img/$0 /tmp/enem_pages/$0; python3 extract.py $0 $1 out1'
