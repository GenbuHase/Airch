import { describe, it, expect } from "vitest";
import { ManifestSchema } from "./manifest.js";

describe("ManifestSchema", () => {
  it("有効なマニフェストを正しくパースできる", () => {
    const valid = {
      version: "1.0",
      project: {
        name: "test-app",
        architecture: "feature-sliced",
      },
      structure: [
        {
          path: "src/features/*",
          allowed_imports: ["src/lib"],
          forbidden_imports: ["src/features/*"],
          naming_convention: "kebab-case",
        },
      ],
      conventions: {
        typescript: {
          strict: true,
          export_style: "named",
        },
        rules: ["カスタムルール1"],
      },
      commands: {
        lint: {
          run: "pnpm lint",
          description: "リント実行",
        },
      },
    };

    const parsed = ManifestSchema.parse(valid);
    expect(parsed.version).toBe("1.0");
    expect(parsed.project.name).toBe("test-app");
    expect(parsed.structure).toHaveLength(1);
    expect(parsed.structure[0]?.allowed_imports).toEqual(["src/lib"]);
    expect(parsed.conventions?.typescript?.strict).toBe(true);
    expect(parsed.commands?.lint?.run).toBe("pnpm lint");
  });

  it("version が 1.0 以外の場合はバリデーションエラーとなる", () => {
    const invalid = {
      version: "2.0",
      project: { name: "test-app", architecture: "clean" },
      structure: [{ path: "src/*" }],
    };

    expect(() => ManifestSchema.parse(invalid)).toThrow();
  });

  it("structure が空配列の場合はバリデーションエラーとなる", () => {
    const invalid = {
      version: "1.0",
      project: { name: "test-app", architecture: "clean" },
      structure: [],
    };

    expect(() => ManifestSchema.parse(invalid)).toThrow("structure には少なくとも1つのルールが必要です");
  });

  it("デフォルト値が正しく適用される", () => {
    const minimal = {
      version: "1.0",
      project: { name: "minimal-app", architecture: "layered" },
      structure: [{ path: "src/app" }],
    };

    const parsed = ManifestSchema.parse(minimal);
    expect(parsed.project.root).toBe(".");
    expect(parsed.structure[0]?.allowed_imports).toEqual([]);
    expect(parsed.structure[0]?.forbidden_imports).toEqual([]);
    expect(parsed.structure[0]?.required_files).toEqual([]);
    expect(parsed.structure[0]?.allow_unmatched_files).toBe(true);
  });
});
