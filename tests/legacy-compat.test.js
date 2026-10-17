import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parse } from "acorn";

const legacyDir = new URL("../legacy/", import.meta.url);
const stylePath = new URL("style.css", legacyDir);

describe("legacy JS 語法相容（可用 ES2017 解析 = 無 ES2018+ 語法）", () => {
  const jsFiles = readdirSync(legacyDir).filter((f) => f.endsWith(".js"));
  for (const f of jsFiles) {
    it(`${f} 無 ES2018+ 語法`, () => {
      const code = readFileSync(new URL(f, legacyDir), "utf8");
      expect(() => parse(code, { ecmaVersion: 2017 })).not.toThrow();
    });
  }
});

describe("legacy CSS 舊寫法", () => {
  const forbidden = [
    [/\bclamp\s*\(/, "clamp() 需 Safari 13.1"],
    [/aspect-ratio/, "aspect-ratio 需 Safari 15"],
    [/\binset\s*:/, "inset 需 Safari 14.1"],
    [/(^|[^-])\bgap\s*:/m, "flex/grid 的 gap 需 Safari 14.1（請用 grid-gap 或 margin）"],
    [/\bmin\s*\(/, "min() 需 Safari 13"],
  ];
  it("style.css 不含 Safari 10 不支援的屬性（若檔案存在）", () => {
    if (!existsSync(stylePath)) return;
    const css = readFileSync(stylePath, "utf8");
    for (const [re, msg] of forbidden) {
      expect(re.test(css), msg).toBe(false);
    }
  });
});
