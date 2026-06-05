# LinkedIn Feed Scraper

API REST qui scrape le fil LinkedIn, score les posts par pertinence et les expose via des endpoints HTTP.

## Vue d'ensemble

```
POST /scrape             → lance un scrape du fil LinkedIn
GET  /posts              → liste tous les posts sauvegardés
GET  /posts/interesting  → posts au-dessus du seuil de pertinence
GET  /config             → configuration active
PUT  /config/interests   → met à jour les mots-clés d'intérêt
POST /config/cookies     → upload un nouveau fichier de cookies
GET  /health             → statut de l'API
```

Le scraper utilise [Scrapling](https://github.com/D4Vinci/Scrapling) avec `StealthyFetcher` (Patchright/Chromium headless) pour contourner les protections anti-bot de LinkedIn. L'authentification se fait exclusivement par cookies de session.

## Prérequis

- Python 3.12+
- Chromium (installé via Patchright, voir ci-dessous)

## Installation

```bash
# 1. Créer et activer le virtualenv
python -m venv .venv
source .venv/bin/activate

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Installer le navigateur Chromium (obligatoire)
patchright install chromium
```

> **Important** : sans `patchright install chromium`, tous les scrapes échouent silencieusement avec 0 posts trouvés.

## Configuration

Copier `.env.example` en `.env` et adapter :

```env
COOKIES_FILE=cookies.json          # chemin vers le fichier de cookies
POSTS_FILE=posts.json              # base de données locale des posts
INTEREST_KEYWORDS=QA,testing,quality assurance,automation,selenium,pytest
RELEVANCE_THRESHOLD=2.0            # score minimum pour /posts/interesting
MAX_SCROLL_ATTEMPTS=3              # nombre de passes de scraping
HEADLESS=true                      # false pour voir le navigateur
```

Les paramètres peuvent aussi être surchargés via `config_override.json` (créé automatiquement par `PUT /config/interests`).

## Authentification par cookies

Le scraper utilise les cookies de session LinkedIn. **Ils doivent être renouvelés régulièrement** (le cookie `__cf_bm` de Cloudflare expire en ~30 minutes, et la session complète en quelques semaines).

### Obtenir des cookies valides

1. Se connecter à LinkedIn dans Chrome/Firefox
2. Installer l'extension **Cookie Editor** ([Chrome](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) / [Firefox](https://addons.mozilla.org/fr/firefox/addon/cookie-editor/))
3. Sur `linkedin.com`, ouvrir Cookie Editor → **Export → Export as JSON**
4. Sauvegarder le fichier en `cookies.json` à la racine du projet

Le cookie critique est `li_at` (token de session). Les cookies `__cf_bm` et `lidc` expirent rapidement mais restent utiles tant qu'ils sont envoyés.

### Vérifier la validité des cookies

Un scrape qui retourne `error: "LinkedIn session expired or cookies invalid."` signifie que les cookies ne sont plus acceptés. Renouveler en suivant les étapes ci-dessus.

**Indicateurs de cookies expirés dans les logs :**
```
Fetched (302) <GET https://www.linkedin.com/feed/>
Fetched (307) <GET https://www.linkedin.com/uas/login?...>
Fetched (200) <GET https://www.linkedin.com/login/...>
```

**Indicateurs de cookies valides :**
```
Fetched (307) <GET https://www.linkedin.com/feed/>
Fetched (200) <GET https://www.linkedin.com/feed/>
```

### Upload via API (sans redémarrage)

```bash
curl -X POST http://localhost:8000/config/cookies \
  -F "file=@/chemin/vers/nouveaux_cookies.json"
```

## Démarrage

```bash
python main.py
```

L'API écoute sur `http://0.0.0.0:8000`. Documentation Swagger interactive : `http://localhost:8000/docs`.

## Utilisation

### Lancer un scrape

```bash
# Avec le nombre de passes par défaut (MAX_SCROLL_ATTEMPTS)
curl -X POST http://localhost:8000/scrape

# Avec un nombre de passes personnalisé
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"scroll_attempts": 5}'
```

Réponse :
```json
{
  "posts_found": 6,
  "posts_new": 6,
  "duration_seconds": 86.7,
  "error": null
}
```

### Lire les posts

```bash
# Tous les posts, triés par score décroissant
curl "http://localhost:8000/posts?limit=50&offset=0"

# Uniquement les posts pertinents (au-dessus du seuil)
curl "http://localhost:8000/posts/interesting"

# Avec un seuil personnalisé
curl "http://localhost:8000/posts/interesting?threshold=5.0"
```

Exemple de post retourné :
```json
{
  "urn": "urn:li:activity:7468153814831996928",
  "author": "Julian LUNEAU 🧬",
  "text": "La France vient de signer un deal massif...",
  "reactions": 1,
  "scraped_at": "2026-06-04T19:26:18Z",
  "score": 0.0,
  "matched_keywords": [],
  "url": "https://www.linkedin.com/feed/update/urn:li:activity:7468153814831996928/"
}
```

> **Note** : si aucun commentaire n'est rendu sur la page pour un post donné, l'URN sera du format `urn:li:post:hash:{hex}` et l'URL sera vide. L'URL est disponible dès qu'un vrai URN LinkedIn est récupéré lors d'un scrape ultérieur.

### Gérer les mots-clés d'intérêt

```bash
# Voir la config actuelle
curl http://localhost:8000/config

# Mettre à jour les mots-clés (re-score tous les posts existants)
curl -X PUT http://localhost:8000/config/interests \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["QA", "automatisation", "Playwright", "pytest"], "threshold": 3.0}'
```

## Algorithme de scoring

Chaque post reçoit un score basé sur la fréquence et le poids des mots-clés trouvés dans son texte :

- Chaque occurrence d'un mot-clé ajoute `nombre_de_mots_dans_le_mot_clé` points
- Un mot-clé multi-mots (ex : "quality assurance") vaut plus qu'un mot seul
- Les posts sont triés par score décroissant
- `score = 0` si aucun mot-clé ne correspond

Exemple : le texte contient "testing" (×2) et "quality assurance" (×1) :
- "testing" (1 mot) × 2 occurrences = 2 pts
- "quality assurance" (2 mots) × 1 occurrence = 2 pts
- **score total = 4.0** → apparaît dans `/posts/interesting` avec `RELEVANCE_THRESHOLD=2.0`

## Identifiants des posts (URN)

LinkedIn a migré son DOM en 2025 et n'expose plus directement les URNs d'activité dans les containers de posts. Le scraper utilise une stratégie hybride :

1. **URN réel** (`urn:li:activity:ID`) : extrait depuis les métadonnées de commentaires si ceux-ci sont rendus dans la page. Permet de construire l'URL directe du post.
2. **URN hash** (`urn:li:post:hash:HEX`) : généré depuis `MD5(auteur + texte[:200])` quand aucun URN réel n'est disponible. Stable entre les scrapes pour le même contenu, mais sans URL LinkedIn.

## Persistance

Les posts sont sauvegardés dans `posts.json` (chemin configurable via `POSTS_FILE`). Les re-scrapes upsertent les posts existants avec déduplication par URN. Les scores sont recalculés à chaque `PUT /config/interests`.

## Structure du projet

```
linkedin_scraper/
├── main.py              # point d'entrée uvicorn
├── app/
│   ├── api.py           # routes FastAPI
│   ├── config.py        # Settings (pydantic-settings + .env)
│   ├── cookies.py       # chargement et conversion des cookies
│   ├── models.py        # modèles Pydantic
│   ├── scraper.py       # logique de scraping (Scrapling/Patchright)
│   ├── scorer.py        # scoring par mots-clés
│   └── storage.py       # persistance JSON
├── cookies.json         # cookies LinkedIn (à créer, ignoré par git)
├── posts.json           # base de données locale (créé automatiquement)
├── .env                 # configuration locale (à créer depuis .env.example)
└── requirements.txt
```

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `error: "LinkedIn session expired..."` | Cookies expirés ou invalides | Ré-exporter les cookies via Cookie Editor |
| `posts_found: 0` sans erreur, durée ~0.3s | Chromium non installé | `patchright install chromium` |
| `posts_found: 0` sans erreur, durée ~8s | DOM LinkedIn changé ou cookies rejetés | Vérifier les logs serveur |
| Posts avec `url: ""` | URN non disponible (pas de commentaires visibles) | Normal — l'URN sera résolu au prochain scrape si des commentaires apparaissent |
| Doublons d'un même post | Post scrapé avec URN hash puis URN réel sur deux passes | Connu — se résout en ré-scrappant (l'upsert consolidera) |
| Port 8000 déjà utilisé | Instance déjà démarrée | `lsof -i :8000` puis `kill <PID>` |

## Notes techniques

- Le champ `sameSite` est **intentionnellement omis** lors de la conversion des cookies. Playwright/Patchright rejette les cookies avec `sameSite="None"` sans `secure=True`, ce qui cause des échecs d'authentification silencieux. Sans ce champ, le navigateur envoie tous les cookies correctement.
- Chaque passe de scrape (`scroll_attempts`) est un chargement complet de la page avec un délai croissant (5s, 7s, 9s, …) pour laisser le fil se charger.
- LinkedIn rend entre 3 et 8 posts par chargement de page selon le contexte de session et la vitesse réseau.
