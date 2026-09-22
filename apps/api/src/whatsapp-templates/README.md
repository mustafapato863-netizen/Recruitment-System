# WhatsApp Templates

MVP: body-only templates, `wa.me` send-now (no Meta Cloud API).

## Apply schema

```bash
pnpm db:migrate:deploy
pnpm --dir database prisma:generate
```

Restart the API after migrate. Defaults seed on first `GET /whatsapp-templates` per organization.

## Try

- Admin: `/whatsapp-templates` (MASTER_DATA_MANAGE)
- Send: Interview detail or Application detail → WhatsApp
