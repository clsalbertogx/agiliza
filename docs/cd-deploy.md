# Production CD — Staging Deploy & Rollback

Part of **Sprint 11 Item 4** (Production CD). Extends `.github/workflows/cd.yml`.

## What it does

Pushing a tag matching `v*.*.*` (e.g. `v0.11.0`) triggers the CD pipeline:

1. **`build-and-push`** — builds the backend + frontend images, pushes them to GHCR
   (`ghcr.io/clsalbertogx/agiliza/<service>:<tag>` plus `:latest`), and smoke-tests the
   backend container against `http://localhost:8080/api/health`.
2. **`deploy-staging`** — SSHes into the staging box and:
   - pulls the newly released images (tag = git tag),
   - preserves the last running release under `:previous`,
   - pins `:latest` to the new release,
   - `docker compose up -d --force-recreate`,
   - polls `http://localhost:3333/api/health` (up to 30 × 2s),
   - on health-check failure, re-pins `:previous -> :latest` and recreates (**rollback**).

The `concurrency` guard (`group: cd-${{ github.ref }}`) prevents parallel deploys of the
same tag/ref.

## Required GitHub secrets

Add these in **Settings → Secrets and variables → Actions** (this repo):

| Secret | Purpose |
|--------|---------|
| `STAGING_HOST` | Hostname/IP of the staging server (SSH, port 22) |
| `STAGING_USER` | SSH user on the staging server, with `docker` access |
| `STAGING_KEY` | SSH private key (PEM) authorized on the staging server |
| `STAGING_PATH` | Directory on the server containing `docker-compose.staging.yml` + `.env.staging` |

```bash
gh secret set STAGING_HOST --body 'staging.example.com'
gh secret set STAGING_USER --body 'deploy'
gh secret set STAGING_KEY --body "$(cat ~/.ssh/agiliza_staging_ed25519)"
gh secret set STAGING_PATH --body '/opt/agiliza/staging'
```

## Server prerequisites (one-time)

On the staging box (needs Docker **Compose v2**):

```bash
mkdir -p /opt/agiliza/staging
# First deploy only — copy the template + runtime env file:
scp docker/docker-compose.staging.yml <user>@<host>:/opt/agiliza/staging/
scp .env.staging <user>@<host>:/opt/agiliza/staging/
# Docker + GHCR auth so the deploy job can pull private images:
usermod -aG docker <user>
docker login ghcr.io -u clsalbertogx --password-stdin < /path/to/ghcr_pat
```

## Deploy

```bash
git tag v0.11.0
git push origin v0.11.0
gh run watch
```

## Health check

After `docker compose up`, the job polls `http://localhost:3333/api/health`. The
`healthcheck` declared on the `backend` service in `docker-compose.staging.yml` is the
belt-and-suspenders copy of the same probe.

## Rollback

If the health check fails, the job automatically re-pins `:previous -> :latest` for both
services and recreates (one-shot — no retry loop), then exits with an error so the
pipeline stays red for a human to investigate.

Manual one-liner (same operation, for an operator):

```bash
docker tag ghcr.io/clsalbertogx/agiliza/backend:previous  ghcr.io/clsalbertogx/agiliza/backend:latest
docker tag ghcr.io/clsalbertogx/agiliza/frontend:previous ghcr.io/clsalbertogx/agiliza/frontend:latest
docker compose -f docker-compose.staging.yml up -d --force-recreate
```

`:previous` always holds the release that was running before the last deploy, so rollback
is a single re-tag + recreate. Setting `pull_policy: missing` on the compose services is
what makes this deterministic (see the comment in `docker-compose.staging.yml`).