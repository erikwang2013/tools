const fs = require("fs")
const { spawnSync } = require("child_process")

const PW_BUILD_DATA_DIR = "./.postwoman"
const IS_DEV_MODE = process.argv.includes("--dev")

const runCommand = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.error || result.status !== 0) return ""
  return (result.stdout || "").trim()
}

const main = async () => {
  if (!fs.existsSync(PW_BUILD_DATA_DIR)) {
    fs.mkdirSync(PW_BUILD_DATA_DIR)
  }

  const pkg = require("./package.json")
  const lastTag = runCommand("git", ["tag", "--sort=committerdate"]).split("\n").pop()
  const version = {
    name: process.env.TRAVIS_TAG || lastTag || pkg.version,
    hash: runCommand("git", ["rev-parse", "--short", "HEAD"]),
  }

  let variant = process.env.TRAVIS_BRANCH || runCommand("git", ["branch", "--show-current"])
  if (IS_DEV_MODE) variant = `${variant} - DEV MODE`
  if (variant && !["", "master"].includes(variant)) {
    version.variant = variant
  }

  fs.writeFileSync(`${PW_BUILD_DATA_DIR}/version.json`, JSON.stringify(version))
}

main().catch(ex => {
  console.error(ex)
  // Keep the build alive; the footer can fall back to package.json on rebuild.
  process.exit(0)
})
