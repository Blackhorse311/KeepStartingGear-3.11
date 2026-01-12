/**
 * Build script for Keep Starting Gear mod
 * Compiles TypeScript and creates distribution package
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get package info
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

console.log(`Building ${pkg.name} v${pkg.version}...`);

try {
    // Compile TypeScript
    console.log("Compiling TypeScript...");
    execSync("npx tsc", { cwd: __dirname, stdio: "inherit" });

    console.log("Build complete!");
    console.log(`Output: ${__dirname}/src/mod.js`);
} catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
}
