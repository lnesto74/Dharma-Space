import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePostgresUrl, usesPostgres } from "../src/ensure-schema.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  console.log("[db:push] DATABASE_URL not set — skipping (tables are created at server startup on DigitalOcean).");
  process.exit(0);
}

if (usesPostgres()) {
  process.env.DATABASE_URL = normalizePostgresUrl(process.env.DATABASE_URL);
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env
});
