# Ziza Transportation — Local stack Sprint 57 (Frontend 3: Web Admin MVP)

Sprint 29 rend **Admin** utilisable (MVP) et conserve Customer + Driver.
- Web Customer (MVP) : estimate, create trip, list/detail, cancel, receipt, notifications
- Web Driver (MVP)   : online/offline, location, available trips, accept, workflow, active trip + events, earnings + payouts, notifications
- Web Admin (MVP)    : dashboard metrics, trips, drivers (suspend), users, payments, payouts (run / run-async), jobs, email outbox (process), audit logs, notifications, assistances, pricing active, seed scenario

## Démarrage (recommandé)
```bash
docker compose down -v
docker compose up --build
```

## URLs
- Keycloak:      http://localhost:8080  (admin/admin)
- API Swagger:   http://localhost:8000/docs
- API Health:    http://localhost:8000/health
- Web Customer:  http://localhost:3000
- Web Driver:    http://localhost:3001
- Web Admin:     http://localhost:3002

## Création des comptes (bash)
⚠️ Sur Windows, lance ce script via **Git Bash** (ou WSL), pas CMD.
```bash
chmod +x scripts/create_users_keycloak.sh
bash scripts/create_users_keycloak.sh
```

Comptes par défaut:
- customer1@example.com / Passw0rd!
- driver1@example.com   / Passw0rd!
- admin1@example.com    / Passw0rd!


## Sprint 29
Fondation UX (UI shared, toasts, loaders, guards) + quality gate build frontend.


## Frontend build fix (Sprint 29)
Les web-apps utilisent un package partagé `packages/shared`. Les images Docker sont maintenant construites avec le **contexte monorepo (.)** pour inclure ce dossier.


## Sprint 29 fix2
Corrige le build frontend: ajout des `paths` TypeScript pour `@shared/*` + import ToastProvider.


## Sprint 29 fix3
- Ajout d’un healthcheck API + worker dépend de l’API healthy (évite `jobs does not exist`).

## Sprint 52 – Notifications et communications
Ce sprint se concentre sur l’implémentation d’un service de notifications et de communication. Les principaux objectifs sont :

- **Notifications en temps réel** : Ajout d’un service WebSocket ou SSE pour envoyer des mises à jour instantanées (nouvelle course, changement de statut, confirmation de paiement, etc.) vers les apps Web Customer et Web Driver.
- **Envoi d’e-mails et de SMS transactionnels** : Mise en place d’un module de messagerie pour les confirmations de réservation, les reçus et les rappels, avec une file d’attente pour le traitement en arrière‑plan.
- **Messagerie in‑app** : Première ébauche d’un canal de communication entre client et chauffeur accessible depuis la page de trajet.
- **Service asynchrone** : Création d’un worker/job dédié pour traiter les messages et notifications, afin d’éviter de bloquer l’API principale.

Ces fonctionnalités constituent le socle de communication du système et préparent les prochains sprints pour l’intégration de l’analytics et de la sécurité renforcée.

## Sprint 53 – Analytics et reporting avancés
Le but de ce sprint est d’ajouter des fonctionnalités d’analytics et de reporting pour les administrateurs et d’optimiser la performance des requêtes. Les principaux objectifs sont :

- **Tableaux de bord analytiques** : création de vues et d’API permettant de suivre les indicateurs clés (nombre de trajets, revenus par période, temps d’attente moyen, zones les plus actives). Mise en place de heatmaps géographiques sur les trajets.
- **Exports CSV/PDF** : ajout de fonctionnalités d’exportation des données (liste des trajets, comptes utilisateurs, paiements) en CSV ou PDF via l’interface admin, avec pagination et filtres avancés.
- **Optimisation des requêtes et indexation** : revue des requêtes SQL pour réduire les temps de réponse, ajout d’index là où nécessaire et mise en cache des requêtes fréquentes.
- **Sécurité et permissions** : ajout de contrôles d’accès granulaires pour les rapports sensibles (par exemple, seuls les administrateurs financiers peuvent voir les rapports de paiement détaillés).

Ce sprint prépare également l’intégration future de fonctionnalités de sécurité renforcée en revoyant les accès et en s’assurant que les analytics respectent la protection des données.

## Sprint 54 – Sécurité et conformité
Ce sprint se concentre sur le renforcement de la sécurité de la plateforme et la conformité aux bonnes pratiques.  Les objectifs majeurs comprennent :

