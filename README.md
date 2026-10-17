# LSM Tradutor 🤟

Protótipo que **lê sinais da Língua de Sinais de Moçambique (LSM) pela câmara**, transcreve-os em texto à medida que a pessoa sinaliza e **lê a transcrição em voz alta**.

- **Frontend:** React + Material UI (Material Design)
- **Backend:** FastAPI + scikit-learn
- **Sem base de dados:** amostras, vocabulário e modelo ficam em ficheiros na pasta `data/`
- **Tudo com um comando Docker**

---

## Como executar

Requisitos: Docker Desktop (ou Docker + Docker Compose).

```bash
docker compose up --build
```

Abra **http://localhost:8080** no Chrome ou Edge e autorize a câmara.

---

## Duas formas de usar

| | **Experimentar já** (sem treino) | **Ensinar a LSM** (com um profissional) |
|---|---|---|
| Onde | Aba **Traduzir** → escolha *Gestos comuns*, *Alfabeto A–Z* ou *Números 0–9* | Aba **Treinar sinais** |
| O quê | Modelos prontos, treinados com dados de outros países | Sinais da Língua de Sinais de Moçambique gravados por si |
| Quando | Logo na primeira utilização | Quando tiver um intérprete ou pessoa surda fluente |
| Tradução | Sempre em **português** | Sempre em **português** |

A app mostra um guia de boas-vindas com estes dois caminhos (pode reabri-lo no botão **?** no topo).

