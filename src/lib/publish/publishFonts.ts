import type { PublishCardFontId } from "./publishPresets";

const sources = { serif: "/fonts/cards/NotoSerifSC-VF.woff2", sans: "/fonts/cards/NotoSansSC-VF.woff2" };
const embeddedFonts = new Map<string, Promise<string>>();

// SVG images rendered on canvas cannot depend on the document's loaded fonts.
// Embed the same locally bundled font so PNG output does not change typefaces.
export async function embedPublishCardFonts(svg: string) {
  for (const [id, family] of [["serif", "Verniq Card Serif"], ["sans", "Verniq Card Sans"]] as const) {
    if (!svg.includes(family)) continue;
    const dataUrl = await fontDataUrl(id);
    const style = `<style>@font-face{font-family:'${family}';src:url('${dataUrl}') format('woff2');font-weight:100 900;font-style:normal;}</style>`;
    svg = svg.replace(/(<svg\b[^>]*>)/, `$1${style}`);
  }
  return svg;
}

function fontDataUrl(id: PublishCardFontId) {
  let pending = embeddedFonts.get(id);
  if (!pending) {
    pending = fetch(sources[id]).then(async response => {
      if (!response.ok) throw new Error("卡片字体加载失败，请重试导出。");
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("卡片字体加载失败，请重试导出。"));
        reader.readAsDataURL(blob);
      });
    }).catch(() => {
      embeddedFonts.delete(id);
      throw new Error("卡片字体加载失败，请重试导出。");
    });
    embeddedFonts.set(id, pending);
  }
  return pending;
}
