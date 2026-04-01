import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.local");
const outputPath = path.join(projectRoot, "chrome-extension", "env.js");

function parseEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create .env.local first.`);
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const file = `export const EXTENSION_ENV = {\n  NEXT_PUBLIC_SUPABASE_URL: ${JSON.stringify(supabaseUrl)},\n  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnon)}\n};\n`;

fs.writeFileSync(outputPath, file, "utf8");
console.log(`Wrote ${outputPath}`);
