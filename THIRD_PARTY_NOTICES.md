# Third-party notices / 第三方许可说明

Verniq application code is licensed under [Apache-2.0](LICENSE). Dictionaries,
fonts and dependencies retain their own licenses. The application license does
not replace their terms.

Verniq 应用代码采用 [Apache-2.0](LICENSE)。词典、字体和依赖分别遵循各自许可；
应用许可证不替代这些许可。

| Component / 组件 | Attribution and license / 署名与许可 | Bundled notice / 随包许可 |
| --- | --- | --- |
| ECDICT | [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT), MIT | [Original license / 原始许可](public/dictionaries/ecdict/LICENSE.txt) |
| CC-CEDICT | CC-CEDICT contributors; distributed by MDBG / CC-CEDICT 贡献者，MDBG 分发；CC BY-SA 4.0 | [Attribution / 署名](public/dictionaries/README.md), [license / 许可](licenses/CC-BY-SA-4.0.txt) |
| Noto Serif SC | The Noto Project Authors, SIL OFL 1.1 | [Original notice / 原始许可](public/fonts/cards/NotoSerifSC-OFL.txt) |
| Noto Sans SC | The Noto Project Authors, SIL OFL 1.1 | [Original notice / 原始许可](public/fonts/cards/NotoSansSC-OFL.txt) |
| PDF.js | Mozilla Foundation and contributors, Apache-2.0 | The installed package's `LICENSE`, character-map and standard-font notices are copied by `scripts/prepare-pdf-assets.mjs` into `public/pdfjs/`, then into the production output. / 构建前复制已安装包的许可证、字符映射和标准字体声明，随生产输出分发。 |

CC-CEDICT is shipped as the unmodified compressed dictionary, including its
original header. Its data license is separate from the application's code
license. ECDICT conversion and font source fingerprints are recorded in
`public/dictionaries/ecdict/source.json` and `public/fonts/cards/sources.json`.

CC-CEDICT 以未修改的压缩词库分发，保留原始文件头；其数据许可与应用代码许可分开。
ECDICT 转换和字体来源指纹分别记录于上述来源清单。

The Tauri resource mapping includes this notice, the application license and the
dictionary/font license texts under `licenses/`. This is a configured packaging
input; the contents of an actual installer must still be checked before release.

Tauri 资源配置将本说明、应用许可、词典和字体许可放入安装资源的 `licenses/`。
这代表打包输入已配置，正式发布前仍须检查实际安装包内容。

JavaScript and Rust dependencies have additional licenses. Consult
`package-lock.json`, `src-tauri/Cargo.lock` and upstream license files. This table
documents bundled data/fonts and PDF support; it is not a claim that a complete
legal review of every transitive dependency has been performed.

JavaScript 与 Rust 依赖还有各自许可，请结合锁文件和上游声明核查。本表覆盖随包数据、
字体和 PDF 支持，不代表已经对所有间接依赖完成全面法律审查。