- **Chiffrement des données sensibles** : mise en œuvre du chiffrement en transit (HTTPS/TLS) et au repos pour les données personnelles et les informations de paiement.  Ajout de variables d’environnement pour configurer les certificats et les clés.
- **Rate‑limiting et prévention des abus** : intégration d’un middleware limitant le nombre de requêtes par IP ou utilisateur pour les endpoints sensibles afin de prévenir les attaques par force brute ou déni de service.
- **Renforcement de Keycloak** : configuration de l’authentification multi‑facteur (MFA), rotation des secrets, politiques de mots de passe et ajout de logs d’audit plus fins.  Mise à jour du script `create_users_keycloak_v6.sh` en conséquence.
- **Audit de dépendances et corrections de vulnérabilités** : utilisation d’outils d’analyse (npm audit, pip audit) pour identifier les vulnérabilités connues dans les dépendances et appliquer les mises à jour nécessaires.  Ajout d’un rapport de sécurité dans la documentation.
- **Mise en conformité RGPD/CCPA** : revue des flux de données pour assurer la minimisation des informations collectées, ajout d’un mécanisme de suppression et d’anonymisation des données sur demande.

À l’issue de ce sprint, l’application doit respecter des critères de sécurité élevés et disposer d’une documentation claire sur la configuration et la gestion des secrets.

## Sprint 55 – Performance et scalabilité
Ce sprint vise à préparer la montée en charge du système et à améliorer les temps de réponse. Les objectifs incluent :

- **Mise en cache et partitionnement** : implémentation d’un cache (Redis ou équivalent) pour les requêtes fréquentes et étude du partitionnement de la base de données.
- **Tests de charge et auto‑scaling** : mise en place d’outils de stress test (Locust, k6) pour simuler des pics de trafic et ajuster la configuration de scaling de Cloud Run en conséquence.
- **Optimisation des images Docker** : réduction de la taille des images en utilisant des builds multi‑étapes et un meilleur usage du cache BuildKit.
- **Modularisation** : évaluation de la séparation des modules (paiements, notifications, analytics) en micro‑services pour améliorer la scalabilité.
- **Monitoring et alerting** : ajout de métriques (latence, utilisation CPU/RAM, taux d’erreurs) et configuration d’alertes via Google Cloud Monitoring.

## Sprint 56 – Validation finale et release
Dernier sprint avant la mise en production, il se concentre sur la finition, la stabilité et la préparation de la sortie. Les principales actions sont :

- **Bêta testing et corrections de bugs** : organiser une phase de bêta interne/externes afin de recueillir des retours utilisateurs, identifier les anomalies restantes et les corriger.
- **Documentation complète** : finaliser la documentation utilisateur et développeur (README, guides d’API, procédures de déploiement) et rédiger un guide d’exploitation pour l’équipe Ops.
- **Scripts et automatisation** : consolider les scripts de démarrage (inclure la construction des web front‑ends dans `scripts/demo_start.sh`) et s’assurer que toutes les dépendances sont mises à jour.
- **Nettoyage du backlog** : traiter les tickets en suspens, fermer les demandes de fusion/PR et s’assurer qu’aucune tâche critique n’est reportée.
- **Préparation du déploiement** : mettre à jour les secrets et les configurations pour l’environnement de production, vérifier les politiques IAM et prévoir une fenêtre de mise en production.

Ce sprint doit aboutir à une version stable et documentée, prête pour la mise en production ou une présentation à de premiers utilisateurs pilotes.

## Sprint 57 – Lancement en production et suivi post‑release
Dernier jalon de la roadmap, ce sprint vise à mettre le système en production et à organiser le suivi post‑lancement. Les principales actions incluent :

- **Déploiement contrôlé** : mise en production graduelle (canary ou blue/green) pour minimiser les risques et surveiller les indicateurs clés (erreurs, latence, taux de conversion).
- **Mise en place des SLO/SLA** : définition des objectifs de disponibilité et de performance (par exemple, 99,9 % de disponibilité et réponse <200 ms) et configuration des dashboards et alertes correspondants.
- **Runbooks et formation** : création de documents opérationnels (procédures de récupération, gestion des incidents, escalade) et formation des équipes support et exploitation.
- **Communication et marketing** : rédaction des notes de version, planification des communications (mailing list, réseaux sociaux) et coordination avec l’équipe marketing pour annoncer le lancement.
- **Collecte de feedbacks et plan de maintenance** : mise en place d’outils pour recueillir les retours utilisateurs (formulaires in‑app, support) et élaboration d’un plan pour les mises à jour et la maintenance corrective/évolutive.

