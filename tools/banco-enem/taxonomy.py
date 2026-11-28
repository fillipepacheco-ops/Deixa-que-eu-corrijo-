# -*- coding: utf-8 -*-
"""Taxonomia detalhada (disciplina > tópico > subtópico) com palavras-chave.

Cada subtópico tem uma lista de expressões regulares (sem acento não importa: o texto
é normalizado). Pontuação = soma dos acertos; vale o que passar do limite.
"""

T = {
"Matemática": {
  "Aritmética e números": {
    "Operações e problemas com números naturais": [r"\bquantos?\b.*\bao todo\b", r"\btotal de\b"],
    "Múltiplos, divisores, MMC e MDC": [r"\bmmc\b", r"\bmdc\b", r"m[ií]nimo m[uú]ltiplo", r"m[aá]ximo divisor", r"\bdivisores?\b", r"\bm[uú]ltiplos?\b", r"\bprimos?\b(?! grau)", r"\bdivis[ií]ve(l|is)\b", r"\bciclos?\b.*\bsimultane"],
    "Frações e números decimais": [r"\bfra[çc](ão|ões)\b", r"\bdecima(l|is)\b", r"\bd[ií]zima"],
    "Sistema de numeração e notação científica": [r"nota[çc][ãa]o cient[ií]fica", r"\b10\^\{-?\d+\}", r"pot[êe]ncias? de (base )?10", r"\bordem de grandeza", r"\bsistema de numera", r"\bbase (2|bin[aá]ria)"],
    "Potenciação e radiciação": [r"\bpot[êe]ncia(s|ção)?\b", r"\bra[ií]z(es)? (quadrada|c[uú]bica)", r"\\sqrt"],
    "Números inteiros e reta numérica": [r"\bn[uú]meros? (inteiros?|negativos?)\b", r"\breta num[ée]rica", r"\bsaldo negativo"],
  },
  "Razão, proporção e porcentagem": {
    "Razão e proporção": [r"\braz[ãa]o entre\b", r"\bproporcion", r"\bpropor[çc][ãa]o\b", r"\bna mesma raz"],
    "Regra de três": [r"regra de tr[êe]s", r"\bdiretamente proporcional", r"\binversamente proporcional"],
    "Escala": [r"\bescala\b", r"\b1\s?:\s?\d"],
    "Porcentagem": [r"\d+(,\d+)?\s?%", r"\bpercentua(l|is)\b", r"\bpor cento\b", r"\bporcentagem"],
    "Juros e matemática financeira": [r"\bjuros?\b", r"\bmontante\b", r"\bdesconto\b", r"\bacr[ée]scimo\b", r"\bparcelas?\b", r"\bpresta[çc]", r"\binfla[çc]", r"\bcapital\b", r"\btaxa de juros", r"\bfinanciamento"],
    "Grandezas e unidades de medida": [r"\bconvers[ãa]o\b", r"\bunidades? de medida", r"\bquil[ôo]metros?\b.*\bmetros?\b", r"\blitros?\b.*\bmililitros?\b", r"\bm\^\{3\}", r"\bcm\^\{3\}", r"\bdm\^\{3\}", r"\bpolegadas?\b", r"\bhectares?\b", r"\bp[ée]s\b"],
    "Velocidade, densidade e taxas": [r"\bkm/h\b", r"\bvelocidade m[ée]dia", r"\bdensidade\b", r"\bvaz[ãa]o\b", r"\bconsumo\b.*\bpor\b"],
  },
  "Álgebra e funções": {
    "Equações do 1º grau e problemas": [r"equa[çc][ãa]o do (1|primeiro)", r"\bequa[çc](ão|ões)\b"],
    "Sistemas de equações": [r"\bsistema\b.*\bequa", r"\bduas equa"],
    "Função afim (1º grau)": [r"fun[çc][ãa]o (afim|do (1|primeiro) grau|linear)", r"\bcoeficiente angular", r"\btaxa de varia[çc]", r"\bgr[aá]fico\b.*\breta\b", r"\bvaria[çc][ãa]o linear", r"\bcrescimento linear", r"y\s?=\s?\d*\s?x\s?[+−-]"],
    "Função quadrática (2º grau)": [r"fun[çc][ãa]o (quadr[aá]tica|do (2|segundo) grau)", r"\bpar[aá]bola", r"\bv[ée]rtice\b", r"x\^\{2\}", r"equa[çc][ãa]o do (2|segundo) grau", r"\bvalor m[aá]ximo\b", r"\bvalor m[ií]nimo\b"],
    "Função exponencial": [r"\bexponencia(l|is)\b", r"\bdobra a cada\b", r"\bmeia-vida\b", r"\d\^\{[a-z]"],
    "Logaritmo": [r"\blogaritm", r"\blog\b", r"\bln\b", r"\bescala richter", r"\bdecib[ée]is\b"],
    "Funções trigonométricas": [r"\bseno\b", r"\bcosseno\b", r"\bsen\b", r"\bcos\b", r"\bperi[oó]dic", r"\bper[ií]odo\b.*\bfun[çc]"],
    "Leitura e interpretação de gráficos": [r"\bgr[aá]fico\b", r"\beixo\b", r"\bcurva\b"],
    "Inequações e desigualdades": [r"\binequa[çc]", r"\bno m[aá]ximo\b", r"\bno m[ií]nimo\b", r"\bpelo menos\b", r"≤|≥"],
    "Expressões algébricas e fórmulas": [r"\bexpress[ãa]o (alg[ée]brica|que (representa|relaciona|fornece))", r"\bf[oó]rmula\b"],
  },
  "Sequências": {
    "PA: termo geral": [r"progress[ãa]o aritm[ée]tica", r"\bP\.?A\.?\b", r"\braz[ãa]o\b.*\bconstante", r"\bacrescid[ao]s? de \d+ (a cada|por)", r"\bsequ[êe]ncia\b", r"\bpadr[ãa]o\b.*\bfigura"],
    "PA: soma dos termos": [r"(soma|total).{0,60}(termos|primeiros|meses|dias|semanas|anos)", r"\bsoma dos\b"],
    "PG: termo geral": [r"progress[ãa]o geom[ée]trica", r"\bP\.?G\.?\b", r"\bdobr(a|o)\b.*\bcada\b", r"\bmetade\b.*\bcada\b", r"\btriplic"],
    "PG: soma dos termos": [r"progress[ãa]o geom[ée]trica.*soma", r"soma.*progress[ãa]o geom[ée]trica"],
    "Sequências e padrões": [r"\bsequ[êe]ncia\b", r"\bpadr[ãa]o\b", r"\bpr[oó]xim[ao] (termo|figura)"],
  },
  "Geometria plana": {
    "Ângulos, retas e polígonos": [r"\b[aâ]ngulos?\b", r"\bpol[ií]gono", r"\bparalel", r"\bperpendicular", r"\bhex[aá]gono", r"\bpent[aá]gono", r"\boct[oó]gono", r"\bgraus?\b"],
    "Triângulos e semelhança": [r"\btri[aâ]ngulos?\b", r"\bsemelhan[çc]a", r"\bsemelhantes\b", r"\bteorema de tales", r"\bcatetos?\b", r"\bhipotenusa"],
    "Teorema de Pitágoras": [r"\bpit[aá]goras", r"\bhipotenusa", r"\bdiagonal\b"],
    "Áreas de figuras planas": [r"\b[aá]rea\b", r"\bm\^\{2\}", r"\bcm\^\{2\}", r"\bmetros? quadrados?"],
    "Perímetro": [r"\bper[ií]metro", r"\bcontorno\b", r"\bcerca\b", r"\bmuro\b"],
    "Circunferência e círculo": [r"\bc[ií]rculo", r"\bcircunfer[êe]ncia", r"\braio\b", r"\bdi[aâ]metro", r"\barco\b", r"\bsetor circular", r"\bπ"],
    "Trigonometria no triângulo retângulo": [r"\btangente\b", r"\bseno\b", r"\bcosseno\b", r"\bsen\b", r"\btg\b", r"\b30\s?°", r"\b60\s?°", r"\b45\s?°"],
    "Simetria, transformações e ladrilhamento": [r"\bsimetri", r"\brota[çc][ãa]o\b", r"\btransla[çc]", r"\bladrilh", r"\breflex[ãa]o\b", r"\bmosaico"],
  },
  "Geometria espacial": {
    "Prismas e cubos": [r"\bprisma", r"\bcubo\b", r"\bparalelep[ií]pedo", r"\bcaixa\b"],
    "Cilindros": [r"\bcilindr"],
    "Cones": [r"\bcone\b", r"\bc[oô]nic"],
    "Pirâmides": [r"\bpir[aâ]mide"],
    "Esferas": [r"\besfer"],
    "Volume e capacidade": [r"\bvolume\b", r"\bcapacidade\b", r"\blitros?\b", r"\bm\^\{3\}", r"\bcm\^\{3\}"],
    "Planificação, vistas e projeções": [r"\bplanifica", r"\bvista (superior|frontal|lateral)", r"\bproje[çc][ãa]o ortogonal", r"\bsombra\b", r"\bvisto de cima"],
    "Poliedros (vértices, arestas e faces)": [r"\bpoliedro", r"\bv[ée]rtices\b", r"\barestas?\b", r"\bfaces?\b"],
  },
  "Geometria analítica": {
    "Plano cartesiano e pontos": [r"\bplano cartesiano", r"\bcoordenadas?\b", r"\bpar ordenado", r"\beixo x\b", r"\beixo y\b", r"\babscissa", r"\bordenada"],
    "Distância entre pontos": [r"\bdist[aâ]ncia entre", r"\bmenor dist[aâ]ncia"],
    "Equação da reta": [r"\bequa[çc][ãa]o da reta", r"\bretas?\b.*\bcoeficiente"],
    "Equação da circunferência": [r"\bequa[çc][ãa]o da circunfer"],
  },
  "Estatística": {
    "Média aritmética e ponderada": [r"\bm[ée]dia\b", r"\bponderada"],
    "Mediana e moda": [r"\bmediana\b", r"\bmoda\b"],
    "Desvio padrão e variância": [r"\bdesvio[ -]padr", r"\bvari[aâ]ncia", r"\bdispers[ãa]o\b", r"\bregularidade\b", r"\bmais regular"],
    "Tabelas e gráficos estatísticos": [r"\btabela\b", r"\bgr[aá]fico de (barras|setores|colunas)", r"\binfogr[aá]fico", r"\bquadro\b"],
  },
  "Contagem e probabilidade": {
    "Princípio fundamental da contagem": [r"\bquantas? (maneiras|formas|possibilidades|senhas|placas|combina[çc])", r"\bprinc[ií]pio (fundamental|multiplicativo)", r"\bsenhas?\b", r"\bc[oó]digos?\b"],
    "Permutação e arranjo": [r"\bpermuta", r"\banagrama", r"\barranjo", r"\bfila\b", r"\bordem\b", r"\b\d+!"],
    "Combinação": [r"\bcombina[çc](ão|ões)\b", r"\bcomiss", r"\bgrupos? de \d", r"\bescolher \d", r"C_\{"],
    "Probabilidade simples": [r"\bprobabilidade", r"\bchance", r"\bsortead", r"\baleatori"],
    "Probabilidade condicional e eventos": [r"\bdado que\b", r"\bsabendo que\b.*\bprobabilidade", r"\bcondicional", r"\bindependentes?\b", r"\bambos\b.*\bprobabilidade"],
  },
  "Matemática financeira e cotidiano": {
    "Orçamento, compras e tarifas": [r"\bR\$\s?\d", r"\btarifa", r"\bconta de\b", r"\bpre[çc]o", r"\bcusto\b", r"\blucro\b", r"\bplano\b.*\b(mensal|telefon|celular)"],
  },
},
"Física": {
  "Cinemática": {
    "Movimento uniforme e velocidade média": [r"\bvelocidade m[ée]dia", r"\bmovimento uniforme", r"\bkm/h\b", r"\bm/s\b", r"\bdeslocamento\b", r"\btempo de percurso"],
    "Movimento uniformemente variado": [r"\bacelera[çc]", r"\bfrenagem", r"\bfrear\b", r"\bdesacelera", r"\bm/s\^\{2\}"],
    "Queda livre e lançamentos": [r"\bqueda livre", r"\blan[çc]amento", r"\bem queda", r"\bgravidade\b", r"\baltura m[aá]xima"],
    "Movimento circular": [r"\bmovimento circular", r"\bfrequ[êe]ncia\b.*\bvoltas", r"\brota[çc](ão|ões)\b", r"\bengrenage", r"\bpolias?\b", r"\bcatracas?\b", r"\brpm\b", r"\bvelocidade angular"],
    "Gráficos do movimento": [r"\bgr[aá]fico\b.*\b(velocidade|posi[çc][ãa]o)", r"\bposi[çc][ãa]o (em fun[çc]|x tempo)"],
  },
  "Dinâmica": {
    "Leis de Newton": [r"\bleis? de newton", r"\bin[ée]rcia\b", r"\bfor[çc]a resultante", r"\ba[çc][ãa]o e rea[çc][ãa]o", r"\bnewtons?\b"],
    "Atrito": [r"\batrito"],
    "Plano inclinado": [r"\bplano inclinado", r"\brampa"],
    "Força peso, normal e tração": [r"\bfor[çc]a peso", r"\bfor[çc]a normal", r"\btra[çc][ãa]o\b", r"\bpeso\b"],
    "Força elástica (Hooke)": [r"\bmola", r"\bel[aá]stic", r"\bhooke"],
    "Movimento circular e força centrípeta": [r"\bcentr[ií]peta", r"\bcurva\b.*\bvelocidade", r"\bloop", r"\bglobo da morte"],
  },
  "Energia, trabalho e potência": {
    "Energia cinética e potencial": [r"\benergia cin[ée]tica", r"\benergia potencial", r"\baltura\b.*\benergia", r"\bconserva[çc][ãa]o (da|de) energia"],
    "Trabalho e potência mecânica": [r"\btrabalho\b", r"\bpot[êe]ncia\b", r"\bwatts?\b", r"\bkW\b", r"\brendimento\b"],
    "Transformações e fontes de energia": [r"\btransforma[çc][ãa]o de energia", r"\busina", r"\bhidrel[ée]trica", r"\be[óo]lica", r"\bsolar\b", r"\bfotovoltaic", r"\bconvers[ãa]o de energia", r"\btermel[ée]trica", r"\bnuclear\b", r"\bfontes? de energia"],
  },
  "Impulso e quantidade de movimento": {
    "Colisões e conservação do momento": [r"\bcolis", r"\bquantidade de movimento", r"\bimpulso\b", r"\bmomento linear", r"\bairbag", r"\brecuo\b"],
  },
  "Gravitação": {
    "Gravitação universal e órbitas": [r"\bgravita[çc]", r"\b[óo]rbita", r"\bsat[ée]lite", r"\bkepler", r"\bplaneta", r"\bimponderabilidade", r"\bmar[ée]s?\b"],
  },
  "Estática e hidrostática": {
    "Equilíbrio e alavancas (torque)": [r"\balavanca", r"\btorque", r"\bmomento de (uma )?for[çc]a", r"\bequil[ií]brio\b", r"\bgangorra", r"\bcentro de (massa|gravidade)"],
    "Pressão, empuxo e densidade": [r"\bempuxo", r"\bpress[ãa]o hidrost", r"\bpress[ãa]o atmosf", r"\barquimedes", r"\bstevin", r"\bpascal\b", r"\bflutua", r"\bsubmers", r"\bvasos comunicantes", r"\bprensa hidr[aá]ulica", r"\bpress[ãa]o\b"],
  },
  "Termologia": {
    "Temperatura e escalas termométricas": [r"\btermom[ée]tr", r"\bescala (celsius|fahrenheit|kelvin)", r"\bfahrenheit", r"\bkelvin"],
    "Calor sensível, latente e calorimetria": [r"\bcalor (espec[ií]fico|latente|sens[ií]vel)", r"\bcalorimetr", r"\bcapacidade t[ée]rmica", r"\bcalorias?\b", r"\bfus[ãa]o\b", r"\bebuli", r"\bvaporiza"],
    "Propagação do calor": [r"\bcondu[çc][ãa]o\b", r"\bconvec[çc][ãa]o", r"\birradia[çc][ãa]o", r"\bisolante t[ée]rmic", r"\bcondutividade t[ée]rmica", r"\bgarrafa t[ée]rmica", r"\bestufa\b"],
    "Dilatação térmica": [r"\bdilata[çc]"],
    "Termodinâmica e máquinas térmicas": [r"\btermodin[aâ]mica", r"\bm[aá]quinas? t[ée]rmicas?", r"\bcarnot", r"\bciclo\b.*\b(motor|termod)", r"\bgases?\b.*\b(isot|adiab|isob|isoc)", r"\brefrigerador", r"\bgeladeira", r"\bmotor\b.*\bcombust[ãa]o"],
  },
  "Óptica": {
    "Reflexão e espelhos": [r"\bespelho", r"\breflex[ãa]o\b"],
    "Refração e lentes": [r"\brefra[çc]", r"\blentes?\b", r"\b[ií]ndice de refra", r"\bmiopia", r"\bhipermetropia", r"\b[óo]culos", r"\bfibra [óo]ptica", r"\bprisma\b"],
    "Luz, cores e sombras": [r"\bcores?\b", r"\bsombra", r"\bc[âa]mara escura", r"\bluz (branca|vis[ií]vel)", r"\bfiltro", r"\bpigmento", r"\bespectro\b"],
    "Visão e olho humano": [r"\bolho\b", r"\bretina", r"\bcones?\b.*\bbastonetes", r"\bpupila"],
  },
  "Ondulatória": {
    "Ondas: frequência, comprimento e velocidade": [r"\bondas?\b", r"\bcomprimento de onda", r"\bfrequ[êe]ncia", r"\bhertz|\bHz\b", r"\bper[ií]odo\b"],
    "Som e acústica": [r"\bsom\b", r"\bsonor", r"\bac[uú]stic", r"\bdecib", r"\beco\b", r"\btimbre", r"\baltura do som", r"\bintensidade sonora", r"\bresson[âa]ncia", r"\bultrassom", r"\binstrumento"],
    "Fenômenos ondulatórios (interferência, difração, efeito Doppler)": [r"\binterfer[êe]ncia", r"\bdifra[çc]", r"\bdoppler", r"\bpolariza", r"\bbatimento"],
    "Ondas eletromagnéticas e radiação": [r"\beletromagn[ée]tic", r"\bradia[çc][ãa]o (ultravioleta|infravermelha|eletromag)", r"\bultravioleta", r"\binfravermelh", r"\bmicro-?ondas", r"\braios? x\b", r"\bondas? de r[aá]dio", r"\bwi-?fi\b"],
  },
  "Eletricidade": {
    "Eletrostática e carga elétrica": [r"\beletriza", r"\bcarga el[ée]trica", r"\bcoulomb", r"\bcampo el[ée]trico", r"\bpara-?raios", r"\beletrost", r"\bgaiola de faraday", r"\bpotencial el[ée]trico", r"\bdescarga el[ée]trica", r"\braios?\b.*\btempestade"],
    "Corrente, resistência e leis de Ohm": [r"\bcorrente el[ée]trica", r"\bresist[êe]ncia", r"\bresistor", r"\bohm", r"\bamp[eè]re", r"\bamper[ií]metro", r"\bvolt[ií]metro", r"\btens[ãa]o el[ée]trica", r"\bvolts?\b", r"\bddp\b"],
    "Circuitos elétricos (série e paralelo)": [r"\bcircuito", r"\bem s[ée]rie", r"\bem paralelo", r"\bl[âa]mpadas?\b", r"\bpilhas?\b", r"\bbaterias?\b", r"\bfus[ií]ve", r"\bdisjuntor", r"\bchave\b"],
    "Potência e consumo de energia elétrica": [r"\bkwh\b", r"\bconsumo de energia", r"\bpot[êe]ncia el[ée]trica", r"\bconta de (luz|energia)", r"\bchuveiro", r"\bwatts?\b", r"\baparelhos? el[ée]tric", r"\beletrodom[ée]stic"],
  },
  "Magnetismo e eletromagnetismo": {
    "Ímãs e campo magnético": [r"\b[íi]m[ãa]s?\b", r"\bcampo magn[ée]tico", r"\bb[úu]ssola", r"\bmagnetiz"],
    "Indução eletromagnética, motores e geradores": [r"\bindu[çc][ãa]o", r"\bgerador", r"\bmotor el[ée]trico", r"\btransformador", r"\bfaraday", r"\bbobina", r"\bd[ií]namo", r"\bespira"],
  },
  "Física moderna": {
    "Efeito fotoelétrico, radioatividade e física nuclear": [r"\bfotoel[ée]tric", r"\bf[óo]tons?\b", r"\bqu[âa]ntic", r"\brelatividade", r"\bfiss[ãa]o", r"\bfus[ãa]o nuclear", r"\bLED\b"],
  },
},
"Química": {
  "Química geral": {
    "Modelos atômicos e estrutura do átomo": [r"\bmodelos? at[ôo]mic", r"\b[áa]tomo", r"\bel[ée]trons?\b", r"\bpr[óo]tons?\b", r"\bn[êe]utrons?\b", r"\bn[íi]veis de energia", r"\bdistribui[çc][ãa]o eletr[ôo]nica", r"\bis[óo]topos?", r"\brutherford", r"\bbohr\b", r"\bdalton\b", r"\bthomson"],
    "Tabela periódica e propriedades": [r"\btabela peri[óo]dica", r"\beletronegatividade", r"\braio at[ôo]mico", r"\benergia de ioniza", r"\bfam[ií]lia\b", r"\bmetais alcalinos", r"\bhal[óo]genios", r"\bgases nobres"],
    "Ligações químicas e geometria molecular": [r"\blig(a[çc](ão|ões)) (i[ôo]nica|covalente|met[áa]lica|de hidrog[êe]nio|qu[íi]mica)", r"\bpolaridade", r"\bpolar(es)?\b", r"\bapolar", r"\bgeometria molecular", r"\bfor[çc]as? intermolecular", r"\bintera[çc](ão|ões) intermolecular", r"\bdipolo"],
    "Substâncias, misturas e separação": [r"\bmisturas?\b", r"\bsepara[çc][ãa]o\b", r"\bdestila[çc]", r"\bfiltra[çc]", r"\bdecanta", r"\bcentrifug", r"\bcromatografia", r"\bsubst[âa]ncias? (pura|simples|composta)", r"\balotr[óo]p", r"\bevapora[çc]", r"\bheterog[êe]ne", r"\bhomog[êe]ne"],
    "Propriedades da matéria e mudanças de estado": [r"\bponto de (fus[ãa]o|ebuli[çc][ãa]o)", r"\bmudan[çc]as? de estado", r"\bsublima", r"\bdensidade\b", r"\bsolubilidade", r"\bestado f[íi]sico"],
  },
  "Físico-química": {
    "Soluções e concentração": [r"\bconcentra[çc][ãa]o", r"\bsolu[çc](ão|ões)\b", r"\bmol/L\b", r"\bg/L\b", r"\bmg/L\b", r"\bdilui[çc]", r"\bppm\b", r"\bsoluto", r"\bsolvente", r"\btitula[çc]"],
    "Estequiometria e cálculos químicos": [r"\bestequiom", r"\bmassa molar", r"\bmols?\b", r"\bmol\b", r"\bg mol", r"\brendimento\b", r"\bquantidade de mat[ée]ria", r"\bavogadro", r"\bmassa de\b.*\bproduzid", r"\breagente limitante", r"\bpureza"],
    "Termoquímica": [r"\btermoqu[íi]mic", r"\bentalpia", r"\bΔ_?\{?H", r"\bexot[ée]rmic", r"\bendot[ée]rmic", r"\bkJ\b", r"\bcalor de (combust[ãa]o|forma[çc])", r"\bpoder calor[íi]fico", r"\benergia de liga[çc]"],
    "Cinética química": [r"\bcin[ée]tica qu[íi]mica", r"\bvelocidade da rea[çc]", r"\bcatalis", r"\bcatalisador", r"\benzimas?\b.*\bvelocidade", r"\benergia de ativa"],
    "Equilíbrio químico e pH": [r"\bequil[íi]brio qu[íi]mico", r"\ble chatelier", r"\bdeslocamento do equil", r"\bpH\b", r"\bpOH\b", r"\b[áa]cid[oa]s?\b.*\bb[áa]sic", r"\bconstante de equil", r"\bK_\{", r"\bhidr[óo]lise", r"\btamp[ãa]o", r"\bindicador\b"],
    "Eletroquímica (pilhas e eletrólise)": [r"\beletroqu[íi]m", r"\bpilhas?\b", r"\beletr[óo]lise", r"\boxirredu", r"\boxida[çc][ãa]o\b", r"\bredu[çc][ãa]o\b", r"\bpotencial (padr[ãa]o )?de redu", r"\bc[áa]todo", r"\b[âa]nodo", r"\bcorros[ãa]o", r"\bgalvaniz", r"\bbaterias?\b", r"\bferrugem", r"\bnox\b"],
    "Radioatividade": [r"\bradioativ", r"\bmeia-vida", r"\bpart[íi]cula alfa", r"\bemiss[ãa]o (alfa|beta|gama)", r"\bdecaimento", r"\bfiss[ãa]o nuclear", r"\bcarbono-14", r"\bis[óo]topo radioativo"],
    "Propriedades coligativas e gases": [r"\bcoligativ", r"\bosmose", r"\bpress[ãa]o de vapor", r"\bebulioscopia", r"\bcrioscopia", r"\bgases ideais", r"\bpV\s?=\s?nRT", r"\bclapeyron"],
  },
  "Química inorgânica": {
    "Ácidos, bases, sais e óxidos": [r"\b[áa]cid[oa]s?\b", r"\bbases?\b", r"\bsais?\b", r"\b[óo]xidos?\b", r"\bneutraliza", r"\bhidr[óo]xido", r"\bcarbonato", r"\bcalc[áa]rio", r"\bcal virgem", r"\bsoda c[áa]ustica"],
    "Reações químicas e balanceamento": [r"\brea[çc](ão|ões) qu[íi]mica", r"\bequa[çc][ãa]o qu[íi]mica", r"\bbalance", r"\bprecipita", r"\bdeslocamento\b", r"→"],
  },
  "Química orgânica": {
    "Funções orgânicas": [r"\bfun[çc](ão|ões) org[âa]nica", r"\b[áa]lcool", r"\bcetona", r"\balde[íi]do", r"\b[ée]ster", r"\b[ée]ter\b", r"\bamina", r"\bamida", r"\bfenol", r"\bhidrocarboneto", r"\b[áa]cido carbox[íi]lico", r"\bhaleto", r"\bgrupo funcional", r"\bOH\b", r"\bCOOH\b", r"\bCHO\b"],
    "Isomeria": [r"\bisomeria", r"\bis[ôo]meros?", r"\bquiral", r"\benanti[ôo]mero", r"\bcis\b", r"\btrans\b", r"\bopticamente ativ"],
    "Reações orgânicas": [r"\brea[çc][ãa]o de (adi[çc][ãa]o|substitui[çc][ãa]o|elimina[çc][ãa]o|esterifica[çc][ãa]o|saponifica[çc][ãa]o|oxida[çc][ãa]o|combust[ãa]o)", r"\besterifica", r"\bsaponifica", r"\btransesterifica", r"\bhidrogena", r"\bpolimeriza", r"\bozon[óo]lise"],
    "Polímeros": [r"\bpol[íi]mero", r"\bpl[áa]stico", r"\bmon[ôo]mero", r"\bpolietileno", r"\bPVC\b", r"\bPET\b", r"\bborracha", r"\bnylon|n[áa]ilon", r"\bbiodegrad"],
    "Bioquímica e química dos alimentos": [r"\bprote[íi]nas?\b", r"\bcarboidrato", r"\blip[íi]di", r"\bgordura", r"\b[óo]leos?\b", r"\bsab[ãa]o", r"\bdetergente", r"\btensoativ", r"\bsurfactante", r"\bamino[áa]cido"],
    "Cadeias carbônicas e nomenclatura": [r"\bcadeia carb[ôo]nica", r"\bnomenclatura", r"\bcarbono (prim[áa]rio|secund[áa]rio|terci[áa]rio|quatern)", r"\bramificad", r"\barom[áa]tic"],
  },
  "Química ambiental": {
    "Poluição, chuva ácida e efeito estufa": [r"\bpolui", r"\bchuva [áa]cida", r"\befeito estufa", r"\bcamada de oz[ôo]nio", r"\bCO_\{2\}\b", r"\bSO_\{2\}", r"\bNO_\{2\}", r"\bmetais pesados", r"\btratamento de (água|esgoto)", r"\beutrofiza", r"\bcombust[íi]ve(l|is) f[óo]sse", r"\bbiocombust", r"\bbiodiesel", r"\betanol\b", r"\breciclagem", r"\blixo\b"],
  },
},
"Biologia": {
  "Citologia": {
    "Célula e organelas": [r"\bc[ée]lulas?\b", r"\borganela", r"\bmitoc[ôo]ndria", r"\bcloroplasto", r"\bribossomo", r"\bret[íi]culo", r"\bcomplexo golgiense|golgi", r"\blisossomo", r"\bperoxissomo", r"\bn[úu]cleo\b", r"\bcitoplasma", r"\bvac[úu]olo"],
    "Membrana plasmática e transporte": [r"\bmembrana (plasm[áa]tica|celular)", r"\bosmose", r"\bdifus[ãa]o", r"\btransporte (ativo|passivo)", r"\bendocitose", r"\bfagocitose", r"\bbomba de s[óo]dio"],
    "Metabolismo energético (respiração e fermentação)": [r"\brespira[çc][ãa]o celular", r"\bfermenta", r"\bATP\b", r"\bglic[óo]lise", r"\bciclo de krebs", r"\bmetabolismo", r"\baer[óo]bi", r"\banaer[óo]bi"],
    "Fotossíntese": [r"\bfotoss[íi]ntese", r"\bclorofila", r"\bautotr[óo]f"],
    "Divisão celular (mitose e meiose)": [r"\bmitose", r"\bmeiose", r"\bdivis[ãa]o celular", r"\bciclo celular", r"\bcromossomos?\b", r"\bc[âa]ncer|tumor"],
  },
  "Genética e biologia molecular": {
    "DNA, RNA e síntese de proteínas": [r"\bDNA\b", r"\bRNA\b", r"\bc[óo]digo gen[ée]tico", r"\bc[óo]dons?\b", r"\btranscri[çc]", r"\btradu[çc][ãa]o\b", r"\bnucleot[íi]deo", r"\bsíntese de prote[íi]nas", r"\bgenes?\b", r"\bmuta[çc]"],
    "Leis de Mendel e heredograma": [r"\bmendel", r"\bheredograma", r"\bdominante", r"\brecessiv", r"\bhomozig", r"\bheterozig", r"\bgen[óo]tipo", r"\bfen[óo]tipo", r"\bcruzamento", r"\bal[ée]los?\b", r"\bprole\b", r"\bheran[çc]a"],
    "Herança ligada ao sexo e grupos sanguíneos": [r"\bligad[ao] ao (sexo|cromossomo x)", r"\bdaltonismo", r"\bhemofilia", r"\bsistema ABO", r"\bfator rh", r"\btipo sangu[íi]neo", r"\bgrupos? sangu[íi]neos?"],
    "Biotecnologia e engenharia genética": [r"\bbiotecnolog", r"\btransg[êe]nic", r"\bclonagem", r"\bclone", r"\bc[ée]lulas?-tronco", r"\bterapia g[êe]nica", r"\bPCR\b", r"\bCRISPR", r"\bDNA recombinante", r"\bvetor\b", r"\bplasm[íi]deo", r"\bteste de DNA|exame de DNA", r"\bmarcador molecular"],
  },
  "Evolução": {
    "Teorias evolutivas e seleção natural": [r"\bevolu[çc]", r"\bdarwin", r"\blamarck", r"\bsele[çc][ãa]o natural", r"\badapta[çc]", r"\bespecia[çc]", r"\bancestral", r"\bf[óo]sse", r"\bresist[êe]ncia\b.*\b(antibi[óo]tico|inseticida|bact[ée]ria)", r"\bconverg[êe]ncia"],
  },
  "Ecologia": {
    "Cadeias e teias alimentares": [r"\bcadeia alimentar", r"\bteia alimentar", r"\bn[íi]vel tr[óo]fico", r"\bprodutores?\b", r"\bconsumidores?\b", r"\bdecompositores?\b", r"\bpir[âa]mide (de|ecol)", r"\bpredador", r"\bpresa\b"],
    "Relações ecológicas": [r"\bmutualismo", r"\bcomensalismo", r"\bparasitismo", r"\bparasit", r"\bcompeti[çc]", r"\bpreda[çc]", r"\bsimbios", r"\bprotocoopera", r"\binquilinismo", r"\bamensalismo", r"\bsociedade\b|\bcol[ôo]nia\b", r"\bpoliniza"],
    "Ciclos biogeoquímicos": [r"\bciclo (do|da) (carbono|nitrog[êe]nio|[áa]gua|f[óo]sforo|oxig[êe]nio)", r"\bfixa[çc][ãa]o de nitrog", r"\bnitrifica", r"\bdesnitrifica", r"\bleguminosa"],
    "Biomas e ecossistemas brasileiros": [r"\bbiomas?\b", r"\bcerrado", r"\bcaatinga", r"\bamaz[ôo]nia", r"\bmata atl[âa]ntica", r"\bpantanal", r"\bpampa", r"\bmanguezal|mangue\b", r"\brestinga", r"\becossistema", r"\bsucess[ãa]o ecol"],
    "Impactos ambientais e conservação": [r"\bimpacto ambiental", r"\bdesmatamento", r"\bqueimada", r"\bpolui", r"\bespécies? (ex[óo]tica|invasora)", r"\bextin[çc]", r"\bbiodiversidade", r"\bfragmenta[çc]", r"\bcorredor(es)? ecol", r"\bbioacumula", r"\bmagnifica[çc][ãa]o tr[óo]fica", r"\beutrofiza", r"\bagrot[óo]xico", r"\bpesticida", r"\binseticida", r"\baquecimento global", r"\befeito estufa", r"\bsustent[áa]vel", r"\breciclagem"],
    "Populações e dinâmica populacional": [r"\bpopula[çc][ãa]o\b.*\b(crescimento|densidade|tamanho)", r"\bcapacidade de suporte", r"\bdensidade populacional", r"\bcontrole biol[óo]gico"],
  },
  "Fisiologia humana": {
    "Sistema digestório e nutrição": [r"\bdigest", r"\best[ôo]mago", r"\bintestino", r"\bf[íi]gado", r"\bp[âa]ncreas", r"\bbile", r"\benzimas? digest", r"\bnutri", r"\bvitaminas?", r"\bdieta\b", r"\bnutrientes?"],
    "Sistema respiratório e circulatório": [r"\brespirat[óo]ri", r"\bpulm[ãa]o|pulm[õo]es", r"\balv[ée]olo", r"\bcora[çc][ãa]o", r"\bsangue\b", r"\bcircula[çc][ãa]o", r"\bart[ée]ria", r"\bveias?\b", r"\bhemoglobina", r"\bhem[áa]cias?", r"\bpress[ãa]o arterial"],
    "Sistema excretor": [r"\brins?\b", r"\bn[ée]fron", r"\burina", r"\bexcre[çc]", r"\bur[ée]ia", r"\b[áa]cido [úu]rico", r"\bhemodi[áa]lise"],
    "Sistema nervoso e sentidos": [r"\bneur[ôo]nio", r"\bsistema nervoso", r"\bsinapse", r"\bneurotransmissor", r"\bc[ée]rebro", r"\bmedula", r"\breflexo\b", r"\bvis[ãa]o\b", r"\baudi[çc][ãa]o", r"\btato\b", r"\bpaladar", r"\bolfato"],
    "Sistema endócrino e hormônios": [r"\bhorm[ôo]ni", r"\binsulina", r"\bgl[âa]ndula", r"\bdiabet", r"\btireoide", r"\badrenalina", r"\bendócrin|end[óo]crin", r"\bglicemia|n[íi]veis de a[çc][úu]car"],
    "Sistema imunológico, vacinas e soros": [r"\bimun", r"\bvacina", r"\bsoro\b", r"\banticorpo", r"\bant[íi]geno", r"\blinf[óo]cito", r"\bleuc[óo]cito", r"\bdefesa do organismo", r"\bimunoglobulina", r"\bal[ée]rgi"],
    "Reprodução humana e métodos contraceptivos": [r"\breprodu[çc][ãa]o humana", r"\bcontracep", r"\bmenstrua", r"\bovula[çc]", r"\bgravidez|gesta[çc]", r"\bespermatoz", r"\b[óo]vulo", r"\bpreservativo", r"\bfecunda[çc]", r"\bplacenta", r"\bembri"],
    "Sistema muscular e esquelético": [r"\bm[úu]sculo", r"\bossos?\b", r"\besquel", r"\bcontra[çc][ãa]o muscular", r"\bc[áa]lcio\b.*\bosso"],
  },
  "Saúde e doenças": {
    "Doenças causadas por vírus": [r"\bv[íi]rus", r"\bvirose", r"\bdengue", r"\bzika", r"\bchikungunya", r"\bfebre amarela", r"\bsarampo", r"\bHIV\b|\baids\b", r"\bgripe", r"\binfluenza", r"\bcovid|coronav[íi]rus", r"\bhepatite", r"\braiva\b", r"\bherpes", r"\bHPV\b"],
    "Doenças causadas por bactérias": [r"\bbact[ée]ri", r"\bantibi[óo]tico", r"\btuberculose", r"\bc[óo]lera", r"\bleptospirose", r"\bt[ée]tano", r"\bs[íi]filis", r"\bhansen[íi]ase", r"\bmeningite"],
    "Doenças causadas por protozoários e vermes": [r"\bprotozo", r"\bmal[áa]ria", r"\bdoen[çc]a de chagas|\bchagas\b", r"\bleishmaniose", r"\bamebíase|ameb", r"\btoxoplasm", r"\bverminose", r"\besquistossom", r"\bteníase|t[êe]nia", r"\bascarid", r"\bcisticercose", r"\bmosquito\b", r"\bbarbeiro\b"],
    "Saúde, prevenção e saneamento": [r"\bsaneamento", r"\bpreven[çc]", r"\bvetor\b", r"\bcontamina[çc]", r"\bepidemi", r"\bpandemi", r"\bhigiene", r"\bmedicamento", r"\bf[áa]rmaco", r"\btabagismo|cigarro|nicotina", r"\b[áa]lcool\b.*\borganismo"],
  },
  "Seres vivos (zoologia, botânica e microbiologia)": {
    "Vírus, bactérias, protozoários e fungos": [r"\bv[íi]rus", r"\bbact[ée]ri", r"\bfungos?\b", r"\bprotozo", r"\bmicrorganism|micro-organism", r"\bleveduras?", r"\bbolor"],
    "Botânica (plantas: estrutura e fisiologia)": [r"\bplantas?\b", r"\bvegeta(l|is)\b", r"\bfolhas?\b", r"\bra[íi]z(es)?\b", r"\bcaule", r"\bflor(es)?\b", r"\bsementes?", r"\bfrutos?\b", r"\bxilema", r"\bfloema", r"\bestômato|est[ôo]matos", r"\bgermina", r"\btranspira[çc][ãa]o", r"\bangiosperma", r"\bgimnosperma", r"\bbri[óo]fita", r"\bpterid[óo]fita", r"\bfitorm[ôo]nio|auxina"],
    "Zoologia (animais: grupos e características)": [r"\banimais?\b", r"\binsetos?\b", r"\banf[íi]bios?", r"\br[ée]pteis?|r[ée]ptil", r"\baves?\b", r"\bmam[íi]feros?", r"\bpeixes?\b", r"\bartr[óo]podes?", r"\bmoluscos?", r"\bverteb", r"\binverteb", r"\bcnid[áa]rio", r"\bequinodermo", r"\banel[íi]deo", r"\blarvas?", r"\bmetamorfose", r"\bmorcego", r"\baranha", r"\bcobra|serpente", r"\bsapo|r[ãa]\b"],
  },
},
}

