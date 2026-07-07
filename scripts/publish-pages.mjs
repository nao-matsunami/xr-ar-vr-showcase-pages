import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";

const sourceDir = "/Users/nao/Documents/Codex/2026-07-07-xr-ar-vr-showcase";
const targetDir = "/Users/nao/Documents/Codex/xr-ar-vr-showcase-pages";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyRecursive(from, to) {
  const stat = await fs.lstat(from);

  if (stat.isDirectory()) {
    await ensureDir(to);
    const entries = await fs.readdir(from, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      if (entry.name === "node_modules") continue;
      await copyRecursive(path.join(from, entry.name), path.join(to, entry.name));
    }
    return;
  }

  await ensureDir(path.dirname(to));
  await fs.copyFile(from, to);
}

async function emptyTargetDir(targetPath) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    await fs.rm(path.join(targetPath, entry.name), { recursive: true, force: true });
  }
}

async function copyProject() {
  await ensureDir(targetDir);
  await emptyTargetDir(targetDir);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    if (entry.name === "node_modules") continue;

    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);

    await copyRecursive(from, to);
  }
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

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function main() {
  const hasGit = await pathExists(path.join(targetDir, ".git"));
  if (!hasGit) {
    throw new Error(
      `Publish target is not a git repository: ${targetDir}\n` +
      "Create or clone the GitHub Pages repo there first."
    );
  }

  await run("node", ["scripts/build-gallery.mjs"], sourceDir);
  await copyProject();
  await run("git", ["add", "."], targetDir);

  let hasChanges = true;
  try {
    await run("git", ["diff", "--cached", "--quiet"], targetDir);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log("No changes to publish.");
    return;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  await run("git", ["commit", "-m", `Publish XR showcase ${stamp}`], targetDir);
  const token = await runCapture("gh", ["auth", "token"], targetDir);
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  const gitPushArgs = ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`];

  try {
    await run("git", [...gitPushArgs, "push", "origin", "main"], targetDir);
  } catch {
    await run("git", [...gitPushArgs, "fetch", "origin", "main"], targetDir);
    await run("git", ["rebase", "origin/main"], targetDir);
    await run("git", [...gitPushArgs, "push", "origin", "main"], targetDir);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
