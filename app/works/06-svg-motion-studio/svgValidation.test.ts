import { describe, expect, it } from "vitest";
import { validateSvg } from "./svgValidation";

describe("validateSvg", () => {
  it("単純SVGと情報を受理する", () => expect(validateSvg('<svg viewBox="0 0 24 24" width="24" height="24"><path d="M0 0"/></svg>')).toEqual({ valid: true, viewBox: "0 0 24 24", hasWidth: true, hasHeight: true }));
  it("Figmaに近い一般的な要素、内部参照、titleとdescを受理する", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><title>A</title><desc>B</desc><defs><linearGradient id="g"><stop offset="0"/></linearGradient><clipPath id="c"><rect width="2" height="2"/></clipPath><mask id="m"><circle cx="1" cy="1" r="1"/></mask><g id="icon"><ellipse/><line/><polyline/><polygon/><path/></g></defs><use href="#icon"/><use xlink:href="#icon"/></svg>';
    expect(validateSvg(svg)).toEqual({ valid: true, viewBox: null, hasWidth: false, hasHeight: false });
  });
  it.each(["", "   "])("空入力を拒否する", (svg) => expect(validateSvg(svg).valid).toBe(false));
  it.each([
    ["SVG以外", "<div></div>"], ["XML不整合", "<svg><g></svg>"], ["script", "<svg><script/></svg>"],
    ["大文字script", "<svg><SCRIPT/></svg>"], ["foreignObject", "<svg><foreignObject/></svg>"],
    ["iframe", "<svg><iframe/></svg>"], ["object", "<svg><object/></svg>"], ["embed", "<svg><embed/></svg>"],
    ["onclick", "<svg onclick=\"x\"/>"] , ["onload", "<svg onload=\"x\"/>"] , ["onerror", "<svg ONERROR=\"x\"/>"] ,
    ["javascript", "<svg><use href=\"javascript:alert(1)\"/></svg>"], ["空白javascript", "<svg><use href=\"  java&#115;cript:alert(1)\"/></svg>"],
    ["http", "<svg><use href=\"http://example.com/x\"/></svg>"], ["https", "<svg><use href=\"https://example.com/x\"/></svg>"],
    ["protocol relative", "<svg><use href=\"//example.com/x\"/></svg>"], ["data URL", "<svg><use href=\"data:image/svg+xml,x\"/></svg>"],
    ["外部画像", "<svg><image href=\"https://example.com/x.png\"/></svg>"],
    ["style URL", "<svg><style>.a{fill:url(https://example.com/x)}</style></svg>"],
    ["style属性URL", "<svg style=\"fill:url(https://example.com/x)\"/>"] ,
    ["filter属性URL", "<svg><path filter=\"url(https://example.com/filter.svg#x)\"/></svg>"],
  ])("%sを拒否する", (_label, svg) => expect(validateSvg(svg).valid).toBe(false));
  it("検証で入力文字列を変更しない", () => { const svg = '<svg viewBox="0 0 24 24">\n  <!-- keep -->\n  <path d="M0.123 2" />\n</svg>'; const before = svg; validateSvg(svg); expect(svg).toBe(before); });
});
