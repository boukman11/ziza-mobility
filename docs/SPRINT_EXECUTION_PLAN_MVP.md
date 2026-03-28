# Ziza Mobility — Plan d'exécution agile (Sprints 58 à 62)

## Objectif produit (MVP)
Livrer un MVP déployé en environnement cloud, stable, sécurisé et démontrable pour un pilote réel (customers + drivers + admins), avec une UX cohérente sur les 3 front-ends.

## Date cible MVP (mise à jour)
- **Aujourd'hui : 28 mars 2026**
- **Date cible MVP : 30 mars 2026 (dans 2 jours)**
- Démarrage livraison des sprints: **immédiat (Sprint 58 démarre aujourd'hui)**

## Gouvernance agile (agents/rôles)
- **Product Owner (PO)** : priorise le backlog, arbitre la valeur business, valide les user stories.
- **Scrum Master** : cadence (planning/daily/review/retro), enlève les blocages, suit les risques.
- **Dev Team** : backend, web-customer, web-driver, web-admin, QA, DevOps, sécurité.
- **Stakeholders** : revue de sprint, feedback sur UX, décisions sur priorités.

## Cadence recommandée
- Sprint 58 en mode accéléré (J0 → J2) pour tenir le MVP.
- Sprints 59 à 62 en itérations hebdomadaires pour stabilisation et montée en charge.

## Exigences transverses à intégrer dès le sprint 58
1. **Commentaires de code obligatoires** sur les parties critiques (auth, paiement, dispatch, sécurité).
2. **Documentation dans GitHub** à chaque sprint (README, docs techniques, runbooks).
3. **Definition of Done (DoD)** enrichie :
   - tests automatisés passants,
   - couverture minimale ciblée,
   - documentation mise à jour,
   - notes de release.

## Backlog proposé (S58 → S62)

### Sprint 58 — Livraison MVP + staging GCP (démarrage immédiat)
- Créer l'infrastructure **staging** GCP immédiatement.
- Déployer backend + 3 fronts sur Cloud Run (images placeholder puis images applicatives).
- Finaliser les améliorations UX prioritaires (écrans critiques).
- Préparer plan de passage en production (phase suivante).

**Livrables**
- Staging GCP opérationnel
- MVP déployé en staging avant le 30 mars 2026
- Liste des correctifs P1 post-MVP

### Sprint 59 — Stabilisation post-MVP
- Corriger incidents P1/P2 remontés en staging.
- Renforcer monitoring et alerting.
- Lancer onboarding guidé (v1).

### Sprint 60 — Accessibilité et responsive
- Responsive mobile/tablette.
- Audit accessibilité + correctifs prioritaires.
- Notifications enrichies v1.

### Sprint 61 — Préparation production GCP
- Provisionner infrastructure prod.
- Tester stratégie blue/green ou canary.
- Valider rollback et runbooks.

### Sprint 62 — Durcissement final
- Régression complète.
- Optimisations performance.
- Go/no-go production avec stakeholders.

## KPIs de pilotage
- Taux de succès des parcours critiques (commande, acceptation, paiement)
- Latence P95 API et temps de chargement front
- Taux d'erreurs backend/frontend
- Nombre de bugs bloquants en fin de sprint
- Satisfaction utilisateur (feedback UAT)

## Rituels de documentation (obligatoire)
À la fin de chaque sprint:
1. Mettre à jour `docs/changelog-sprint-XX.md`.
2. Mettre à jour la section "Known issues".
3. Ajouter captures d’écran des changements UX.
4. Documenter dettes techniques et décisions d’architecture.
