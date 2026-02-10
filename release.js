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

function exec(command) {
    try {
        return execSync(command, {encoding: "utf8"}).trim();
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

function checkPreconditions() {
    console.log("Checking preconditions...");

    // Check if we're on main branch
    const currentBranch = exec("git rev-parse --abbrev-ref HEAD");
    if (currentBranch !== "main") {
        console.error(`Error: Not on main branch (currently on '${currentBranch}')`);
        process.exit(1);
    }
    console.log("✓ On main branch");

    // Check for uncommitted changes
    const status = exec("git status --porcelain");
    if (status) {
        console.error("Error: You have uncommitted changes:");
        console.error(status);
        process.exit(1);
    }
    console.log("✓ No uncommitted changes");

    // Fetch latest changes from origin
    console.log("Fetching from origin...");
    exec("git fetch origin");

    // Check if local main is up to date with origin/main
    const localCommit = exec("git rev-parse main");
    const remoteCommit = exec("git rev-parse origin/main");

    if (localCommit !== remoteCommit) {
        console.error("Error: Local main is not up to date with origin/main");
        console.error("Please pull the latest changes first: git pull origin main");
        process.exit(1);
    }
    console.log("✓ Up to date with origin/main");
}

function updatePackageJson(version) {
    console.log(`\nUpdating package.json to version ${version}...`);

    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
        console.error("Error: package.json not found in current directory");
        process.exit(1);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const oldVersion = packageJson.version;

    packageJson.version = version;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`✓ Version updated from ${oldVersion} to ${version}`);
}

function createRelease(version) {
    const tag = `v${version}`;

    console.log("\nCommitting changes...");
    exec("git add package.json");
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
    updatePackageJson(newVersion);
    createRelease(newVersion);

    console.log("\n🎉 Release successful!");
    console.log(`Version ${newVersion} has been released.`);
} catch (error) {
    console.error("\n❌ Release failed:");
    console.error(error.message);
    process.exit(1);
}
