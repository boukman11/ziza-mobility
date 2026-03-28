# Ziza Transportation — Local Release Candidate (Sprint 57)

## Quick start
```bash
docker compose up --build
```

## Recommended (release checklist)
```bash
bash scripts/release_checklist.sh
```

## URLs
- Customer: http://localhost:3000
- Driver: http://localhost:3001
- Admin: http://localhost:3002
- API health: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- Keycloak: http://localhost:8080
- Admin System page: http://localhost:3002/system

## Troubleshooting
### Reset everything
```bash
bash scripts/reset_all.sh
```

### Users / roles missing
```bash
bash scripts/create_users_keycloak_v6.sh
```

### `invalid_grant Account is not fully set up`
```bash
bash scripts/fix_keycloak_account_setup.sh
```

### Slow network during build
Build web images sequentially:
```bash
bash scripts/build_web_sequential.sh
```
