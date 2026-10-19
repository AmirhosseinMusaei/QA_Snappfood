#!/usr/bin/env node
/**
 * Switch Database Provider between SQLite (development) and Microsoft SQL Server (production)
 * Usage:
 *   node scripts/switch-db.js sqlite
 *   node scripts/switch-db.js sqlserver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const target = process.argv[2]?.toLowerCase();

if (!target || !['sqlite', 'sqlserver'].includes(target)) {
  console.log(`
Usage:
  node scripts/switch-db.js sqlite       # Switch to SQLite for local development
  node scripts/switch-db.js sqlserver    # Switch to Microsoft SQL Server for enterprise production
  `);
  process.exit(1);
}

const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

let updatedContent;
if (target === 'sqlserver') {
  updatedContent = schemaContent.replace(
    /provider\s*=\s*"sqlite"/g,
    'provider = "sqlserver"'
  );
  console.log('✅ Updated prisma/schema.prisma datasource provider to "sqlserver".');
  console.log('📌 Next steps for SQL Server:');
  console.log('   1. Set DATABASE_URL in .env:');
  console.log('      DATABASE_URL="sqlserver://localhost:1433;database=snappfood_qa;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"');
  console.log('   2. Run: npx prisma db push');
  console.log('   3. Run: npm run db:seed');
} else {
  updatedContent = schemaContent.replace(
    /provider\s*=\s*"sqlserver"/g,
    'provider = "sqlite"'
  );
  console.log('✅ Updated prisma/schema.prisma datasource provider to "sqlite".');
  console.log('📌 Next steps for SQLite:');
  console.log('   1. Set DATABASE_URL in .env: DATABASE_URL="file:./dev.db"');
  console.log('   2. Run: npx prisma db push');
  console.log('   3. Run: npm run db:seed');
}

fs.writeFileSync(schemaPath, updatedContent, 'utf8');
console.log('🎉 Database provider switched successfully!');
