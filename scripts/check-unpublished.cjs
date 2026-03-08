const { execSync } = require("node:child_process");
const pkg = require("../package.json");

try {
  execSync(`npm view ${pkg.name}@${pkg.version} version`, { stdio: "pipe" });
  console.error(`Version ${pkg.name}@${pkg.version} already exists on npm.`);
  process.exit(1);
} catch (error) {
  if (error && error.status === 1) {
    process.exit(0);
  }

  throw error;
}
