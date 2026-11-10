# Share card fonts

Noto Serif SC and Noto Sans SC provide Chinese and Latin text for card previews
and PNG exports. They are bundled locally; exporting does not contact a font CDN.

Both families use SIL Open Font License 1.1. Their original notices are included
in `NotoSerifSC-OFL.txt` and `NotoSansSC-OFL.txt`. Commercial use and embedding
are permitted under those terms. The license does not apply to exported cards.

`sources.json` records each upstream Git blob and the SHA-256 of the bundled
WOFF2 file. The original variable TTFs from `google/fonts` were converted to
WOFF2 with fontTools and Brotli without changing glyphs or font names.

## 中文说明

分享卡片预览和 PNG 导出使用本地随附的 Noto Serif SC 与 Noto Sans SC，支持中文及拉丁文字，无需连接字体 CDN。

两款字体均按 SIL Open Font License 1.1 授权，原始声明见两个 `*-OFL.txt` 文件，允许在许可条件下商用和嵌入；字体许可不约束用户导出的卡片作品。

`sources.json` 记录上游 Git blob 和随附 WOFF2 文件的 SHA-256。字体由 `google/fonts` 的原始可变 TTF 使用 fontTools 和 Brotli 转换，未更改字形或字体名称。
