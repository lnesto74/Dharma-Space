import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (!url) {
  console.log("[db:push] No DATABASE_URL — skipping.");
  process.exit(0);
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: backendRoot,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url }
});
