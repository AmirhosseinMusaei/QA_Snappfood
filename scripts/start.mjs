import "dotenv/config";
process.env.NODE_ENV ||= "production";
const { register } = await import("tsx/esm/api");
register();
await import("../server.ts");
