# Arquitetura da Aplicação

## Visão geral
- Stack: Node.js + Express + React + Vite + PostgreSQL + Drizzle.
- Entrada única em produção: container `front` (Nginx) na porta externa.
- API isolada em rede interna Docker (container `back`), com proxy `/api` via Nginx.

## Análise minuciosa realizada

### Backend (antes)
- Todos os arquivos relevantes estavam em `server/`.
- `server/routes.ts` com alto acoplamento e mais de 2k linhas.
- Infraestrutura, regras de domínio e bootstrap misturados no mesmo nível de pasta.

### Backend (depois)
- Organização por contexto/módulo:
  - `server/core/`
    - `config.ts` (configuração de ambiente centralizada)
    - `db.ts` (conexão e Drizzle)
  - `server/app/`
    - `static.ts` (servir assets em produção)
    - `vite.ts` (modo dev)
  - `server/modules/auth/`
    - `auth.ts` (sessão/login/controle de admin)
  - `server/modules/artifacts/`
    - `openai.ts` (integração com OpenAI)
  - `server/modules/templates/`
    - `template-processor.ts` (processamento de placeholders/templates)
  - `server/modules/system/`
    - `seed.ts` (seed inicial)
    - `storage.ts` (camada de acesso a dados)
  - `server/modules/http/`
    - `routes.ts` (registro de rotas HTTP)
  - `server/index.ts` (entrypoint)

### Frontend
- Estrutura atual já tem separação funcional aceitável:
  - `pages/` com segmentação por domínio (inclui `pages/admin`)
  - `components/` com componentes comuns
  - `components/ui/` com design system
  - `hooks/` e `lib/` organizados
- Ponto de atenção identificado: páginas com alta complexidade (ex.: `perfil.tsx`, `artefatos.tsx`, páginas admin) ainda concentram muita responsabilidade.

### Infraestrutura Docker
- Três containers padronizados:
  - `assistente_gestao_front`
  - `assistente_gestao_back`
  - `assistente_gestao_db`
- Migração de schema isolada via profile `migrate`.
- Healthchecks ativos para front/back/db.

## Decisões de arquitetura aplicadas
- Modularização do backend por contexto para reduzir acoplamento estrutural.
- Manutenção de compatibilidade funcional sem alterar contratos HTTP.
- API não exposta externamente por padrão no Docker (hardening básico).
- Configuração centralizada para evitar espalhamento de `process.env`.

## Riscos técnicos ainda existentes (não introduzidos por esta reorganização)
- `npm run check` possui erros TypeScript preexistentes em páginas admin e tipos de arrays JSON (`storage`/forms).
- `server/modules/http/routes.ts` segue monolítico (organizado por pasta, mas ainda volumoso).
- Bundle frontend ainda grande (alerta de chunk > 500kb).

## Próximo passo recomendado
- Fase 2: quebrar `server/modules/http/routes.ts` por domínio:
  - `routes/auth`
  - `routes/artifacts`
  - `routes/admin`
  - `routes/billing`
  - `routes/clients`
- Fase 3: decompor páginas frontend grandes em `features/*`.
