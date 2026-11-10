# Build and release provenance / 构建与发布来源

[English README](../README.md) · [中文说明](../README.zh-CN.md)

## Source of truth / 唯一源码

Use the repository root. Next.js compiles `app/` and `src/` into static `out/`.
`scripts/serve-out.mjs` serves those exact files. Tauri's frontend input is
`src-tauri/tauri.conf.json` → `../out`; the native entry is `src-tauri/src/main.rs`.

使用仓库根目录：Next.js 将 `app/`、`src/` 编译到 `out/`，预览服务直接读取该目录。
Tauri 打包同一份 `../out`；原生入口为 `src-tauri/src/main.rs`。

Generated output and old previews are not alternative source trees. Never copy
an old renderer into a new installer or delete user workspaces to clean a build.

生成物和旧预览不是替代源码。不能用旧页面打新安装包，也不能以清理构建为由删除用户工作区。

## Prerequisites / 环境

- Web: Node.js 22, npm and the committed `package-lock.json`.
- Desktop: stable Rust MSVC on Windows, C++ build tools/Windows SDK and WebView2;
  preserve `src-tauri/Cargo.lock`. Install the intended Rust target explicitly.
- 网页需要 Node.js 22、npm 和已提交锁文件；Windows 原生构建另需 Rust MSVC、C++
  编译工具/Windows SDK、WebView2，并保留 Cargo 锁文件，明确安装目标架构。

Record `node --version`, `npm --version`, `rustc -vV`, `cargo --version`, OS and
target alongside the release log. Build from a clean checkout of an exact commit.
Do not use `npm update` or regenerate lockfiles during a release build.

发布日志记录工具版本、系统和架构；从确定提交的干净检出构建，期间不要升级依赖或重生成锁文件。

## Source and web checks / 源码及网页检查

```sh
git rev-parse HEAD
git status --short
git worktree list
npm ci
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build
npm run test:production
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

The native test requires frontend output: Tauri's `generate_context!` embeds
`frontendDist` even for tests. On Linux CI install browser dependencies with
`npx playwright-core install --with-deps chromium`; Windows tests can use Edge.
CI action implementations are pinned to full commit IDs.

原生测试同样需要先构建前端。Linux CI 需安装 Chromium 的系统依赖；Windows 测试可使用 Edge。
CI 的 action 实现固定为完整提交 SHA。

Run `npm run serve:out`, then in a separate terminal:

运行生产预览后，在另一个终端核对：

```sh
node scripts/verify-web-release.mjs http://127.0.0.1:3000
```

`scripts/build-identity.mjs` records the source commit and SHA-256 before build,
then rejects source changes during build. `out/verniq-build.json` holds that
identity. The verifier compares served bytes with disk output and writes the
file/hash manifest to ignored `build/`.

构建前后比对源码提交和 SHA-256，过程中源码变化会失败。`out/verniq-build.json`
记录身份；核对脚本比较 HTTP 与磁盘字节，并将文件哈希清单写入忽略的 `build/`。

## Desktop package, only after acceptance / 人工通过后才打桌面包

Obtain manual acceptance of the current preview before generating installers.
The following is a release command, not something the documentation or
screenshot workflow runs automatically:

当前预览须先通过人工验收。下列是发行命令，文档和截图流程不会自动执行：

```sh
npm run desktop:build -- --target x86_64-pc-windows-msvc --bundles nsis
```

ARM64 Windows uses `aarch64-pc-windows-msvc`; install that target first.
The script builds the executable, checks its PE architecture and bundles that
same target. Typical output is `src-tauri/target/<target>/release/bundle/nsis/`;
use the actual build log and `cargo metadata` rather than assuming the path.

ARM64 使用对应目标。脚本先编译、核对 PE 架构，再打同一目标的包；真实目录以日志和
Cargo metadata 为准，不能凭文件名猜测。

The resource map includes application, dictionary and font licenses under
`licenses/`; PDF asset notices are in the frontend output. Inspect actual
installed resources before claiming notice shipping is complete. These build
commands do not configure a signing service, updater or certificate.

资源映射携带应用、词典和字体许可；PDF 声明随前端分发。必须检查实际安装资源，才能确认
随包许可完整；构建命令不意味着已经配置签名、更新服务器或证书。

Record the unique final artifact's path, size, timestamp and SHA-256. Install
that exact file and repeat import → read → look up → review → AI → write →
export → restart/recover. Test upgrades and uninstall separately on a clean
supported Windows environment. Preserve user data until acceptance.

记录唯一产物的路径、大小、时间和 SHA-256；安装该确切文件，重走导入、阅读、查词、复习、
AI、创作、导出和重启恢复。另测干净 Windows、升级和卸载，验收前保留用户数据。

## Rebuild steps are not bit-for-bit reproducibility / 不承诺字节级可复现

These are traceable rebuild instructions, not proof of bit-identical binaries.
Timestamps, framework build identifiers, platform tools and signing may change
bytes. A clean commit and lockfiles improve provenance but do not establish
bit-for-bit reproducibility. A signature authenticates an artifact; it does
not prove every application flow works.

本文提供可追溯的重建步骤，不承诺字节相同。时间戳、框架构建标识、平台工具与签名可能
改变字节；提交和锁文件不足以证明完全可复现。签名也不等于功能正确。

Report source checks, production-web behavior, package creation and installed-app
behavior separately. Only an exercised final artifact supports State D for it.

源码检查、生产网页行为、打包成功和真实安装版行为必须分别报告；只有实际操作最终产物，
才能对该产物宣称 State D。
