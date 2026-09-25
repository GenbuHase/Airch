import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ManifestSchema } from "../dist/schema/manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const jsonSchema = zodToJsonSchema(ManifestSchema, {
    name: "AirchManifest",
    $refStrategy: "none",
  });

  const schemaDir = path.resolve(__dirname, "../schema");
  await fs.mkdir(schemaDir, { recursive: true });

  const targetPath = path.join(schemaDir, "v1.json");
  await fs.writeFile(targetPath, JSON.stringify(jsonSchema, null, 2), "utf-8");

  console.log(`✔ Generated JSON Schema at ${targetPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
