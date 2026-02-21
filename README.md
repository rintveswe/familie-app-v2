# Familie App v2

Kalender-app for 5 brukere:
- Rino
- Iselin
- Fia
- Rakel
- Hugo

Hver bruker har egen farge, enkel innlogging uten passord, og push-paaminnelser 1 time foer avtale.

## Lokal utvikling

```bash
npm install
npm run dev
```

## Ekte push-varsler (ogsaa naar appen er lukket)

For at dette skal fungere i produksjon paa Vercel, maa disse environment variablene settes:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (f.eks. `mailto:deg@dittdomene.no`)
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

En komplett mal ligger i `.env.example`.

### Generer VAPID-nokler

Kjoer lokalt:

```bash
npx web-push generate-vapid-keys
```

Kopier verdiene inn i Vercel Environment Variables.

### Redis (lagring for events + subscriptions)

Legg til Redis-integrasjon i Vercel (Upstash Redis), og kopier URL/TOKEN til:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Cron-jobb

`vercel.json` er satt opp med cron hvert 5. minutt:

- `*/5 * * * *` -> `/api/push/reminders`

Jobben sender varsler naer paaminnelsestidspunktet (1 time foer start).

## Deploy

Deploy skjer via git push til `main` (Vercel koblet til repo).
