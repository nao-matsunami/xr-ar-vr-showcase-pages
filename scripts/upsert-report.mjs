import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const reportsDir = path.join(rootDir, "reports");

function printUsage() {
  console.log(`
Usage:
  node scripts/upsert-report.mjs --file <path-to-json> [--publish]
  node scripts/upsert-report.mjs --stdin [--publish]

Examples:
  node scripts/upsert-report.mjs --file reports/2026-06-30.json
  cat /tmp/report.json | node scripts/upsert-report.mjs --stdin --publish
`);
}

function parseArgs(argv) {
  const options = {
    file: null,
    stdin: false,
    publish: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      options.file = argv[i + 1] || null;
      i += 1;
    } else if (arg === "--stdin") {
      options.stdin = true;
    } else if (arg === "--publish") {
      options.publish = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function ensureString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid string field: ${fieldName}`);
  }
}

function validateReport(report) {
  ensureString(report.date, "date");
  ensureString(report.headline, "headline");
  ensureString(report.summary, "summary");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date)) {
    throw new Error(`Invalid date format: ${report.date}. Expected YYYY-MM-DD`);
  }

  if (report.headlineEn && typeof report.headlineEn !== "string") {
    throw new Error("headlineEn must be a string when present");
  }

  if (report.summaryEn && typeof report.summaryEn !== "string") {
    throw new Error("summaryEn must be a string when present");
  }

  if (report.links && !Array.isArray(report.links)) {
    throw new Error("links must be an array when present");
  }

  if (report.links) {
    for (const link of report.links) {
      ensureString(link.label, "links[].label");
      ensureString(link.url, "links[].url");
    }
  }

  if (report.sections && !Array.isArray(report.sections)) {
    throw new Error("sections must be an array when present");
  }

  if (report.sections) {
    for (const section of report.sections) {
      ensureString(section.title, "sections[].title");
      if (section.titleEn && typeof section.titleEn !== "string") {
        throw new Error("sections[].titleEn must be a string when present");
      }
      if (section.body && typeof section.body !== "string") {
        throw new Error("sections[].body must be a string when present");
      }
      if (section.bodyEn && typeof section.bodyEn !== "string") {
        throw new Error("sections[].bodyEn must be a string when present");
      }
      if (section.links && !Array.isArray(section.links)) {
        throw new Error("sections[].links must be an array when present");
      }
    }
  }
}

async function loadReport(options) {
  if (options.file) {
    return JSON.parse(await fs.readFile(path.resolve(options.file), "utf8"));
  }

  if (options.stdin) {
    const payload = await readStdin();
    return JSON.parse(payload);
  }

  printUsage();
  throw new Error("Provide either --file or --stdin");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await loadReport(options);
  validateReport(report);

  await fs.mkdir(reportsDir, { recursive: true });
  const targetPath = path.join(reportsDir, `${report.date}.json`);
  await fs.writeFile(targetPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Saved report: ${targetPath}`);

  await run("node", ["scripts/build-gallery.mjs"], rootDir);

  if (options.publish) {
    await run("node", ["scripts/publish-pages.mjs"], rootDir);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
