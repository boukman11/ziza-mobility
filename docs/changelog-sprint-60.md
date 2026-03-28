# Sprint 60 — Changelog technique

## Backend API
- Ajout de `GET /v1/user/accessibility` pour retourner les préférences accessibilité utilisateur.
- Ajout de `PUT /v1/user/accessibility` pour mettre à jour `highContrast`, `reducedMotion` et `fontScale` (borné entre 0.8 et 1.6).

## Tests
- Ajout de `apps/api/tests/test_accessibility_preferences.py`.

## Packaging local
- Ajout de `scripts/package_sprint60.sh` pour créer un ZIP local du sprint 60.
