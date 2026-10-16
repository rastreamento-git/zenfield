import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) {
 const file = path.join(dir, entry.name);
 if (entry.isDirectory()) await walk(file);
 else if (/\.(jsx?|css)$/.test(file)) {
  const text = await readFile(file,"utf8");
  if (text.includes("@zen/ui") || text.includes("packages/ui") || text.includes("apps/web") || text.includes("apps/technician")) throw Error("Dependência externa ao ZenField: " + file);
 }
} }
await walk("src"); console.log("ZenField: fontes independentes do repositório ZenControl.");
