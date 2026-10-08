# NexusAI Analytics

Single-user dataset exploration with the existing Next.js/TypeScript dashboard UI, MySQL/Drizzle storage, charts, pivots and optional Gemini query planning. Calculations run locally on the server, not in the language model.

## Run locally

Requires Node.js 20.9+ (Node 22 LTS recommended) and MySQL 8.

```sh
npm ci
cp .env.example .env
# Set DB_PASSWORD and other DB settings in .env. Never commit .env.
docker compose up -d mysql
npm run db:push
npm run dev
```

`npm run db:push` uses `drizzle.config.ts` and environment variables. The old JSON config is a secret-free example only. The Docker database binds to localhost, not all network interfaces. Use a least-privilege DB user for deployment rather than root.

```sh
npm test
npm run typecheck
npm run lint
npm run build
# Before running production, set APP_USERNAME and APP_PASSWORD.
npm start
```

## Correctness and scope

- CSV/TSV/TXT, JSON object rows and the first XLSX worksheet are supported. Legacy XLS is rejected because its previous parser has known vulnerabilities; export it as XLSX or CSV.
- Numeric parsing is strict, supports US comma grouping and leading $, £, €, ₹ symbols, and rejects partial values such as `12abc`. Other locale formats and percentages need explicit conversion. ISO dates are not numeric measures.
- Cleaning trims strings, normalizes numeric cells, fills missing measures with their mean or categories with their mode and removes exact duplicate rows. Missing dates/identifiers are not invented. These choices can change statistics. Raw rows remain stored; review the cleaning report before relying on results.
- Cleaned profiles, KPIs and summaries are recalculated. Missingness and uniqueness are descriptive metrics, not a proof of business accuracy.
- Dashboard category and location slicers intersect. Date filters use UTC calendar boundaries relative to today, not the latest date in the uploaded file. KPIs and charts use the same filtered rows.
- Date-ordered KPI changes compare two row halves, not equal calendar periods. The linear projection uses chronological monthly chart values; its R² is fit quality, not validated forecast accuracy.
- Local questions support count, sum, average, median, min/max, top grouped sums, distribution and monthly totals with one exact-equality filter. Name the columns. Ambiguous/unsupported questions return a refusal, not a guessed answer.
- Pivot supports multiple row fields and one column field. Average/min/max totals are recalculated from source records, not summed from displayed aggregates. A full pivot filter editor is not implemented.
- Uploads are capped at 50 MB and stored/analysed rows at 100,000. File parsing happens before the row cap, so use smaller files for limited-memory servers. No streaming ingestion, multi-sheet joins, SQL warehouse, model validation or general-purpose forecasting is promised.

## Optional Gemini

Set these server-side environment variables in your private hosting configuration:

```dotenv
GEMINI_ENABLED=true
GEMINI_API_KEY=<your private key>
GEMINI_MODEL=gemini-2.5-flash
```

Never use a `NEXT_PUBLIC_` key. A request sends only the question and column names/types to Google, not rows, samples or computed statistics. The question can contain a filter label; do not put unrelated private information in it. Google generates a restricted JSON plan, which is validated before local calculation. Invalid plans are rejected; network errors fall back to the local parser. The returned interpretation should be reviewed. Provider quotas, model availability and terms apply; a free-tier key is not a guarantee of unlimited or free use.

No API key is included in this repository. Integration tests mock Gemini; enabling an actual host requires its private environment configuration.

## Security

This is **not a multi-user service**. Production fails closed without APP_USERNAME/APP_PASSWORD; when configured it uses a shared HTTP Basic gate. Use HTTPS, strong unique credentials, a private database and backups. Cross-origin browser writes are rejected. This gate does not provide tenant ownership, account management or per-user isolation. Do not deploy for unrelated users until those are implemented.

Earlier versions published a database password. It is removed from current files but remains in Git history. Rotate it anywhere it was used; deleting a line does not revoke a secret.

Dependencies were updated without `audit fix --force`. See `npm audit` for current results. Remaining advisories should be tracked rather than hidden; do not downgrade framework tooling just to quiet its audit report.

## Free hosted deployment

Vercel Hobby + TiDB Cloud Starter, no card. Keep TiDB monthly spending limit at $0; exhausting the free quota throttles the database instead of charging. TiDB requires TLS: set DB_SSL=true. Set private APP_USERNAME/APP_PASSWORD and GEMINI_API_KEY only in the host environment, never in the repository. GEMINI_ENABLED=true enables the approved schema-only planner. Hosted uploads are limited to 4MB (Vercel has a 4.5MB function payload limit); local servers default to 50MB.
