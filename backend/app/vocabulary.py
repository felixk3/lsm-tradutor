# Vocabulário inicial do protótipo (LSM — Língua de Sinais de Moçambique).
# A app não traz os gestos "pré-gravados": cada sinal é ensinado ao modelo na aba
# "Treinar", por uma pessoa fluente em LSM. Pode adicionar/remover sinais na interface.

REST_LABEL = "_repouso"  # classe "sem sinal" (mãos paradas / a transitar). Nunca é transcrita.

DEFAULT_VOCABULARY = [
    {"label": REST_LABEL, "category": "Sistema"},
    # Cumprimentos e cortesia
    *[{"label": w, "category": "Cumprimentos"} for w in [
        "Olá", "Bom dia", "Boa tarde", "Boa noite", "Tchau", "Obrigado",
        "Por favor", "Desculpa", "Como estás?", "Bem", "Mal",
    ]],
    # Respostas e perguntas
    *[{"label": w, "category": "Perguntas e respostas"} for w in [
        "Sim", "Não", "Onde?", "Quando?", "O quê?", "Porquê?", "Quanto?", "Não sei", "Entendi",
    ]],
    # Pessoas
    *[{"label": w, "category": "Pessoas"} for w in [
        "Eu", "Tu", "Ele/Ela", "Nós", "Mãe", "Pai", "Família", "Amigo", "Professor", "Médico",
        "Surdo", "Nome",
    ]],
    # Necessidades e lugares
    *[{"label": w, "category": "Necessidades"} for w in [
        "Ajuda", "Água", "Comer", "Beber", "Casa de banho", "Dor", "Doente", "Remédio",
        "Emergência", "Polícia", "Hospital", "Escola", "Casa", "Trabalho", "Dinheiro",
    ]],
    # Tempo
    *[{"label": w, "category": "Tempo"} for w in ["Hoje", "Amanhã", "Ontem", "Agora", "Depois"]],
    # Verbos e outros
    *[{"label": w, "category": "Ações"} for w in [
        "Querer", "Ir", "Vir", "Gostar", "Saber", "Esperar", "Falar", "Ver",
    ]],
    *[{"label": w, "category": "Lugares"} for w in ["Moçambique", "Maputo", "Beira"]],
    # Alfabeto manual (soletração de nomes)
    *[{"label": c, "category": "Alfabeto"} for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    # Números
    *[{"label": str(n), "category": "Números"} for n in range(0, 11)],
]