Au terme de ce sprint, la solution Ziza Transportation devra être disponible en production, surveillée et soutenue par une équipe formée, avec un processus clair pour gérer les retours et les incidents.


## Fix frontend ports (Sprint 29 fix4)
Les web-apps sont maintenant buildées avec le **contexte monorepo** pour inclure `packages/shared`.
URLs :
- http://localhost:3000 (customer)
- http://localhost:3001 (driver)
- http://localhost:3002 (admin)

Si une URL ne répond pas, regarde :
```bash
docker compose ps
docker compose logs -f web-customer
docker compose logs -f web-driver
docker compose logs -f web-admin
```


## Fix5 (frontend build)
Ajoute un `package.json` à `packages/shared` et installe ses dépendances dans les Dockerfiles web pour que TypeScript puisse résoudre `react` depuis les fichiers partagés.


## Sprint 29 (Customer UX)
Customer: parcours « Request ride » avec stepper + tracking/polling + UI plus lisible.


## Sprint 29 (Driver UX)
Driver: mission flow (map placeholder + status timeline + auto-refresh), auto location sender (demo).


## Sprint 29 (Admin UX)
Admin: dashboard cards + filters/search + trip detail timeline + map placeholder, no functional backend change.


## Sprint 29 (Customer Ride Tracking V1)
Customer: page de tracking dédiée (/track/:tripId) + UI claire (timeline, actions, auto-refresh). **Aucun changement backend** dans ce sprint.


## Sprint 29 (Driver Ops terrain V1)
Driver: UX mission plus guidée (next action, boutons contextualisés), accept -> navigation mission, earnings UX. **Aucun changement backend**.


## Fix issuer token (Invalid issuer)
Ce sprint inclut un correctif Keycloak pour que l'`issuer` des tokens corresponde à l'URL utilisée par le frontend.

- Keycloak émet maintenant des tokens avec `iss = http://localhost:8080/realms/ziza`

Après extraction:
```bash
docker compose down -v
docker compose up --build
```
Puis reconnecte-toi (vider cookies/local storage si besoin).

## Fix2 (shared router dependency)
Ajoute `react-router-dom` dans `packages/shared` car `NavItem` l'utilise. Corrige aussi le typage `isActive`.


## Fix: Invalid token (issuer) — investigation result
**Origine** : le backend (API) validait l'issuer avec l'URL interne Docker (`http://keycloak:8080/...`) alors que les tokens navigateur ont `iss=http://localhost:8080/...`.

**Correctif backend** :
- `apps/api/auth.py` accepte `OIDC_ALLOWED_ISSUERS` (localhost + keycloak)
- `OIDC_JWKS_URL` reste interne pour récupérer les clés
- suppression de `OIDC_ISSUER` côté API (compose) remplacé par `OIDC_ISSUER_PUBLIC/INTERNAL`

⚠️ Après extraction :
```bash
docker compose down -v
docker compose up --build
```
Puis reconnecte-toi (vider cookies/localStorage si besoin).

## Sprint 29 (Admin Console V1)
Admin: actions plus sûres (confirm), pages Jobs/Outbox/Payouts plus guidées, filtres et UX consolidés.

### Backend change
- **Cosmétique uniquement**: titre/version FastAPI mis à jour en "Local Sprint 29".
- **Aucun changement auth / DB / endpoints** → pas besoin de relancer les scripts Keycloak pour ce sprint.

### Keycloak
Script officiel à utiliser et relancer si un sprint modifie l'auth:
```bash
bash scripts/create_users_keycloak_v6.sh
```

## Sprint 29 (Polish & hardening)
- Hard gate by role (driver/admin) on respective web apps.
- Better 401/403 UX with clear "Access denied" + relog/refresh.
- Small UX polish (loaders, messages).
### Backend
No functional change (cosmetic version bump only). No need to rerun Keycloak script.


## Sprint 29 fix (npm install seems stuck)
This fix makes Docker npm installs more reliable:
- disables audit/fund/progress
- sets fetch retry timeouts and loglevel=info (so you see progress)
- adds .npmrc at repo root

Build command:
```bash
docker compose up --build web-customer web-driver web-admin
```


## Sprint 29 npm fix2 (builds feel stuck)
The build is not frozen; npm downloads can take minutes, and parallel builds (3 web apps) amplify it.

This fix:
- enables Docker BuildKit cache mounts for npm (`/root/.npm`) so subsequent builds are much faster
- keeps npm quieter and more reliable (no audit/fund, prefer-offline)

Recommended (sequential) build if your network is slow:
```bash
docker compose build web-customer
docker compose build web-driver
docker compose build web-admin
docker compose up -d web-customer web-driver web-admin
```

