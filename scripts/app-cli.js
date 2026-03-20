#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(repoRoot, "frontend");
const electronDir = path.join(repoRoot, "electron");
const backendDir = path.join(repoRoot, "backend");
const releaseConfigPath = path.join(repoRoot, "release.json");
const electronPackagePath = path.join(electronDir, "package.json");
const electronLockPath = path.join(electronDir, "package-lock.json");
const backendBuildScriptPath = path.join(
  backendDir,
  "scripts",
  "build_backend_binary.ps1"
);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const powershellCommand =
  process.platform === "win32" ? "powershell.exe" : "pwsh";
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function resolveSpawn(command, args) {
  if (
    process.platform === "win32" &&
    /\.(cmd|bat)$/i.test(command)
  ) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }

  return { command, args };
}

function log(message) {
  console.log(`[pyyomi] ${message}`);
}

function fail(message) {
  console.error(`[pyyomi] ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const invocation = resolveSpawn(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function runCapture(command, args, options = {}) {
  const invocation = resolveSpawn(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error((result.stderr || "").trim() || `Command failed: ${command}`);
  }

  return result.stdout || "";
}

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const nextToken = argv[i + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextToken;
    i += 1;
  }

  return parsed;
}

function ensureValidVersion(version) {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid version "${version}". Expected SemVer like 1.2.3 or 1.2.3-beta.1.`);
  }
}

function getStableVersion(version) {
  const stable = version.split("-")[0];
  ensureValidVersion(stable);
  return stable;
}

function deriveChannel(version) {
  const prerelease = version.split("-")[1];
  if (!prerelease) return "stable";
  return prerelease.split(".")[0] || "stable";
}

function readReleaseConfig() {
  const config = readJson(releaseConfigPath);
  ensureValidVersion(config.version);
  return {
    version: config.version,
    channel: config.channel || deriveChannel(config.version),
  };
}

function writeReleaseConfig(version, channel) {
  ensureValidVersion(version);
  writeJson(releaseConfigPath, {
    version,
    channel: channel || deriveChannel(version),
  });
}

function syncVersionFiles(version) {
  ensureValidVersion(version);

  const electronPackage = readJson(electronPackagePath);
  electronPackage.version = version;
  writeJson(electronPackagePath, electronPackage);

  const electronLock = readJson(electronLockPath);
  electronLock.version = version;
  if (electronLock.packages && electronLock.packages[""]) {
    electronLock.packages[""].version = version;
  }
  writeJson(electronLockPath, electronLock);

  return version;
}

function syncVersionFromReleaseConfig() {
  const config = readReleaseConfig();
  syncVersionFiles(config.version);
  log(`Synced Electron packaging metadata to ${config.version}`);
  return config;
}

