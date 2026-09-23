# True North Field OS

Role-gated roofing operations app for True North Restorations.

## Access gates

The first login for each role automatically creates the role credential using the bootstrap password below. Change all three from **Admin → Employees & Access** after the first deployment.

| Role | Bootstrap password | Workspace |
| --- | --- | --- |
| Admin | `Admin123!` | Full Field OS + Employees & Access + finance/operations controls |
| Sales Rep | `Sales123!` | Leads + CRM + Route Map + Photo Bank + Measure/Estimate + AI tools |
| Appointment Setter | `Setter123!` | Route Map + address-first CRM with appointment YES/NO + notes |

These are bootstrap credentials, not intended to remain unchanged in production.

## Vercel deployment

1. Import this repository into Vercel as a Next.js project.
2. Create/connect a managed PostgreSQL database (Prisma Postgres, Neon, Supabase, or another PostgreSQL provider) and expose its connection string as `DATABASE_URL`.
3. Add `TN_SESSION_SECRET` with at least 32 random characters.
4. Configure the credentials required by `z-ai-web-dev-sdk` in the deployment environment used by the project.
5. Deploy. The `vercel-build` script runs `prisma generate`, applies committed migrations, and then runs the Next.js production build.
6. Before field use, add `GEOCODIO_API_KEY` in Vercel. New/edited property addresses are rejected until Geocodio returns a sufficiently precise US street-level result. Existing unverified records can be verified from Route Map.

Copy `.env.example` for local setup.

### Recommended Vercel environment variables

```text
DATABASE_URL=postgresql://...
TN_SESSION_SECRET=long-random-secret
GEOCODIO_API_KEY=server-side-geocodio-api-key
```

## Role permissions

### Admin

Command Center, Leads & Pipeline, Route Map, Measure + Estimate, Estimates, Jobs & Contracts, IKO Materials, Pricing Profiles, CRM, Photo Bank, and Employees & Access. Admin can change the passwords for all three role gates and view employee activity metrics.

### Sales Rep

Leads & Pipeline, Route Map, CRM, Photo Bank, and Measure + Estimate. AI Copilot, AI roof inspection, aerial roof scanning, and AI route suggestions are available to Sales.

### Appointment Setter

Route Map and CRM only. The CRM is address-first and records appointment YES/NO, date/time when applicable, and call/appointment notes tied to that property. Setter access to AI route suggestions and aerial scanning is blocked server-side as well as hidden in the UI.

## Production architecture

- PostgreSQL is used instead of the original local SQLite file so database writes persist on Vercel.
- Authentication is cookie-based with HMAC-signed sessions and scrypt-hashed role passwords; sessions are rechecked against active employee profiles on server requests.
- Role permissions are enforced in middleware and key mutation APIs also record the authenticated employee.
- Employee profiles track role, status, last login, and counts of leads, appointments, estimates, and jobs created.
- Property photos are compressed in the browser before being stored against a lead/address in PostgreSQL.
- AI features remain server-side; provider failures are surfaced as actionable API errors rather than silently failing.
- The route map uses OpenStreetMap road tiles and Esri World Imagery satellite tiles. Property addresses are geocoded server-side through Geocodio and stored with verified coordinates; unverified/approximate results are never used as property pins.
- Production requires `GEOCODIO_API_KEY` configured in Vercel. The key is server-side only and is never exposed to the browser.
- A property cannot silently fall back to a town-center or randomized coordinate. If an address cannot be verified, the field user sees it as unverified and must correct/verify the address before routing or roof scanning.

## Local commands

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

For an existing PostgreSQL database where you intentionally want the schema synchronized without a migration, use `npm run db:push`.