## Sprint 29
- Remove verbose npm install logs in Dockerfiles (quieter builds).
- Map Preview V0 (no extra npm deps): "Open in OpenStreetMap" links + embedded map centered between points.
### Backend
Cosmetic only: title/version bump. No auth/DB/endpoints changes → no need to rerun Keycloak script.

## Sprint 30 (Local dev experience)
This sprint focuses on local productivity (no Google Cloud objective):

- `scripts/doctor.sh` : quick health check (API/Keycloak/Web)
- `scripts/build_web_sequential.sh` : builds web images sequentially (recommended on slow networks)
- `scripts/up_core.sh` / `scripts/up_web.sh` / `scripts/reset_all.sh`
- `scripts/seed_3_rides.sh` : populate DB with 3 demo rides (customer1 + driver1)

### Keycloak (roles/users)
Official script:
```bash
bash scripts/create_users_keycloak_v6.sh
```
Re-run it when a sprint changes backend/auth/docker-compose auth.

## Sprint 31 (Local smoke & demo)
Local-only sprint (no Google Cloud objective).

New scripts:
- `scripts/smoke.sh` : validates auth (roles), /me endpoints, and a complete trip flow
- `scripts/demo_start.sh` : bring up core + users/roles + web + seed rides

Run:
```bash
bash scripts/smoke.sh
```

Or full demo:
```bash
bash scripts/demo_start.sh
```

## Sprint 32 (Keycloak hardening)
Fixes the recurring Keycloak error:
`{"error":"invalid_grant","error_description":"Account is not fully set up"}`

Changes:
- `scripts/create_users_keycloak_v6.sh` now clears user `requiredActions`, forces `enabled=true` and `emailVerified=true` after password reset.
- Adds `scripts/fix_keycloak_account_setup.sh` as a manual recovery tool.

Usage:
```bash
bash scripts/create_users_keycloak_v6.sh
# If you still see invalid_grant:
bash scripts/fix_keycloak_account_setup.sh
```

## Sprint 33 (Visual system v0)
Start of visual consolidation across the 3 web apps (Customer/Driver/Admin).

- Design tokens: `packages/shared/src/ui/tokens.css`
- Token-based shared components: `Card`, `Button`, `Badge`, `ErrorBanner`, `Loader`
- Unified app shell/topbar/nav across the 3 apps

No backend/auth change in this sprint.

## Sprint 34 (Visual polish V1)
- Customer: Estimate + Tracking layout polish (2-column grid, clearer headings, tables styled)
- Driver: Mission + Availability layout polish (2-column grid, headings, tables styled)
- Admin: Dashboard metrics grid polish, tables styled

No backend/auth changes.

## Sprint 35 (Polish: a11y + micro UX)
- Better Toast UI (typed, fixed position, auto-dismiss)
- Better input/select/textarea styling + focus-visible outline
- RoleGate: adds "Refresh token" button (helps after role change without full logout)
No backend/auth changes.

## Sprint 36 (Admin: customer → driver)
Admin can grant/revoke the `driver` realm role in Keycloak from the Admin web app.

Backend:
- API can call Keycloak Admin REST API to manage realm roles.
- `/v1/admin/users` now includes `roles` (from Keycloak) and `created_at`.

Endpoints:
- `POST /v1/admin/iam/users/{oidc_sub}/roles/add?role=driver`
- `POST /v1/admin/iam/users/{oidc_sub}/roles/remove?role=driver`
- `POST /v1/admin/iam/promote-driver?email=...`

Keycloak script:
- Re-run `bash scripts/create_users_keycloak_v6.sh` only if you reset volumes or need demo users.

## Sprint 37 (Driver onboarding V1 + Customer dashboard nav fix)
Frontend:
- web-customer: restores **Dashboard** button in nav (Dashboard is `/`, Estimate is `/estimate`)
- customer can **apply to become driver** from Dashboard
- web-driver: if user has `driver_pending` role, shows "Onboarding pending" instead of generic access denied
- web-admin: new **Onboarding** page to approve/reject driver applications

Backend:
- New table `driver_applications` (alembic revision 0002)
- Customer endpoints:
  - `GET /v1/customer/driver/application`
  - `POST /v1/customer/driver/apply`
- Admin endpoints:
  - `GET /v1/admin/driver-applications`
  - `POST /v1/admin/driver-applications/{id}/approve`
  - `POST /v1/admin/driver-applications/{id}/reject`

