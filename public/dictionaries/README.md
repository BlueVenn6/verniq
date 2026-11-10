# CC-CEDICT

Chinese definitions and tone-number pinyin by the CC-CEDICT contributors, distributed by MDBG.

Source: https://www.mdbg.net/chinese/dictionary?page=cedict

The unmodified dictionary `cedict.txt.gz` is licensed under **Creative Commons Attribution-ShareAlike 4.0 International**:
https://creativecommons.org/licenses/by-sa/4.0/

The dictionary is loaded locally on first Chinese lookup. It includes simplified and traditional headwords and English definitions. Definitions may contain upstream editorial notes and cross-references. It does not provide generated audio or grammar analysis.

Update explicitly with `node scripts/update-cedict.mjs`; this is not run during normal builds. `cedict-source.json` records the downloaded version, entry count and SHA-256. The original license header remains in the compressed data. This data license applies to the dictionary, separately from application code.

## 中文说明

CC-CEDICT 由社区贡献者编写、MDBG 分发，提供简繁体词头、声调数字拼音和英文释义，按 **CC BY-SA 4.0** 授权。原始数据及许可头保留在 `cedict.txt.gz` 中；数据许可独立于应用代码许可。

首次中文查词时从本地加载；释义可能保留上游编者注和交叉引用，不提供生成音频或语法分析。更新需明确运行 `node scripts/update-cedict.mjs`，正常构建不会下载更新。`cedict-source.json` 记录来源版本、词条数和 SHA-256。
