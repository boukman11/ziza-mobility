# Déploiement Ziza Mobility sur Google Cloud Run — Pré-requis Codex

Ce document liste ce dont j'ai besoin pour connecter et publier l'application en services GCP.

## 1) Accès GCP requis
- **Project ID GCP** cible (ex: `ziza-prod-xxxx`).
- **Région de déploiement** (ex: `europe-west1`).
- Validation de l'environnement cible : `dev`, `staging`, `prod`.

## 2) IAM / sécurité
- Un **Service Account de déploiement** avec rôles minimum:
  - Cloud Run Admin
  - Artifact Registry Writer
  - Service Account User
  - (optionnel) Secret Manager Secret Accessor
- Si GitHub Actions est utilisé:
  - **Workload Identity Federation (WIF)** configurée
  - Provider OIDC + binding entre repo GitHub et service account

## 3) Registry & images
- Nom du **repository Artifact Registry**.
- Convention de tags (commit SHA, semver, latest).
- Politique de rétention des images.

## 4) Variables d'environnement & secrets
- Liste des variables par service (`backend`, `web-customer`, `web-driver`, `web-admin`).
- Secrets à injecter depuis Secret Manager:
  - Keycloak (realm/client IDs/secrets)
  - DB URL / credentials
  - clés paiement
  - clés notifications

## 5) Réseau et sécurité applicative
- Exposition publique/privée de chaque service.
- Politique CORS par environnement.
- Domaines custom et certificats TLS.
- Rate limiting / Cloud Armor (si requis).

## 6) Base de données et dépendances externes
- Type de DB et mode de connexion (Cloud SQL ou autre).
- Stratégie de migration de schéma (pré-déploiement/post-déploiement).
- Services tiers nécessaires (paiement, messagerie, push).

## 7) CI/CD attendu
- Stratégie de déploiement: rolling, canary, blue/green.
- Conditions de promotion (dev -> staging -> prod).
- Tests obligatoires avant déploiement (unit/integration/smoke).
- Plan de rollback automatique/manual.

## 8) Observabilité et exploitation
- Dashboard de monitoring (latence, erreurs, saturation).
- Alertes (SLO/SLA) et canaux (email/slack).
- Centralisation des logs et traçabilité des requêtes.

## 9) Livrables que je peux fournir dès réception des accès
1. Pipeline GitHub Actions prêt pour build + push + deploy.
2. Fichiers de configuration Cloud Run par service.
3. Runbook de release + rollback.
4. Checklist de validation post-déploiement.

## Informations à me transmettre pour démarrer
Merci de partager:
1. `GCP_PROJECT_ID`
2. `GCP_REGION`
3. Nom(s) des services Cloud Run souhaités
4. Détails WIF/OIDC (provider + service account)
5. Liste des variables/secrets par service
6. Domaine(s) publics à configurer

## Informations reçues (confirmées)
- `GCP_PROJECT_ID`: `ziza-mobility`
- `GCP_REGION`: `us-east1`
