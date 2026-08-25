# Live keyword-research benchmark — 5 českých témat

Datum běhu: 2026-08-25T04:52:03.378Z
Endpoint: `POST /v1/keywords/recommended`
Konfigurace: `language: Czech`, `country: Czech Republic`
Počet témat: 5
Pozice v corpus: 11–15

## Souhrnné metriky

- HTTP 200: **5/5**
- Supporting keywords celkem: **7**
- Témata s alespoň jedním supporting keywordem: **1/5**
- Diversity keywords celkem: **0**
- Primární keyword s hodnocením `no evidence`: **2/5**
- Primární keyword shodný se vstupem: **4/5**
- Průměrná doba odpovědi úspěšných požadavků: **3490 ms**

## Témata a odpovědi

### 1. péče o seniory doma

```json
{
  "topic": "péče o seniory doma",
  "status": 200,
  "attempts": 1,
  "elapsed_ms": 3563,
  "result": {
    "topic": "péče o seniory doma",
    "primary_keyword": {
      "keyword": "24 hodinová péče o seniory doma",
      "score": "good"
    },
    "supporting_keywords": [
      {
        "keyword": "24 hodinová péče o seniory doma brno",
        "score": "good"
      },
      {
        "keyword": "24 hodinová péče o seniory doma ostrava",
        "score": "good"
      },
      {
        "keyword": "péče o seniory doma brno",
        "score": "good"
      },
      {
        "keyword": "péče o seniory doma ostrava",
        "score": "good"
      },
      {
        "keyword": "péče o seniory doma praha",
        "score": "good"
      },
      {
        "keyword": "péče o seniory doma",
        "score": "good"
      },
      {
        "keyword": "24 hodinová péče o seniory doma cena",
        "score": "okay"
      }
    ],
    "diversity_keywords": []
  }
}
```

### 2. cyklistické výlety na Moravě

```json
{
  "topic": "cyklistické výlety na Moravě",
  "status": 200,
  "attempts": 1,
  "elapsed_ms": 3392,
  "result": {
    "topic": "cyklistické výlety na Moravě",
    "primary_keyword": {
      "keyword": "cyklistické výlety na Moravě",
      "score": "no evidence"
    },
    "supporting_keywords": [],
    "diversity_keywords": []
  }
}
```

### 3. výběr matrace pro kvalitní spánek

```json
{
  "topic": "výběr matrace pro kvalitní spánek",
  "status": 200,
  "attempts": 1,
  "elapsed_ms": 3373,
  "result": {
    "topic": "výběr matrace pro kvalitní spánek",
    "primary_keyword": {
      "keyword": "výběr matrace pro kvalitní spánek",
      "score": "no evidence"
    },
    "supporting_keywords": [],
    "diversity_keywords": []
  }
}
```

### 4. minimalistické bydlení

```json
{
  "topic": "minimalistické bydlení",
  "status": 200,
  "attempts": 1,
  "elapsed_ms": 3579,
  "result": {
    "topic": "minimalistické bydlení",
    "primary_keyword": {
      "keyword": "minimalistické bydlení",
      "score": "okay"
    },
    "supporting_keywords": [],
    "diversity_keywords": []
  }
}
```

### 5. digitální marketing pro malé firmy

```json
{
  "topic": "digitální marketing pro malé firmy",
  "status": 200,
  "attempts": 1,
  "elapsed_ms": 3542,
  "result": {
    "topic": "digitální marketing pro malé firmy",
    "primary_keyword": {
      "keyword": "digitální marketing pro malé firmy",
      "score": "strong"
    },
    "supporting_keywords": [],
    "diversity_keywords": []
  }
}
```

## První interpretace

Tento soubor zachycuje raw výsledky a základní metriky. Detailní kvalitativní vyhodnocení a rozhodnutí o změnách ranking logic následuje v samostatném evaluation souboru.