Keycloak:
- New realm role: `driver_pending`
- Because auth/roles changed, re-run:
```bash
bash scripts/create_users_keycloak_v6.sh
```

## Sprint 38 (Booking V2 + build fix)
Fix:
- Fixes API build error in `main.py` (broken `from models import ...`) that caused `SyntaxError: invalid syntax`.

Customer Booking V2:
- Adds a 3-step customer flow:
  1) Estimate (`/estimate`)
  2) Confirm (`/confirm`)
  3) Track (`/track`)
- Dashboard stays at `/` (restores dashboard nav).

## Sprint 39 (Fix Alembic migration chain)
Fixes startup crash:
- Alembic KeyError: '0001' because migration `0002_driver_applications.py` referenced `down_revision="0001"` while initial migration id is `revision="0001_init"`.

Change:
- `apps/api/alembic/versions/0002_driver_applications.py`: `down_revision` corrected to `"0001_init"`.

Note:
- If your DB volume is in a broken state from previous runs, do a full reset:
  `docker compose down -v` then `docker compose up --build`

## Sprint 40 (Alembic startup fix for existing volumes)
### Problem
Some existing DB volumes contain `alembic_version.version_num = 0001` from older sprints.
But current code uses initial revision id `0001_init`, which caused:

- `UserWarning: Revision 0001 ... is not present`
- `KeyError: '0001'`

### Fix
`apps/api/start.sh` now runs a small **compat shim** before `alembic upgrade head`:
- if it finds `alembic_version = 0001`, it updates it to `0001_init`.

This avoids forcing `docker compose down -v` just to recover.

## Sprint 41 (Frontend build fix)
Fixes TypeScript build error in web-customer:

- `src/ui/pages/Estimate.tsx`: `useNavigate` was used but not imported (TS2304).
  Added `import { useNavigate } from "react-router-dom";` and ensured `const nav = useNavigate();`

No backend/auth changes in this sprint.

## Sprint 42 (Driver Earnings V2)
Backend:
- Adds `GET /v1/driver/earnings/summary?days=N` returning trip count + total cents (simple MVP proxy).

Frontend:
- Driver Earnings page upgraded: period selector, summary cards, payouts table.

## Sprint 43 (Assistance dépannage V1)
Adds a first end-to-end slice for roadside assistance.

Backend:
- Customer:
  - `POST /v1/customer/assistance` (lat,lng,note)
  - `GET /v1/customer/assistance`
- Driver:
  - `GET /v1/driver/assistance/available`
  - `POST /v1/driver/assistance/{id}/accept`
  - `POST /v1/driver/assistance/{id}/complete`
- Admin:
  - `GET /v1/admin/assistance`
  - `POST /v1/admin/assistance/{id}/close`

Frontend:
- Customer: new Assistance page
- Driver: new Assistance page
- Admin: new Assistance page

No new Keycloak roles.

## Sprint 44 (Observabilité & diagnostics)
Backend:
- Adds correlation id middleware (response header `X-Correlation-Id`, logs include cid + duration)
- New endpoints:
  - `GET /v1/system/version` (public)
  - `GET /v1/admin/system/status` (admin) => DB + Keycloak checks + counts

Admin UI:
- New page `/system` to view DB/Keycloak status and counts.

Scripts:
- `scripts/doctor.sh` includes version check
- `scripts/smoke.sh` pings `/v1/system/version`

## Sprint 45 (Sécurité & robustesse)
Backend:
- CORS allow-list configurable via `CORS_ALLOW_ORIGINS` (default localhost:3000/3001/3002)
- Security headers added to responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- Rate limiting now supports per-bucket limits via `RL_BUCKETS`
  - Default: `admin_sensitive=30:60,auth=60:60`
- Sensitive admin endpoints use stricter bucket `admin_sensitive`

Docker compose:
- Adds `CORS_ALLOW_ORIGINS` and `RL_BUCKETS` env vars to `api`.

No Keycloak changes required.

## Sprint 46 (Local Release Candidate)
Adds:
- `scripts/release_checklist.sh`: one-command release validation (core + users + web + doctor + smoke + seed)
- `LOCAL_RELEASE.md`: concise local release guide
- `Makefile`: convenience targets

No functional changes besides the release tooling.

## Sprint 50 (Realtime-lite V1)
Frontend:
- Customer Track: auto-refresh toggle (polls every 3s) + last update timestamp
- Driver Mission: auto-refresh toggle (polls every 3s) + last update timestamp
- Driver Availability: auto-refresh toggle (polls every 4s)

Backend:
- No functional changes (only sprint/version label).
