#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ziza-mobility"
REGION="us-east1"
REPO="ziza"
SA_NAME="ziza-deployer-staging"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICES=(
  "ziza-backend-staging"
  "ziza-web-customer-staging"
  "ziza-web-driver-staging"
  "ziza-web-admin-staging"
)

echo "[1/6] Configuration projet gcloud"
gcloud config set project "$PROJECT_ID"

echo "[2/6] Activation APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com

echo "[3/6] Création Artifact Registry (si absent)"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Ziza Mobility Docker images" || true

echo "[4/6] Création Service Account staging (si absent)"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Ziza Staging Deployer" || true

echo "[5/6] Attribution rôles IAM"
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor
 do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" >/dev/null
 done

echo "[6/6] Déploiement placeholder services Cloud Run"
for svc in "${SERVICES[@]}"; do
  gcloud run deploy "$svc" \
    --image="us-docker.pkg.dev/cloudrun/container/hello" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated
 done

echo "✅ Staging GCP provisionné (placeholder)."
