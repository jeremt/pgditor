#!/usr/bin/env node

import {execSync} from "child_process";
import fs from "fs";
import path from "path";

// Get the new version from command line arguments
const newVersion = process.argv[2];

if (!newVersion) {
    console.error("Error: Please provide a version number");
    console.error("Usage: pnpm release <version>");
    console.error("Example: pnpm release 0.0.23");
    process.exit(1);
}

// Validate version format (basic semver check)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error("Error: Version must be in format X.Y.Z (e.g., 0.0.23)");
    process.exit(1);
}

const packageJsonPath = path.join(process.cwd(), "package.json");
const cargoDir = path.join(process.cwd(), "src-tauri");
const cargoTomlPath = path.join(cargoDir, "Cargo.toml");
const cargoLockPath = path.join(cargoDir, "Cargo.lock");
const changelogPath = path.join(process.cwd(), "CHANGELOG.md");

function exec(command, options = {}) {
    try {
        return execSync(command, {...options, encoding: "utf8"}).trim();
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

function checkPreconditions() {
    console.log("Checking preconditions...");

    for (const file of [packageJsonPath, cargoTomlPath, cargoLockPath]) {
        if (!fs.existsSync(file)) {
            console.error(`Error: ${path.relative(process.cwd(), file)} not found`);
            process.exit(1);
        }
    }
    console.log("✓ Version files found");

    // Check if we're on main branch
    const currentBranch = exec("git rev-parse --abbrev-ref HEAD");
    if (currentBranch !== "main") {
        console.error(`Error: Not on main branch (currently on '${currentBranch}')`);
        process.exit(1);
    }
    console.log("✓ On main branch");

    // Check for uncommitted changes. CHANGELOG.md is allowed to be dirty: the release
    // skill writes the new entry just before calling this script, and it gets committed
    // together with the version bump.
    const status = exec("git status --porcelain")
        .split("\n")
        .filter((line) => line && !/^.. CHANGELOG\.md$/.test(line));
    if (status.length > 0) {
        console.error("Error: You have uncommitted changes:");
        console.error(status.join("\n"));
        process.exit(1);
    }
    console.log("✓ No uncommitted changes (besides CHANGELOG.md)");

    // Fetch latest changes from origin
    console.log("Fetching from origin...");
    exec("git fetch origin --tags");

    // Check if local main is up to date with origin/main
    const localCommit = exec("git rev-parse main");
    const remoteCommit = exec("git rev-parse origin/main");

    if (localCommit !== remoteCommit) {
        console.error("Error: Local main is not up to date with origin/main");
        console.error("Please pull the latest changes first: git pull origin main");
        process.exit(1);
    }
    console.log("✓ Up to date with origin/main");

    // Check that the tag doesn't already exist
    const tag = `v${newVersion}`;
    if (exec(`git tag --list ${tag}`)) {
        console.error(`Error: Tag ${tag} already exists`);
        process.exit(1);
    }
    console.log(`✓ Tag ${tag} is available`);

    // Check that the version is actually a new one
    const currentVersion = readPackageJsonVersion();
    if (currentVersion === newVersion) {
        console.error(`Error: package.json is already at version ${newVersion}`);
        process.exit(1);
    }
    console.log(`✓ Bumping from ${currentVersion} to ${newVersion}`);

    // Check that the changelog documents the version being released
    if (!fs.existsSync(changelogPath)) {
        console.error("Error: CHANGELOG.md not found");
        console.error("Run the `release` skill to write the entry, or create the file manually");
        process.exit(1);
    }
    if (!readChangelogEntry(newVersion)) {
        console.error(`Error: CHANGELOG.md has no "## ${newVersion}" section`);
        console.error("Run the `release` skill to write the entry, or add it manually");
        process.exit(1);
    }
    console.log(`✓ CHANGELOG.md documents ${newVersion}`);
}

// Return the `## <version>` section of the changelog, or null if there is none
function readChangelogEntry(version) {
    const sections = fs.readFileSync(changelogPath, "utf8").split(/^## /m).slice(1);
    const heading = new RegExp(`^${version.replace(/\./g, "\\.")}\\b`);
    const section = sections.find((section) => heading.test(section));
    return section ? section.trim() : null;
}

function readPackageJsonVersion() {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
}

function readCargoTomlField(field) {
    // Only look inside the [package] section, other sections also have a `version` key
    let inPackageSection = false;
    for (const line of fs.readFileSync(cargoTomlPath, "utf8").split("\n")) {
        if (line.startsWith("[")) {
            inPackageSection = line.trim() === "[package]";
        } else if (inPackageSection) {
            const match = line.match(new RegExp(`^${field}\\s*=\\s*"([^"]+)"`));
            if (match) return match[1];
        }
    }
    return null;
}

function readCargoLockVersion(crateName) {
    // Find the [[package]] block of the crate itself, not one of its dependencies
    const blocks = fs.readFileSync(cargoLockPath, "utf8").split("[[package]]");
    for (const block of blocks) {
        if (new RegExp(`^\\s*name = "${crateName}"$`, "m").test(block)) {
            const match = block.match(/^version = "([^"]+)"$/m);
            if (match) return match[1];
        }
    }
    return null;
}

function updatePackageJson(version) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    packageJson.version = version;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`✓ package.json updated to ${version}`);
}

