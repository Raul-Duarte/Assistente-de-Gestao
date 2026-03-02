# Docker (Local/Prod-Like)

## Pré-requisitos
- Docker e Docker Compose plugin instalados.
- Arquivo `.env` na raiz do projeto (pode copiar de `.env.example`).
- Portas externas padrão:
  - Frontend: `FRONT_PORT=5001`
  - Banco: `DB_PORT=5433`

## Containers padronizados
- `assistente_gestao_front`: frontend React em Nginx (proxy `/api` para backend)
- `assistente_gestao_back`: backend Node.js/Express
- `assistente_gestao_db`: banco PostgreSQL

Observação: o backend roda apenas na rede interna do Docker; o acesso externo deve ser feito pelo frontend (`front`) em `FRONT_PORT`.

## Subir stack completa
```bash
docker compose up --build -d
```

## Ver logs
```bash
docker compose logs -f front
docker compose logs -f back
docker compose logs -f db
```

## Rodar migração/ajuste de schema
```bash
docker compose --profile migrate run --rm migrate
```

## Parar stack
```bash
docker compose down
```

## Limpar volumes (apaga dados do banco)
```bash
docker compose down -v
```
