# Local infrastructure

## Docker option

```bash
docker compose -f infrastructure/compose.yaml up -d
```

## Host-service option

PostgreSQL 17+ and Redis 8+ may run directly on the host. Match `.env.example` or provide custom `DATABASE_URL` and `REDIS_URL` values.

Infrastructure commands must never use production credentials locally.

