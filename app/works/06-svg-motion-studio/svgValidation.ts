export type SvgValidationResult =
  | { valid: true; viewBox: string | null; hasWidth: boolean; hasHeight: boolean }
  | { valid: false; errors: readonly string[] };

const forbiddenElements = new Set(["script", "foreignobject", "iframe", "object", "embed", "image"]);
const urlAttributes = new Set(["href", "xlink:href", "src"]);

function decodeEntities(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(?:colon|tab|newline);/gi, (match, numeric: string | undefined) => {
    if (numeric) return String.fromCodePoint(Number.parseInt(numeric.replace(/^x/i, ""), numeric[0].toLowerCase() === "x" ? 16 : 10));
    return match.toLowerCase() === "&colon;" ? ":" : " ";
  });
}

function unsafeReference(value: string): string | null {
  const normalized = decodeEntities(value).replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  if (normalized.startsWith("javascript:")) return "javascript: スキーム";
  if (normalized.startsWith("data:")) return "data URL";
  if (normalized.startsWith("//") || /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) return "外部URL";
  return null;
}

function externalUrlFunction(value: string): boolean {
  return [...decodeEntities(value).matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some((match) => {
    const target = match[2].trim();
    return !target.startsWith("#") || unsafeReference(target) !== null;
  });
}

export function validateSvg(source: string): SvgValidationResult {
  if (source.trim() === "") return { valid: false, errors: ["SVGコードを入力してください。"] };
  const errors: string[] = [];
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(withoutComments)) errors.push("DOCTYPEまたはENTITY宣言は処理できません。");
  const tokens = withoutComments.match(/<[^>]*>|[^<]+/g);
  if (!tokens || tokens.join("") !== withoutComments) return { valid: false, errors: ["XML構文を解析できません。"] };

  const stack: string[] = [];
  let root: string | null = null;
  let rootAttributes = "";
  for (const token of tokens) {
    if (!token.startsWith("<") || /^<\?|^<!\[CDATA\[/.test(token)) continue;
    if (/^<\//.test(token)) {
      const close = token.match(/^<\/\s*([\w:.-]+)\s*>$/);
      if (!close || stack.pop()?.toLowerCase() !== close[1].toLowerCase()) errors.push("開始タグと終了タグが一致しません。");
      continue;
    }
    if (/^<!/.test(token)) continue;
    const open = token.match(/^<\s*([\w:.-]+)((?:\s+[\s\S]*?)?)\s*(\/?)>$/);
    if (!open) { errors.push("XMLタグの構文が正しくありません。"); continue; }
    const name = open[1];
    const lowerName = name.toLowerCase();
    if (!root) { root = lowerName; rootAttributes = open[2]; }
    if (forbiddenElements.has(lowerName)) errors.push(`<${name}>要素は処理できません。`);

    const attributes = open[2];
    const attributePattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    const stripped = attributes.replace(attributePattern, "").trim();
    if (stripped) errors.push(`<${name}>に解析できない属性があります。`);
    for (const match of attributes.matchAll(attributePattern)) {
      const attrName = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? "";
      if (/^on/i.test(attrName)) errors.push(`${match[1]}イベント属性は処理できません。`);
      if (urlAttributes.has(attrName)) {
        const reason = unsafeReference(value);
        if (reason) errors.push(`${match[1]}に${reason}が含まれています。`);
        else if (value.trim() !== "" && !value.trim().startsWith("#")) errors.push(`${match[1]}は同一SVG内の#id参照だけ使用できます。`);
      }
      if (externalUrlFunction(value)) errors.push(`${match[1]}属性に外部リソースを参照するurl()があります。`);
      const generalReason = unsafeReference(value);
      if (generalReason === "javascript: スキーム" || generalReason === "data URL") errors.push(`${match[1]}属性に処理できないURLがあります。`);
    }
    if (!open[3]) stack.push(lowerName);
  }
  if (stack.length) errors.push("閉じられていないXMLタグがあります。");
  if (root !== "svg") errors.push("ルート要素はsvgである必要があります。");

  const styleContents = [...withoutComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
  if (styleContents.some((match) => /@import/i.test(match[1]) || externalUrlFunction(match[1]))) errors.push("style要素に外部CSSまたは外部リソース参照があります。");
  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length) return { valid: false, errors: uniqueErrors };
  const attr = (name: string) => rootAttributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  const viewBox = attr("viewBox");
  return { valid: true, viewBox: viewBox ? (viewBox[1] ?? viewBox[2]) : null, hasWidth: Boolean(attr("width")), hasHeight: Boolean(attr("height")) };
}
