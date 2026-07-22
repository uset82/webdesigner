import { optimize as optimizeWithSvgo } from "svgo";

export function optimizeSvg(svg: string): string {
  const sanitized = sanitizeSvg(svg);
  const optimized = optimizeWithSvgo(sanitized, {
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { cleanupIds: false, collapseGroups: false } }
      }
    ]
  }).data;
  const compacted = optimized.replace(/>\s+</g, "><").trim();

  return removeRootDimensionsWhenViewBoxExists(sanitizeSvg(compacted));
}

/** Remove executable or externally loaded content before an SVG enters the Webview. */
export function sanitizeSvg(svg: string): string {
  const unsafeElement =
    "(?:[a-zA-Z_][\\w.-]*:)?(?:script|foreignObject|style|iframe|object|embed|link|meta|image|audio|video)";
  const pairedUnsafeElement = new RegExp(`<${unsafeElement}\\b[^>]*>[\\s\\S]*?<\\/${unsafeElement}\\s*>`, "gi");
  const standaloneUnsafeElement = new RegExp(`<\\/?${unsafeElement}\\b[^>]*\\/?>`, "gi");

  return svg
    .replace(/<!DOCTYPE[\s\S]*?\]>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(pairedUnsafeElement, "")
    .replace(standaloneUnsafeElement, "")
    .replace(/\s([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, sanitizeAttribute)
    .replace(/\s(?:on[a-z]+|style|href|xlink:href|src)\s*=\s*(?!["'])[^\s>]+/gi, "");
}

function sanitizeAttribute(
  match: string,
  rawName: string,
  _quoted: string,
  doubleValue?: string,
  singleValue?: string
) {
  const name = rawName.toLowerCase();
  const value = doubleValue ?? singleValue ?? "";

  if (name.startsWith("on") || name === "style" || name === "src") return "";
  if (name === "href" || name === "xlink:href") {
    return /^#[A-Za-z_][\w:.-]*$/.test(value) ? match : "";
  }
  if (name === "xmlns" || name.startsWith("xmlns:")) return match;
  if (/\b(?:javascript|data|https?|file|blob|ftp):/i.test(value) || /^\s*\/\//.test(value)) return "";

  const urlReferences = [...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)];
  if (urlReferences.some((reference) => !/^#[A-Za-z_][\w:.-]*$/.test(reference[2] ?? ""))) return "";
  return match;
}

function removeRootDimensionsWhenViewBoxExists(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (svgTag) => {
    if (!/\sviewBox=(?:"[^"]*"|'[^']*')/i.test(svgTag)) {
      return svgTag;
    }

    return svgTag.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  });
}
