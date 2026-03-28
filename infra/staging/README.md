# Infrastructure Staging GCP (démarrage immédiat)

Ce dossier prépare la mise en place de l'environnement **staging** sur Google Cloud pour Ziza Mobility.

## Contexte
- Date de démarrage: **28 mars 2026**
- Project: `ziza-mobility`
- Region: `us-east1`
- Objectif: disposer d'un staging opérationnel pendant le Sprint 58.

## Services Cloud Run prévus
- `ziza-backend-staging`
- `ziza-web-customer-staging`
- `ziza-web-driver-staging`
- `ziza-web-admin-staging`

## Provisioning rapide
Utiliser le script:

```bash
bash scripts/provision_staging_gcp.sh
```

Le script:
1. Active les APIs nécessaires.
2. Crée le repository Artifact Registry.
3. Crée le service account de déploiement staging.
4. Attribue les rôles IAM minimum.
5. Prépare les services Cloud Run (déploiement initial placeholder).

## Pré-requis locaux
- `gcloud` installé et authentifié
- permissions IAM suffisantes sur le projet
- Docker/Artifact Registry access

## Étape suivante
Après validation staging, reproduire la même approche dans `infra/prod` avec paramètres prod.
