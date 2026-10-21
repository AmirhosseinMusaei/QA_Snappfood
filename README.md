# QA Portal

Persian/RTL QA assessments, versioned Support/Sales rubrics, disputes, monthly reporting, roster/settings administration, team-lead review and operational problems.

## Requirements and installation

- Node.js **24.13+**, npm, SQLite for development; Microsoft SQL Server 2022 is supported by the alternate Prisma schema, subject to the checks below.
- `npm ci`
- Copy `.env.example` to `.env` and configure the database.
- `npx prisma generate`
- `npm run db:push` on a **new development database**.
- For an empty demonstration database only: set `DEMO_SEED=true`, then `npm run db:seed`. Never use demo credentials or demo seeding in production. The seed refuses production and nonempty non-test databases.
- `npm run dev`

The app deliberately has no automatic login. Create real accounts using the bootstrap procedure or use an isolated demo database.

## Production, new deployment

1. Configure `DATABASE_URL`, `APP_URL` (the exact public **HTTPS** origin), independent random `SESSION_SECRET` and `COOKIE_SECRET` of at least 32 characters, and `NODE_ENV=production`.
2. Select SQLite or SQL Server explicitly. Prisma providers do not change automatically when the URL changes.
3. Generate Prisma and review/apply the schema with the organization's deployment process.
4. Provision the first administrator with `BOOTSTRAP_USERNAME`, `BOOTSTRAP_NAME`, and a unique `BOOTSTRAP_PASSWORD` of at least 16 characters, then run `npm run admin:bootstrap`. Remove the bootstrap password from the environment afterwards. Bootstrap refuses to run when an active administrator already exists.
5. `npm run build`, then `npm start`.
6. Terminate TLS at the approved reverse proxy. Set `TRUST_PROXY` only to the actual proxy IP/CIDR list (for example `loopback`), so login rate limiting receives the correct client IP. Do not trust arbitrary forwarded headers.
7. Restrict database and app ports to their intended network. Maintain database backups and monitor errors. Do not publish `.env` or database files.

Cookies are HttpOnly, signed, SameSite=Lax and Secure in production. Browser writes require a matching full Origin (or Referer). Headerless cookie-authenticated writes are rejected outside tests; non-browser clients can use Bearer session authentication. Login requests should also send the configured Origin. Session tokens are opaque random values stored only as hashes in the database. Logout, account deactivation, password changes and role changes revoke sessions across workers. Clean expired sessions periodically with `DELETE FROM Session WHERE expires_at < ...` using the database's date syntax.

`npm start` defaults to production. It fails closed without proper production configuration. Development preview requires `npm run dev`; `DEV_ROLE_SWITCH` is never allowed in production.

## Existing installation: non-destructive upgrade

**Do not run the seed script. Do not replace your database with a sample database.**

