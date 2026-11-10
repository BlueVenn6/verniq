import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("@tauri-apps/cli")), "tauri.js");
const args = process.argv.slice(2);
const targetIndex = args.findIndex((arg) => arg === "--target" || arg === "-t");
const rustInfo = execFileSync("rustc", ["-vV"], { encoding: "utf8", cwd: root });
const host = rustInfo.match(/^host: (.+)$/m)?.[1].trim();
const target = targetIndex >= 0 ? args[targetIndex + 1] : process.env.CARGO_BUILD_TARGET || host;
if (!target || target.startsWith("-")) throw new Error("A Rust target triple is required.");
if (targetIndex >= 0) args.splice(targetIndex, 2);
if (args.some((arg) => arg.startsWith("--target="))) throw new Error("Use --target <triple>.");

function tauri(command, extra = []) {
  const result = spawnSync(process.execPath, [cli, command, "--target", target, ...args, ...extra], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Rust host: ${host}; explicit build and bundle target: ${target}; Node: ${process.arch}`);
tauri("build", ["--no-bundle"]);

const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--manifest-path", "src-tauri/Cargo.toml", "--no-deps", "--format-version", "1"], { encoding: "utf8", cwd: root }));
const profile = args.includes("--debug") || args.includes("-d") ? "debug" : "release";
const config = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
const binaryName = config.mainBinaryName || readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8").match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const executable = join(metadata.target_directory, target, profile, `${binaryName}${target.includes("windows") ? ".exe" : ""}`);
if (target.includes("windows")) {
  const expected = target.startsWith("aarch64-") ? 0xaa64 : target.startsWith("x86_64-") ? 0x8664 : target.startsWith("i686-") ? 0x14c : undefined;
  const bytes = readFileSync(executable);
  const machine = bytes.readUInt16LE(bytes.readUInt32LE(0x3c) + 4);
  if (!expected || machine !== expected) throw new Error(`Refusing to package ${executable}: PE machine 0x${machine.toString(16)} does not match ${target}.`);
  console.log(`Verified executable architecture: 0x${machine.toString(16)} (${target})`);
}
tauri("bundle");
