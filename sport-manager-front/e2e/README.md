# Tests E2E (Playwright)

## Prérequis
- Node.js >= 18.19 (Playwright)
- Backend local démarré (fff_api) + DB avec un match stable.
- Front lancé automatiquement par Playwright (Vite dev server).

## Variables d’environnement
- Recommandé: créer un fichier `.env.e2e` à la racine du front (voir `.env.e2e.example`).
- `E2E_EMAIL` : compte coach/admin
- `E2E_PASSWORD` : mot de passe
- `E2E_EVENT_ID` : id d’événement (route `/match-center/:id`)
- (optionnel) `E2E_BASE_URL` : par défaut `http://127.0.0.1:5173`

## Lancer
Depuis `sport-manager-front/` :
- `npm run test:e2e`
- `npm run test:e2e:ui`

Exemple:
```bash
E2E_EMAIL="coach@club.com" \
E2E_PASSWORD="..." \
E2E_EVENT_ID="0d2b5926-2479-46e2-967d-f0ce578bd5fe" \
npm run test:e2e
```

Ou via `.env.e2e`:
```bash
cp .env.e2e.example .env.e2e
npm run test:e2e
```

## Installer les navigateurs Playwright
Une fois sur la machine:
- `npx playwright install chromium`