function bumpStableVersion(currentVersion, releaseType) {
  const stableVersion = getStableVersion(currentVersion);
  const match = stableVersion.match(SEMVER_RE);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  switch (releaseType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unsupported release type "${releaseType}".`);
  }
}

function appendGithubOutput(filePath, values) {
  if (!filePath) return;

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function ensureNodeDependencies(directory) {
  const nodeModulesPath = path.join(directory, "node_modules");
  if (fs.existsSync(nodeModulesPath)) {
    return;
  }

  const packageName = path.basename(directory);
  const hasLockFile = fs.existsSync(path.join(directory, "package-lock.json"));
  const installCommand = hasLockFile ? "ci" : "install";

  log(`Installing ${packageName} dependencies with npm ${installCommand}`);
  run(npmCommand, [installCommand], { cwd: directory });
}

function resolveBackendPython() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(backendDir, "venv", "Scripts", "python.exe"),
          path.join(backendDir, ".venv", "Scripts", "python.exe"),
          "python",
        ]
      : [
          path.join(backendDir, "venv", "bin", "python"),
          path.join(backendDir, ".venv", "bin", "python"),
          "python3",
          "python",
        ];

  return candidates.find((candidate) => {
    if (candidate === "python" || candidate === "python3") {
      return true;
    }
    return fs.existsSync(candidate);
  });
}

function ensureBackendRuntimeDependencies() {
  const pythonPath = resolveBackendPython();
  if (!pythonPath) {
    fail("Could not resolve a Python runtime for the backend.");
  }

  const check = spawnSync(
    pythonPath,
    ["-c", "import fastapi, uvicorn, httpx, sqlmodel"],
    {
      cwd: backendDir,
      stdio: "ignore",
      shell: false,
    }
  );

  if (check.status === 0) {
    return;
  }

  log(`Installing backend runtime dependencies with ${pythonPath}`);
  run(pythonPath, ["-m", "pip", "install", "--upgrade", "pip"], {
    cwd: backendDir,
  });
  run(pythonPath, ["-m", "pip", "install", "-r", "requirements.txt"], {
    cwd: backendDir,
  });
}

function ensureGitClean() {
  const output = runCapture("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (output.trim()) {
    throw new Error(
      "Release builds require a clean git worktree. Commit or stash your changes, or rerun with --allow-dirty."
    );
  }
}

function commandDev() {
  syncVersionFromReleaseConfig();
  ensureNodeDependencies(frontendDir);
  ensureNodeDependencies(electronDir);
  ensureBackendRuntimeDependencies();
  log("Launching Electron development runtime");
  run(npmCommand, ["run", "start", "--prefix", "electron"], { cwd: repoRoot });
}

function commandReleaseWin(args) {
  if (process.platform !== "win32") {
    fail("Windows release packaging is currently supported only on Windows hosts.");
  }

  if (!args.ci && !args.allowDirty) {
    ensureGitClean();
  }

  const config = syncVersionFromReleaseConfig();
  log(`Preparing Windows release build for ${config.version}`);

  ensureNodeDependencies(frontendDir);
  ensureNodeDependencies(electronDir);

  run(
    powershellCommand,
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      backendBuildScriptPath,
      "-InstallDependencies",
      "-Clean",
    ],
    { cwd: repoRoot }
  );

  run(npmCommand, ["run", "build", "--prefix", "frontend"], { cwd: repoRoot });

  if (args.smoke) {
    run(npmCommand, ["run", "build", "--prefix", "electron", "--", "--win", "--dir"], {
      cwd: repoRoot,
    });
    return;
  }

  run(npmCommand, ["run", "build:win", "--prefix", "electron"], { cwd: repoRoot });
}

function commandVersionSync() {
  const config = syncVersionFromReleaseConfig();
  console.log(config.version);
}

function commandVersionBump(args) {
  const current = readReleaseConfig();
  const releaseType = args.releaseType;
  const isPrerelease =
    args.prerelease === true ||
    args.prerelease === "true" ||
    args.prerelease === "1";
  const requestedChannel =
    args.channel || (current.channel && current.channel !== "stable" ? current.channel : "beta");

  let nextVersion;

  if (releaseType === "custom") {
    if (!args.customVersion) {
      throw new Error('Custom releases require "--custom-version x.y.z".');
    }
    nextVersion = String(args.customVersion).trim();
    ensureValidVersion(nextVersion);
    if (isPrerelease && !nextVersion.includes("-")) {
      nextVersion = `${nextVersion}-${requestedChannel}.1`;
    }
  } else {
    if (!["patch", "minor", "major"].includes(releaseType)) {
      throw new Error(
        'Release type must be one of "patch", "minor", "major", or "custom".'
      );
    }

    const bumpedStable = bumpStableVersion(current.version, releaseType);
    nextVersion = isPrerelease
      ? `${bumpedStable}-${requestedChannel}.1`
      : bumpedStable;
  }

  if (nextVersion === current.version) {
    throw new Error(`Version ${nextVersion} is already current.`);
  }

  const nextChannel = deriveChannel(nextVersion);
  writeReleaseConfig(nextVersion, nextChannel);
  syncVersionFiles(nextVersion);

  appendGithubOutput(args.githubOutput, {
    version: nextVersion,
    tag: `v${nextVersion}`,
    prerelease: String(nextVersion.includes("-")),
    channel: nextChannel,
  });

  console.log(nextVersion);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  try {
    switch (command) {
      case "dev":
        commandDev();
        break;
      case "release:win":
        commandReleaseWin(args);
        break;
      case "version:sync":
        commandVersionSync();
        break;
      case "version:bump":
        commandVersionBump(args);
        break;
      default:
        fail(
          'Usage: node scripts/app-cli.js <dev|release:win|version:sync|version:bump> [options]'
        );
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