# Área de cada disciplina
AREA = {"Matemática": "Matemática e suas Tecnologias", "Física": "Ciências da Natureza", "Química": "Ciências da Natureza", "Biologia": "Ciências da Natureza"}

# ---------- 1º dia: Linguagens e Ciências Humanas (classificação manual; sem palavras-chave) ----------
T1 = {
"Língua Portuguesa": {
  "Interpretação e compreensão de texto": ["Tema e ideia central", "Inferência e informação implícita", "Finalidade e intenção do texto", "Argumentação e ponto de vista", "Humor, ironia e efeitos de sentido"],
  "Gêneros textuais": ["Gêneros jornalísticos (notícia, reportagem, artigo, crônica)", "Gêneros publicitários e campanhas", "Gêneros digitais e da internet", "Gêneros instrucionais, científicos e de divulgação", "Charge, tirinha e cartum"],
  "Variação linguística": ["Variedades regionais, sociais e históricas", "Norma-padrão e preconceito linguístico", "Oralidade e escrita"],
  "Funções da linguagem": ["Funções da linguagem (referencial, emotiva, conativa, metalinguística, poética, fática)"],
  "Gramática e recursos linguísticos": ["Coesão e conectivos", "Pontuação, aspas e sinais gráficos", "Classes de palavras e seus efeitos", "Sintaxe, concordância e regência", "Semântica, sinonímia e polissemia", "Formação de palavras e neologismos", "Estrangeirismos e empréstimos"],
  "Intertextualidade e linguagem figurada": ["Intertextualidade, paródia e paráfrase", "Figuras de linguagem"],
},
"Literatura": {
  "Escolas literárias": ["Trovadorismo, Humanismo e Classicismo", "Barroco e Arcadismo", "Romantismo", "Realismo, Naturalismo e Parnasianismo", "Simbolismo e Pré-Modernismo", "Modernismo (1ª, 2ª e 3ª fases)", "Literatura contemporânea"],
  "Gêneros e elementos literários": ["Poesia: eu lírico, versificação e recursos", "Prosa: narrador, personagem, tempo e espaço", "Teatro e texto dramático", "Literatura e outras artes"],
  "Diversidade na literatura": ["Literatura afro-brasileira e indígena", "Literatura de autoria feminina", "Literatura africana de língua portuguesa", "Literatura de cordel e popular"],
},
"Artes": {
  "Artes visuais": ["Pintura, escultura e gravura", "Arte contemporânea, instalação e performance", "Fotografia e cinema", "Arquitetura, design e urbanismo", "Vanguardas europeias e Arte Moderna"],
  "Música, dança e teatro": ["Música", "Dança", "Teatro e circo"],
  "Arte e cultura": ["Patrimônio, arte popular e cultura afro-brasileira e indígena", "Arte e sociedade"],
},
"Educação Física": {
  "Práticas corporais": ["Esporte e jogos", "Dança, ginástica e lutas", "Corpo, saúde, estética e qualidade de vida", "Esporte, mídia e sociedade"],
},
"Tecnologias da Informação e Comunicação": {
  "Tecnologia e comunicação": ["Internet, redes sociais e linguagem digital", "Impactos sociais da tecnologia", "Fake news, desinformação e mídia"],
},
"Língua Inglesa": {
  "Compreensão de texto em inglês": ["Ideia central e finalidade do texto", "Informação específica e vocabulário", "Gêneros: poema, letra de música, quadrinho e charge", "Temas sociais e culturais"],
},
"Língua Espanhola": {
  "Compreensão de texto em espanhol": ["Ideia central e finalidade do texto", "Informação específica e vocabulário", "Gêneros: poema, letra de música, quadrinho e charge", "Temas sociais e culturais"],
},
"História": {
  "História Antiga e Medieval": ["Antiguidade Clássica (Grécia e Roma)", "Antiguidade Oriental e outras sociedades", "Idade Média e feudalismo", "Islã e Império Bizantino"],
  "História Moderna": ["Renascimento, Reformas e Absolutismo", "Expansão marítima e colonização", "Iluminismo e revoluções (Inglesa, Francesa, Industrial)"],
  "História Contemporânea": ["Imperialismo e neocolonialismo", "Primeira Guerra e Revolução Russa", "Totalitarismos e Segunda Guerra", "Guerra Fria e descolonização", "Mundo atual e globalização"],
  "Brasil Colônia": ["Economia colonial (açúcar, mineração)", "Escravidão africana e resistência", "Povos indígenas e colonização", "Revoltas e conjurações coloniais"],
  "Brasil Império": ["Independência e Primeiro Reinado", "Período Regencial e revoltas", "Segundo Reinado, café e abolição"],
  "Brasil República": ["República Velha (Primeira República)", "Era Vargas", "República Populista (1946–1964)", "Ditadura Militar", "Redemocratização e Nova República"],
  "Temas de História": ["América pré-colombiana e América Latina", "História da África", "Cidadania, direitos e movimentos sociais", "Trabalho, cultura e cotidiano", "Patrimônio, memória e fontes históricas"],
},
"Geografia": {
  "Geografia física": ["Clima e fenômenos atmosféricos", "Relevo, solos e geologia", "Hidrografia e recursos hídricos", "Biomas, vegetação e domínios morfoclimáticos"],
  "Questões ambientais": ["Impactos ambientais e desenvolvimento sustentável", "Mudanças climáticas e acordos internacionais", "Recursos naturais e energia"],
  "Geografia humana": ["População, demografia e migrações", "Urbanização e problemas urbanos", "Espaço agrário e agropecuária", "Indústria e economia", "Transportes e circulação"],
  "Geopolítica e globalização": ["Globalização e blocos econômicos", "Conflitos, fronteiras e territórios", "Ordem mundial e geopolítica"],
  "Cartografia": ["Mapas, escalas e projeções", "Coordenadas, fusos e orientação"],
  "Geografia do Brasil": ["Regionalização e território brasileiro", "Povos tradicionais, quilombolas e indígenas"],
},
"Filosofia": {
  "Filosofia antiga": ["Pré-socráticos", "Sócrates e Platão", "Aristóteles", "Filosofia helenística"],
  "Filosofia medieval e moderna": ["Filosofia medieval (Agostinho, Tomás de Aquino)", "Racionalismo e empirismo (Descartes, Locke, Hume)", "Kant e o Iluminismo", "Contratualistas (Hobbes, Locke, Rousseau)", "Maquiavel e o poder"],
  "Filosofia contemporânea": ["Nietzsche, Marx e a crítica da modernidade", "Existencialismo e fenomenologia", "Escola de Frankfurt e indústria cultural", "Filosofia política contemporânea (Arendt, Foucault)"],
  "Temas de Filosofia": ["Ética e moral", "Teoria do conhecimento", "Política, poder e Estado", "Estética, linguagem e ciência"],
},
"Sociologia": {
  "Teoria sociológica": ["Durkheim, Weber e Marx", "Pensamento social brasileiro"],
  "Temas de Sociologia": ["Cultura, identidade e diversidade", "Trabalho e sociedade", "Desigualdade, classes e estratificação", "Movimentos sociais e cidadania", "Gênero, raça e minorias", "Violência, controle social e instituições", "Indústria cultural, mídia e consumo", "Religião e sociedade"],
},
}
AREA.update({
  "Língua Portuguesa": "Linguagens, Códigos e suas Tecnologias", "Literatura": "Linguagens, Códigos e suas Tecnologias",
  "Artes": "Linguagens, Códigos e suas Tecnologias", "Educação Física": "Linguagens, Códigos e suas Tecnologias",
  "Tecnologias da Informação e Comunicação": "Linguagens, Códigos e suas Tecnologias",
  "Língua Inglesa": "Linguagens, Códigos e suas Tecnologias", "Língua Espanhola": "Linguagens, Códigos e suas Tecnologias",
  "História": "Ciências Humanas e suas Tecnologias", "Geografia": "Ciências Humanas e suas Tecnologias",
  "Filosofia": "Ciências Humanas e suas Tecnologias", "Sociologia": "Ciências Humanas e suas Tecnologias",
})
