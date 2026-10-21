import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  NODE_ENV: "test",
  TEST_DATABASE_URL: "file:./test-e2e.db",
  DATABASE_URL: "file:./test-e2e.db",
};
const setup = spawnSync(
  process.execPath,
  ["scripts/test.mjs", "--setup-only"],
  { env, stdio: "inherit" },
);
if (setup.status !== 0) process.exit(setup.status || 1);
Object.assign(process.env, env, { PORT: "3200" });
const { register } = await import("tsx/esm/api");
register();
const { startServer } = await import("../server.ts");
await startServer();
