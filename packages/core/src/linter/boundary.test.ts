import { describe, it, expect } from "vitest";
import { checkImportBoundaries, getSliceDirectory, matchesPattern, matchesRule } from "./boundary.js";
import type { StructureRule } from "../schema/manifest.js";
import type { ExtractedImport } from "./ast-analyzer.js";
import type { ResolvedImport } from "./path-resolver.js";

describe("BoundaryValidator", () => {
  it("getSliceDirectory でモジュールスライスのルートを正しく取得できる", () => {
    expect(getSliceDirectory("src/features/*", "src/features/cart/ui/button.tsx")).toBe("src/features/cart");
    expect(getSliceDirectory("src/features/*", "src/features/auth/api.ts")).toBe("src/features/auth");
    expect(getSliceDirectory("src/components/ui", "src/components/ui/button.tsx")).toBe("src/components/ui");
    expect(getSliceDirectory("src/features/*", "src/other/file.ts")).toBeNull();
  });

  it("matchesRule でファイルの所属ルールを正しく判定できる", () => {
    expect(matchesRule("src/features/*", "src/features/cart/index.ts")).toBe(true);
    expect(matchesRule("src/features/*", "src/features/cart/model/types.ts")).toBe(true);
    expect(matchesRule("src/components/ui", "src/components/ui/button.tsx")).toBe(true);
    expect(matchesRule("src/features/*", "src/components/ui/button.tsx")).toBe(false);
  });

  it("matchesPattern でパスパターンとの一致を正しく判定できる", () => {
    expect(matchesPattern("src/features/cart/model", "src/features/*")).toBe(true);
    expect(matchesPattern("src/lib/utils", "src/lib")).toBe(true);
    expect(matchesPattern("src/lib/utils", "src/lib/**")).toBe(true);
  });

  describe("checkImportBoundaries", () => {
    const featureRule: StructureRule = {
      path: "src/features/*",
      allowed_imports: ["src/components/ui", "src/lib/**"],
      forbidden_imports: ["src/features/*"],
      required_files: [],
      disallowed_files: [],
      allow_unmatched_files: true,
      tags: [],
    };

    const dummyExtracted: ExtractedImport = {
      specifier: "",
      line: 1,
      column: 1,
      sourceLineText: "",
      isTypeOnly: false,
    };

    it("同一Feature内部のインポートは許可される", () => {
      const fromFile = "src/features/cart/ui/button.tsx";
      const resolved: ResolvedImport = {
        rawSpecifier: "../model/types",
        isExternal: false,
        projectRelativePath: "src/features/cart/model/types.ts",
      };

      const result = checkImportBoundaries(fromFile, featureRule, dummyExtracted, resolved);
      expect(result).toBeNull(); // 違反なし
    });

    it("別Featureへのインポート（クロスインポート）は forbidden_imports 違反として検出される", () => {
      const fromFile = "src/features/checkout/api.ts";
      const resolved: ResolvedImport = {
        rawSpecifier: "@/features/cart",
        isExternal: false,
        projectRelativePath: "src/features/cart/index.ts",
      };
      const extracted: ExtractedImport = {
        ...dummyExtracted,
        specifier: "@/features/cart",
        sourceLineText: 'import { getCart } from "@/features/cart";',
      };

      const result = checkImportBoundaries(fromFile, featureRule, extracted, resolved);
      expect(result).not.toBeNull();
      expect(result?.severity).toBe("error");
      expect(result?.message).toContain("禁止されているインポートパス");
      expect(result?.forbiddenTarget).toBe("@/features/cart");
    });

    it("allowed_imports に含まれるモジュールへのインポートは許可される", () => {
      const fromFile = "src/features/cart/ui/button.tsx";
      const resolved: ResolvedImport = {
        rawSpecifier: "@/components/ui/button",
        isExternal: false,
        projectRelativePath: "src/components/ui/button.tsx",
      };

      const result = checkImportBoundaries(fromFile, featureRule, dummyExtracted, resolved);
      expect(result).toBeNull();
    });

    it("allowed_imports に含まれない未知のモジュールへのインポートは拒否される", () => {
      const fromFile = "src/features/cart/ui/button.tsx";
      const resolved: ResolvedImport = {
        rawSpecifier: "@/app/page",
        isExternal: false,
        projectRelativePath: "src/app/page.tsx",
      };
      const extracted: ExtractedImport = {
        ...dummyExtracted,
        specifier: "@/app/page",
      };

      const result = checkImportBoundaries(fromFile, featureRule, extracted, resolved);
      expect(result).not.toBeNull();
      expect(result?.message).toContain("許可されていないインポートパス");
    });
  });
});
