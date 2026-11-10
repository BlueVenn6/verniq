/** Conservative guidance for the two supported study languages; ambiguous text stays manual. */
export function detectMaterialLanguage(text: string): "en" | "zh" | null {
  const sample = text.slice(0, 12000);
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Hangul}]/u.test(sample)) return null;
  const han = (sample.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (sample.match(/[a-z]/gi) ?? []).length;
  if (han >= 8 && han * 2 > latin) return "zh";
  if (latin >= 25 && latin > han * 6) return "en";
  return null;
}
