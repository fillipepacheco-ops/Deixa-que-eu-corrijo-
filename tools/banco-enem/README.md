# Banco de Questões — extração do ENEM

Scripts usados para montar `src/data/banco/enem.json` e as figuras de `public/banco/enem/`.

1. `gab.py` lê os PDFs de gabarito → `gabaritos.json` (X = anulada).
2. `extract.py ANO PROVA.pdf out` extrai cada questão: texto fiel (índices, expoentes e frações viram
   a marcação de fórmulas do app), figuras recortadas da página em 200 dpi no lugar exato onde aparecem
   e as alternativas (alternativa com figura vira uma imagem só). `cidfix.py` corrige fontes sem mapa de
   caracteres (Arial/Symbol dos PDFs do INEP).
3. `manual.txt` é a classificação revisada questão por questão (códigos da lista de `taxonomy.py`);
   `classify.py` é só a sugestão automática por palavras-chave.
4. `package.py` junta tudo, reduz as figuras (cinza 8 bits / paleta) e grava no app.
