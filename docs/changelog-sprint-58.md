# Sprint 58 — Changelog technique

## Backend API
- Ajout de l'endpoint `GET /v1/system/readiness` pour les checks d'infrastructure staging/prod.
- Ajout de la fonction utilitaire `system_readiness_snapshot` documentée pour centraliser les vérifications de santé runtime.
- Correction des imports FastAPI pour middleware (`Request`, `Response`).

## Tests
- Ajout d'un `conftest.py` pour fiabiliser les imports Python des modules `main/models/worker` depuis les tests.
- Ajout d'un test d'API `test_system_readiness.py` validant la structure de la réponse readiness et la lecture des variables GCP.

## DevOps
- Script de provisioning staging conservé: `scripts/provision_staging_gcp.sh`.
