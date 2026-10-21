#!/usr/bin/env node
/**
 * Switch Database Provider between SQLite (development) and Microsoft SQL Server (production)
 * Usage:
 *   node scripts/switch-db.js sqlite
 *   node scripts/switch-db.js sqlserver
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const target = process.argv[2]?.toLowerCase();

if (!target || !["sqlite", "sqlserver"].includes(target)) {
  console.log(`
Usage:
  node scripts/switch-db.js sqlite       # Switch to SQLite for local development
  node scripts/switch-db.js sqlserver    # Switch to Microsoft SQL Server for enterprise production
  `);
  process.exit(1);
}

const mainSchemaPath = path.join(rootDir, "prisma", "schema.prisma");
const sqlServerSchemaPath = path.join(
  rootDir,
  "prisma",
  "schema.sqlserver.prisma",
);

if (target === "sqlserver") {
  if (fs.existsSync(sqlServerSchemaPath)) {
    fs.copyFileSync(sqlServerSchemaPath, mainSchemaPath);
  } else {
    const content = fs.readFileSync(mainSchemaPath, "utf8");
    fs.writeFileSync(
      mainSchemaPath,
      content.replace(/provider\s*=\s*"sqlite"/g, 'provider = "sqlserver"'),
      "utf8",
    );
  }
  console.log(
    "✅ Reconciled prisma/schema.prisma for Microsoft SQL Server (Enterprise Production).",
  );
  console.log("📌 Next steps for SQL Server Enterprise:");
  console.log("   1. Set DATABASE_URL in .env:");
  console.log(
    '      DATABASE_URL="sqlserver://<HOST>:1433;database=snappfood_qa;user=sa;password=<PASSWORD>;encrypt=true;trustServerCertificate=true"',
  );
  console.log("   2. Run: npx prisma generate");
  console.log("   3. Review/apply the deployment migration; see README.md");
  console.log(
    "   4. Apply the nullable user-link filtered index; never seed an existing database",
  );
} else {
  const content = fs.readFileSync(mainSchemaPath, "utf8");
  fs.writeFileSync(
    mainSchemaPath,
    content
      .replace(/provider\s*=\s*"sqlserver"/g, 'provider = "sqlite"')
      .replace(/\s+@db\.\w+(?:\([^)]*\))?/g, ""),
    "utf8",
  );
  console.log(
    '✅ Updated prisma/schema.prisma datasource provider to "sqlite" (Development).',
  );
  console.log("📌 Next steps for SQLite Local:");
  console.log('   1. Set DATABASE_URL in .env: DATABASE_URL="file:./dev.db"');
  console.log("   2. Run: npx prisma generate");
  console.log("   3. Run: npx prisma db push");
}

console.log("🎉 Database configuration updated successfully!");