1. Back up the current database and verify that the backup can be restored. Use SQLite's online backup command (`sqlite3 original.db ".backup backup.db"`) or the SQL Server backup procedure. Stop application writes during the schema/data upgrade.
2. Keep the previous application revision, environment and backup together for rollback.
3. Review `prisma/schema.prisma` (or the SQL Server schema). New fields/tables include durable sessions, assessment revision/policy/legacy markers and request metadata. Existing assessment totals are not automatically recalculated.
4. Generate an upgrade SQL plan using Prisma's `migrate diff` against the actual database and target schema, for example:
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > upgrade.sql`
   Review it before applying it with your database administrator's deployment process. Do not use destructive reset or `--accept-data-loss`. Never overwrite a migration plan from a different environment without reviewing it.
5. After the additive schema is applied, run `npm run db:migrate:integrity`. It maps legacy controller usernames to stable user IDs, backfills assessment team IDs, marks missing historical item details, and maps dispute statuses `pending→open`, `resolved→accepted`. An unresolved or ambiguous controller aborts the transaction so the mapping can be corrected first. It preserves historical assessment totals.
6. Build, run tests on an isolated database, restart the app, and verify a sample of old assessments/reports before resuming writes. Existing stateless login cookies are intentionally invalid after this upgrade; users log in again.
7. If the upgrade fails, stop writes and restore the application **and its matching database backup** together. Do not run old code against a partially upgraded schema or attempt an unreviewed destructive downgrade.

For very large histories, run the data migration during a maintenance window; its transaction timeout and batch strategy should be tuned after testing a restored copy of production data. No migration was run against your organization database in this work.

## Microsoft SQL Server

- `npm run db:switch:sqlserver` explicitly selects the SQL Server schema. Set the SQL Server URL, then regenerate Prisma.
- SQL Server JSON/comment columns use `NVarChar(Max)` and indexed identifiers use bounded types.
- After schema creation/upgrade, apply `prisma/sqlserver-nullable-user-index.sql` before importing agents without user accounts. It replaces the nullable user-link unique index with a filtered unique index, preserving one non-null link per user while permitting multiple unlinked agents. Keep this custom index in the deployment migration plan; do not blindly reapply schema pushes over customized production indexes.
- `scripts/sqlserver-smoke.ts` and the CI SQL Server job exercise an **isolated** `qa_ci` database, including multiple unlinked agents, long JSON, transactions and audit writes.
- Schema validation was run locally. **A live SQL Server instance was unavailable locally; a green SQL Server CI job and an organization staging trial are still required.**
- After switching back to SQLite, regenerate the client and use a separate SQLite database. Never point a client generated for one provider at the other provider.

## Tests and CI

- `npm run typecheck`
- `npm test`: creates only a fresh `prisma/test*.db`, generates Prisma, applies schema, loads controlled fixtures, runs the integrity migration, then executes database/API/scoring/date/UI-render regressions. It refuses arbitrary database paths. Do not supply a production URL as a test URL.
- `npm run build`
- `npm audit --omit=dev`
- `npx playwright install chromium`, then `npm run test:e2e` for desktop/mobile browser tests. These use a separate `test-e2e.db` and a test server on port 3200.

The CI workflow includes clean install, TypeScript, SQLite regressions, build, dependency audit, browser tests and a separate SQL Server smoke job. The browser package/configuration was validated locally, but Chromium downloads were blocked/corrupted in this execution environment: **no full browser pass is claimed**. UI server-render and API-error tests were executed separately.

The old integration tests that asserted an Admin read/report ban were replaced: that expectation contradicted the PRD. The current suite tests actual endpoint behavior, including score tampering, partial fraud/fault/mistake updates, disputes, role scopes, snapshots, date boundaries, audit rollback, CSV handling and export/service agreement. Test count is not a claim of exhaustive coverage.

## Product rules and deliberate choices

- Support = 60+40 initially; Sales = 29+41 rubric points plus a 30-point mistake pool. Version edits validate all item/criterion/section sums and the correct total budget.
- All scores are explicit integers. Unknown, missing, fractional and out-of-range item scores are rejected.
- Creation uses the selected agent's actual team/department and the active matching form. Client IDs/controller attribution cannot select another creator. Historical edits use the stored immutable form.
- Assessment total is calculated by the server. A client total can only be a consistency assertion; it never becomes the stored authority. Partial scoring updates merge stored items and recompute.
- Fraud/critical fault makes the assessment total zero; `backend_general` is a reporting flag. The configurable mistake policy is snapshotted on each new assessment. Existing snapshots and critical-fault snapshots are preserved on historical edits unless the fault itself is changed. Legacy records without snapshots acquire one on their first legitimate recalculation; historic totals are not mass-rewritten.
- All reporting months use the Asia/Tehran Jalali calendar, with UTC storage and timezone-aware month intervals. Default period is the actual current month. Missing data remains null/“no assessments.”
- Extra monthly fraud penalties apply only to Sales: exactly one fraud subtracts 10 after averaging (floor zero); multiple frauds zero that agent/month. Support does not receive the extra Sales penalty.
- Team/department score is the **unweighted mean** of nonempty agent final monthly scores. The three-month score is the unweighted mean of available final monthly scores; empty months are excluded. Raw sample means are labelled separately.
- Color and quality defaults for new installations are 90/70. Existing configured thresholds are preserved.
- Monthly review targets belong to each agent. Reports include inactive agents so historical assessed agents do not silently disappear.
- Scopes follow the PRD. Admin may read all scores/reports/audit and manage configuration/users/rosters, but cannot create/edit/delete assessments or resolve/file disputes. QA controllers create only for assigned agents and edit/delete their own authored assessments. Existing history authorship is migrated to IDs.
- Problems are supplementary: supervisors/admins may read all; managers read their department and leads their teams. Agents/controllers cannot read the global tracker. Managers/leads/supervisors may write only within scope; only managers/supervisors delete scoped problems.
- Deleted assessments are excluded from all active metrics. Admin/supervisor/controllers may read authorized deleted history; agents/leads/managers cannot. Only QA supervisor restores. Agents cannot dispute deleted or aggregate-only records.
- Dispute window starts at `assessment.created_at`, defaults to 72 hours, and is enforced on the server. One active dispute per assessment; criterion/item must exist in the original form. Resolution targets the unique dispute ID. Terminal decisions require an explicit QA-supervisor override reason to revisit.
- Accepted disputes correct only the disputed criterion/items and recalculate through the same service. Arbitrary revised totals are refused. The UI uses canonical states open/in_review/accepted/rejected.
- Assessment edits/deletes use `revision` checks; stale edits return 409 and missing revision returns 428. Retries can use `Idempotency-Key`; changed payload reuse returns 409. Duplicate tickets for one agent require explicit confirmation.
- CSV imports default to preview and are **atomic per file**, with a 5000-row cap. Invalid rows cause no writes. Agent assignment labels must resolve unambiguously to real users/teams. Historical imports require the original controller, preserve flags/metadata, and use deterministic fingerprints for retry safety. Admin cannot bypass its assessment-creation ban through imports.
- Full historical item scores require their original form/version and must match calculated totals. Aggregate-only history is explicitly marked `legacy_aggregate`; no item maxima are invented. Such records remain reportable but cannot be recalculated or disputed as if item data existed.
- UI JSON download is only a scoped snapshot, not a full database backup. In-browser JSON restore is disabled. Use validated CSV or database backup/restore.
- Team/agent reassignment affects current access. Assessments retain team ID and form type, but pre-upgrade historical team titles/department transfers cannot be reconstructed without the original roster history. Validate transfers against organization policy before deployment; this change does not invent missing historic roster data.

## Deferred / not claimed

Real corporate SSO requires the organization's IdP and remains fail-closed; notifications and calibration remain phase 3. The project still uses React/Vite + Express rather than Next.js App Router; no unrelated framework migration was performed. The existing split assessment workspace was retained instead of replacing it with the PRD's four-step wizard. Live SQL Server, organization SSO/VPN, real mobile browsers, production load/latency and production backup restores must be verified in staging. Target response time under two seconds is not asserted from small-fixture tests.
