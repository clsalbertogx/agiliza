# CONTEXT — Agiliza, pós v0.12.0

## Objetivo atual
Projeto rodando localmente (backend :3333, frontend :3000, Postgres+Redis via docker) com todas as telas validadas em browser real (Playwright headed) — gate: 8 rotas HTTP 200, 0 erros de rede.

## Specs envolvidas
- specs/frontend-ui-consistency-corrections.spec.md (correções UI)
- specs/ (SDD backfill do Sprint 12: subscription-lifecycle, recurring-billing, multi-provider-payments, observability, security)

## Decisões de negócio que não devem ser reabertas
- Representação canônica de risco no wire/storage = GREEN/YELLOW/RED (ClientRiskScore); CRITICAL só existe em domínio, colapsa em RED na fronteira.
- Sidebar navegação = 7 itens (sem Mensagens/templates enquanto não houver API de templates).
- Infra de dev via docker compose (postgres/redis) + serviços Node via systemd --user.
