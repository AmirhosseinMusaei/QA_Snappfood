# Original interface restoration

The visual reference is the pre-fix application at `ba7b7444a08b968b78c9b7581353757fabbd0993`, including the original manager quality matrix and fault cards shown in the supplied screenshots.

## Restored

Original Agent, Team Lead, Manager and Executive Reports screen structures, cards, charts, colors, tables and controls. Original assessment history, dispute queue and system audit log layouts. Removed the replacement MonthlyDashboard and the extra secondary navigation bar.

Backend security/scoring/session/import/versioning/audit corrections remain. Original screens now use authorized complete period data and server monthly scores, rather than calculating totals from a 20-record preview. Agent screens do not expose peers' identities or fabricate a team rank. Aggregate-only records retain their explicit limitations.

## Requested navigation change

Admin and QA Supervisor use a compact hamburger menu on desktop as well as mobile. Other roles collapse navigation below the wide desktop breakpoint. The menu retains permitted destinations, is scrollable within the viewport, closes on selection/outside click/Escape, restores keyboard focus on Escape/selection and exposes its expanded state to assistive technology. Original branding and colors remain.

## Second review corrections

- History, disputes and audit logs retain server pagination/filtering, exact role checks and full filtered exports. Month filtering specifies a year; stale edits retain revision protection.
- Disputes resolve by dispute ID and criterion item scores. Admin cannot mutate assessments through the restored interface.
- Restored lead review waits for successful persistence and requires a real note, rather than pre-filling a claim that feedback already happened.
- Header counters come from scoped database counts, not the latest 20 assessments.
- Monthly chart points use agent final monthly scores; three-month means exclude absent months and include actual zero scores. Weekly charts describe assessment samples.
- Date-range reports use inclusive Tehran calendar dates and apply filters consistently to API lists/exports.
- CSV cells escape quotes/newlines and neutralize formulas. Report Excel formatting runs on the server, keeping ExcelJS out of the browser bundle.
- Async data requests cancel stale requests and clear rows on account/filter changes. Memoized active assessments avoid refetching dashboards on unrelated context changes.
- Test runs default to unique isolated SQLite database names, avoiding interference between simultaneous runs.
- Codespaces development accepts only its exact environment-derived forwarded origin; production origin rules stay strict.
- SQL Server nullable user-link migration now handles both Prisma UNIQUE constraints and standalone indexes, fixing observed CI error 3723. It runs transactionally.

## Verification

Local regression suite: 116 tests passed, zero failures/skips before the final small optimization pass. TypeScript and production build passed; dependency audit reported zero known vulnerabilities. Browser suite expanded to 14 desktop/mobile cases, including original layout markers, session reload, admin/supervisor navigation, menu width/Escape and report export. Browser screenshots and traces are uploaded by CI. Final CI results supersede this local checkpoint.

Local browser installation failed again due environment downloads; no local browser success is claimed. Live SQL Server and browser verification are performed in GitHub Actions. Remaining organization-specific SSO, notifications/calibration and production rollout checks documented in README still apply.

## Codespaces update after merge

Stop the dev server, run `git pull --ff-only origin main`, then `npm ci`, then `npm run dev`. This restoration adds no database schema fields and requires no reseed/reset of your Codespaces SQLite database. Refresh the browser. The existing demo credentials remain unchanged. Existing SQL Server deployments should review/apply the corrected filtered-index script as part of their controlled migration process.
