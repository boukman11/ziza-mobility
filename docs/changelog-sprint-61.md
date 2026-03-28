# Sprint 61 — Correctif critique mission driver

## Bug corrigé
- Correction d'une erreur `Failed to fetch` lors de l'acceptation d'un trajet par un driver.
- Cause racine: appel à `enqueue_email(...)` inexistant dans `notify_user`, déclenchant une exception après l'acceptation du trajet.

## Correctif technique
- Ajout de la fonction `enqueue_email(...)` dans `apps/api/main.py`.
- Le helper met en file l'email dans `email_outbox` et protège le flux API via `try/except` + `rollback`.
- Résultat: l'acceptation de trajet ne casse plus le flux Mission côté driver.

## Tests
- Ajout de `apps/api/tests/test_notifications_email_queue.py` pour éviter la régression (présence/callable du helper).
