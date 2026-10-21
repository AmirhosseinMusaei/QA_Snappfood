import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
const sqlite =
  process.env.TEST_DATABASE_URL ||
  `file:./test-${process.pid}-${Date.now()}.db`;
if (!/^file:\.\/test(?:-[a-z0-9-]+)?\.db$/i.test(sqlite))
  throw new Error(
    "Tests require an explicitly isolated test*.db SQLite database.",
  );
const file = "prisma/" + sqlite.slice(7);
if (existsSync(file)) unlinkSync(file);
writeFileSync(file, "");
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: sqlite,
  TEST_DATABASE_URL: sqlite,
};
const run = (args) => {
  const r = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
};
run(["node_modules/prisma/build/index.js", "generate"]);
run(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]);
run(["--import", "tsx", "prisma/seed.ts"]);
run(["--import", "tsx", "scripts/migrate-integrity.ts", "--apply"]);
if (!process.argv.includes("--setup-only"))
  run([
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "src/api.test.ts",
    "src/integration.test.ts",
    "src/ui.test.tsx",
    "src/utils/scoring.test.ts",
    "src/utils/trendMetrics.test.ts",
  ]);