function updateCargoToml(version) {
    const lines = fs.readFileSync(cargoTomlPath, "utf8").split("\n");
    let inPackageSection = false;
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("[")) {
            inPackageSection = lines[i].trim() === "[package]";
        } else if (inPackageSection && /^version\s*=/.test(lines[i])) {
            lines[i] = `version = "${version}"`;
            updated = true;
            break;
        }
    }

    if (!updated) {
        throw new Error("Could not find a `version` key in the [package] section of src-tauri/Cargo.toml");
    }

    fs.writeFileSync(cargoTomlPath, lines.join("\n"));
    console.log(`✓ Cargo.toml updated to ${version}`);
}

function updateCargoLock() {
    // `--workspace` only re-resolves the crate itself, so the release commit doesn't
    // silently bump every dependency (which `cargo generate-lockfile` would do).
    // `--offline` keeps it from hitting the registry, with a fallback in case the
    // local registry cache is cold.
    try {
        exec("cargo update --workspace --offline", {cwd: cargoDir, stdio: "pipe"});
    } catch {
        exec("cargo update --workspace", {cwd: cargoDir, stdio: "pipe"});
    }
    console.log("✓ Cargo.lock updated");
}

function updateVersionFiles(version) {
    console.log(`\nUpdating versions to ${version}...`);
    updatePackageJson(version);
    updateCargoToml(version);
    updateCargoLock();
}

function verifyVersionFiles(version) {
    console.log("\nVerifying versions...");

    const crateName = readCargoTomlField("name");
    if (!crateName) {
        throw new Error("Could not find the crate name in src-tauri/Cargo.toml");
    }

    const found = {
        "package.json": readPackageJsonVersion(),
        "src-tauri/Cargo.toml": readCargoTomlField("version"),
        "src-tauri/Cargo.lock": readCargoLockVersion(crateName),
    };

    const stale = Object.entries(found).filter(([, value]) => value !== version);
    if (stale.length > 0) {
        for (const [file, value] of stale) {
            console.error(`✗ ${file} is at ${value ?? "an unknown version"}, expected ${version}`);
        }
        throw new Error("Some files were not updated to the new version");
    }

    for (const file of Object.keys(found)) {
        console.log(`✓ ${file} is at ${version}`);
    }

    // src-tauri/tauri.conf.json reads its version from package.json, warn if that ever changes
    const tauriConfPath = path.join(cargoDir, "tauri.conf.json");
    if (fs.existsSync(tauriConfPath)) {
        const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
        if (tauriConf.version !== "../package.json" && tauriConf.version !== version) {
            throw new Error(
                `src-tauri/tauri.conf.json pins version "${tauriConf.version}" instead of reading it from package.json`,
            );
        }
        console.log("✓ tauri.conf.json inherits the version from package.json");
    }
}

function createRelease(version) {
    const tag = `v${version}`;

    console.log("\nCommitting changes...");
    exec("git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md");
    exec(`git commit -m "release: ${tag}"`);
    console.log("✓ Changes committed");

    console.log("\nPushing to origin...");
    exec("git push");
    console.log("✓ Pushed to origin");

    console.log("\nCreating and pushing tag...");
    exec(`git tag ${tag}`);
    exec("git push --tags");
    console.log(`✓ Tag ${tag} created and pushed`);
}

// Main execution
try {
    checkPreconditions();
    updateVersionFiles(newVersion);
    verifyVersionFiles(newVersion);
    createRelease(newVersion);

    console.log("\n🎉 Release successful!");
    console.log(`Version ${newVersion} has been released.`);
} catch (error) {
    console.error("\n❌ Release failed:");
    console.error(error.message);
    process.exit(1);
}