### Modelos prontos incluídos
| Modelo | Reconhece | Origem |
|---|---|---|
| **Gestos comuns** | Olá (mão aberta), Sim (polegar para cima), Não (polegar para baixo), Espera (punho), Atenção (indicador para cima), Paz (V), Amo-te | Reconhecedor de gestos do [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) (Google) |
| **Alfabeto A–Z** | Letras do alfabeto manual, para soletrar nomes | [ASL Landmark MLP](https://huggingface.co/nocontextdoruk/asl-landmark-mlp) — alfabeto manual **americano** (ASL), dataset ASL-HG (Pranto et al., 2026). Licença **CC BY-NC 4.0** (uso não comercial, com atribuição) |
| **Números 0–9** | Algarismos com uma mão | Mesmo modelo ASL |

> Estes modelos **não são LSM**: servem para ver a app a funcionar e para soletrar. Algumas letras coincidem com o alfabeto manual moçambicano, outras não. Para LSM verdadeira, use o treino.

Os modelos prontos são descarregados durante o `docker compose up --build`. Se o build for feito sem Internet, a app continua a funcionar, mas o Alfabeto e os Números ficam marcados como "Indisponível".

> A câmara só funciona em `http://localhost` ou em HTTPS. Para usar noutro dispositivo da rede, coloque a app atrás de HTTPS (ex.: Caddy, ngrok, Cloudflare Tunnel).

A primeira construção precisa de Internet (descarrega dependências e o modelo de deteção de mãos do MediaPipe). Depois disso, a app funciona **offline**.

---

## Como funciona

```
Câmara ──► MediaPipe Hand Landmarker (no navegador, 21 pontos por mão)
              │  sequência de ~1,5 s de pontos
              ▼
        FastAPI /api/predict ──► características (forma da mão + movimento)
              │                     ──► classificador ExtraTrees
              ▼
   Sinal reconhecido ──► transcrição no ecrã ──► voz (síntese do navegador)
```

- O mesmo detetor (MediaPipe Gesture Recognizer) dá os pontos das mãos **e** o gesto reconhecido, numa só passagem.
- Só **pontos das mãos** são enviados ao servidor — nunca vídeo ou imagens.
- Funciona com sinais **estáticos** (letras do alfabeto manual, números) e **dinâmicos** (com movimento).
- Letras soletradas seguidas juntam-se numa palavra: `M A R I A` → **MARIA**.
- A classe especial **Repouso** ensina o modelo a não escrever nada entre sinais.

---

## Ensinar os sinais (obrigatório na primeira vez)

Não existe ainda um conjunto de dados público de LSM para reconhecimento automático, por isso **a app aprende com gravações feitas por si**, de preferência por uma pessoa fluente em LSM (surda ou intérprete).

1. Abra a aba **Treinar sinais**.
2. Escolha um sinal da lista (há ~100 pré-definidos: cumprimentos, perguntas, pessoas, necessidades, tempo, ações, alfabeto A–Z e números 0–10). Pode adicionar mais com **Novo**.
3. Clique **Gravar 5 seguidas** (ou prima **Espaço**). Após a contagem 3‑2‑1, faça o sinal durante a gravação de 1,5 s.
4. Grave **10 a 15 amostras por sinal** (mínimo 3). Comece pelo **Repouso**.
5. Clique **Treinar modelo** (demora segundos). Os sinais treinados ficam com ✔.
6. O **Testar ao vivo** liga-se sozinho: faça um sinal e veja na câmara o que o modelo reconhece, sem sair da página. Se errar, grave mais amostras e treine de novo.
7. Na aba **Traduzir**, escolha **LSM — sinais treinados** → **Iniciar tradução**.

O topo da página mostra em que passo está: **Gravar → Treinar → Testar**.

**Tempo estimado:** cerca de 1 minuto por sinal → 20 sinais em ~20 min; o vocabulário completo em ~2 horas.

### Dicas para melhor precisão
- Boa iluminação de frente, fundo simples, mãos e tronco visíveis.
- Grave com **várias pessoas** e em locais diferentes; use **Exportar/Importar dados** para juntar gravações de vários computadores.
- Se dois sinais se confundem, grave mais amostras de ambos.
- Ajuste a **Confiança mínima** na aba Traduzir.

---

## Treino no Google Colab (opcional)

O servidor já treina sozinho. O notebook `notebooks/treino_lsm_colab.ipynb` serve para juntar dados de várias pessoas e comparar algoritmos (ExtraTrees, RandomForest, rede neural MLP) com validação por pessoa:

1. Na app: **Exportar dados** → `lsm-dataset.zip` (um por computador/pessoa).
2. Abra o notebook no [Google Colab](https://colab.research.google.com/), carregue os ZIPs e execute tudo.
3. Copie o `model.joblib` descarregado para a pasta `data/` e execute `docker compose restart backend`.

---

## Estrutura

```
lsm-tradutor/
├── docker-compose.yml
├── backend/                 FastAPI
│   └── app/
│       ├── main.py          rotas da API
│       ├── features.py      extração de características (partilhada com o Colab)
│       ├── model.py         treino (com aumento de dados) e predição
│       ├── ready_models.py  modelos prontos (gestos, alfabeto, números)
│       ├── storage.py       ficheiros em /data (sem BD)
│       └── vocabulary.py    vocabulário inicial
├── frontend/                React + MUI, servido por nginx
│   └── src/
│       ├── pages/TranslatePage.jsx
│       ├── pages/TrainPage.jsx
│       ├── components/      câmara, cartão do modelo, diálogos
│       └── lib/             MediaPipe, API, voz, transcrição
├── notebooks/treino_lsm_colab.ipynb
└── data/                    criado automaticamente (amostras + modelo)
```

### API
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/vocabulary` | sinais, nº de amostras, se estão treinados |
| POST | `/api/vocabulary` | adicionar sinal |
| POST | `/api/samples` | guardar uma amostra (sequência de pontos) |
| POST | `/api/train` | treinar o modelo |
| GET | `/api/models` | modelos disponíveis (prontos + LSM) |
| POST | `/api/predict` | reconhecer um sinal (`model`: `lsm`, `gestos`, `letras`, `numeros`) |
| GET | `/api/dataset/export` · POST `/api/dataset/import` | partilhar dados |

Documentação interativa da API: **http://localhost:8080/api/docs**

### Desenvolvimento sem Docker
```bash
# backend
cd backend && pip install -r requirements.txt && DATA_DIR=../data uvicorn app.main:app --reload
# frontend (noutro terminal)
cd frontend && npm install && npm run setup-mediapipe && npm run dev   # http://localhost:5173
```

---

## Limitações do protótipo
- Reconhece **sinais isolados** do vocabulário treinado; não traduz a gramática da LSM (ordem das frases, classificadores, expressões faciais). A transcrição é uma sequência de palavras em português.
- Usa apenas as **mãos**; sinais que dependem da expressão facial ou da posição no corpo podem confundir-se.
- A qualidade depende das gravações. Com dados de uma só pessoa, funciona melhor para essa pessoa.
- A voz usa as vozes instaladas no sistema/navegador (prefere pt‑MZ, depois pt‑PT, depois pt‑BR).
