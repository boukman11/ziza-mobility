# Sprint 59 — Changelog technique

## Backend API
- Ajout de `GET /v1/system/onboarding/checklist` pour fournir une checklist onboarding par rôle (`customer`, `driver`, `admin`).
- Endpoint pensé pour alimenter les parcours guidés Sprint 59 côté front.

## Tests
- Ajout de `apps/api/tests/test_onboarding_checklist.py`.

## Packaging local
- Ajout de `scripts/package_sprint59.sh` pour générer une archive ZIP locale du sprint courant.
