#!/usr/bin/env bash
# Deploy Han Tutor to Google Cloud Run (Seoul region by default).
# Data (data/db.json) is kept in a Cloud Storage bucket mounted at /data,
# so it survives restarts and redeploys. Secrets live in Secret Manager.
#
# Usage:
#   PROJECT_ID=my-project ./deploy/cloudrun.sh
# First run asks for the Gemini API key and admin password (stored in Secret Manager).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-northeast3}"
SERVICE="${SERVICE:-han-tutor}"
BUCKET="${BUCKET:-${PROJECT_ID}-han-tutor-data}"

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com

# Storage bucket for the database file
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access

# Secrets (created once; update later with: gcloud secrets versions add NAME --data-file=-)
ensure_secret() {
  local name="$1" prompt="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    read -r -s -p "$prompt: " value; echo
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic
  fi
}
ensure_secret han-tutor-gemini-key "Gemini API key (type none for demo mode)"
ensure_secret han-tutor-admin-password "Teacher admin password"

# Service account used by the running service
SA="han-tutor-run@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create han-tutor-run --display-name="Han Tutor Cloud Run"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
for s in han-tutor-gemini-key han-tutor-admin-password; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null
done

# One instance only: the JSON-file database must have a single writer.
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --service-account "$SA" \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 1 \
  --memory 512Mi --cpu 1 \
  --execution-environment gen2 \
  --add-volume name=data,type=cloud-storage,bucket="$BUCKET" \
  --add-volume-mount volume=data,mount-path=/data \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=han-tutor-gemini-key:latest,ADMIN_PASSWORD=han-tutor-admin-password:latest

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
