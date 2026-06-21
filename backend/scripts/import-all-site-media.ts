/**
 * Import all bundled portraits and program images into the current database.
 * Usage: npx tsx scripts/import-all-site-media.ts
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { importBundledSiteMedia } from "../src/import-site-media.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const prisma = new PrismaClient();
importBundledSiteMedia(prisma)
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
