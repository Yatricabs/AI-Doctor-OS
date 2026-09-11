import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const globals = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
const tailwind = fs.readFileSync(path.join(root, "tailwind.config.ts"), "utf8");
const required = ["@tailwind base;", "@tailwind components;", "@tailwind utilities;"];

for (const directive of required) {
  if (!globals.includes(directive)) throw new Error(`Missing Tailwind directive: ${directive}`);
}
if (!tailwind.includes("./app/**/*.{ts,tsx}") || !tailwind.includes("./components/**/*.{ts,tsx}")) {
  throw new Error("Tailwind content globs are incomplete.");
}
for (const file of ["app/layout.tsx", "app/page.tsx"]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required app file: ${file}`);
}
console.log("CSS guard passed: Tailwind directives, content globs, and app entry points are present.");
