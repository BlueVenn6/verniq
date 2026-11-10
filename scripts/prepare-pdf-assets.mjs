import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const destination = fileURLToPath(new URL("../public/pdfjs/", import.meta.url));
await mkdir(destination, { recursive: true });
// Ship the installed parser's matching resources locally, including their licenses.
// They are needed by CID fonts in many Chinese PDFs, even for text extraction.
for (const directory of ["cmaps", "standard_fonts"]) {
  await cp(join(pdfRoot, directory), join(destination, directory), { recursive: true });
}
await cp(join(pdfRoot, "LICENSE"), join(destination, "LICENSE"));
console.log("Prepared local PDF character maps and fonts.");
