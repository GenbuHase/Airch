import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { StructureLinter } from "./linter.js";
import type { AirchManifest } from "../schema/manifest.js";

describe("StructureLinter (Integration)", () => {
  let tempDir: string;

  const manifest: AirchManifest = {
    version: "1.0",
    project: {
      name: "linter-test",
      architecture: "feature-sliced",
      root: "./src",
    },
    structure: [
      {
        name: "Features",
        path: "src/features/*",
        allowed_imports: ["src/components/ui", "src/lib"],
        forbidden_imports: ["src/features/*"],
        naming_convention: "kebab-case",
        required_files: ["index.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: [],
      },
      {
        name: "UI Components",
        path: "src/components/ui",
        allowed_imports: ["src/lib"],
        forbidden_imports: [],
        naming_convention: "PascalCase",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: [],
      },
    ],
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-linter-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("境界違反がないクリーンなプロジェクトでは成功 (0エラー) となる", async () => {
    // 正常な構成を作成
    const cartDir = path.join(tempDir, "src/features/cart");
    const uiDir = path.join(tempDir, "src/components/ui");
    await fs.mkdir(cartDir, { recursive: true });
    await fs.mkdir(uiDir, { recursive: true });

    await fs.writeFile(path.join(cartDir, "index.ts"), "export const cart = {};\n", "utf-8");
    await fs.writeFile(path.join(uiDir, "Button.tsx"), "export const Button = () => null;\n", "utf-8");

    const linter = new StructureLinter(tempDir);
    const result = await linter.lint(manifest);

    expect(result.success).toBe(true);
    expect(result.summary.errorCount).toBe(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("命名規則違反および必須ファイルの欠落を正確に検知する", async () => {
    // 命名違反: Button_Group.tsx (PascalCase違反)
    // 必須ファイル欠落: auth ディレクトリに index.ts がない
    const authDir = path.join(tempDir, "src/features/auth");
    const uiDir = path.join(tempDir, "src/components/ui");
    await fs.mkdir(authDir, { recursive: true });
    await fs.mkdir(uiDir, { recursive: true });

    await fs.writeFile(path.join(authDir, "login.ts"), "export const login = () => {};\n", "utf-8");
    await fs.writeFile(path.join(uiDir, "button_group.tsx"), "export const ButtonGroup = () => null;\n", "utf-8");

    const linter = new StructureLinter(tempDir);
    const result = await linter.lint(manifest);

    expect(result.success).toBe(false);
    expect(result.summary.errorCount).toBe(2);

    const namingErr = result.diagnostics.find((d) => d.filePath.includes("button_group.tsx"));
    expect(namingErr).toBeDefined();
    expect(namingErr?.message).toContain("命名規則 'PascalCase' に違反しています");

    const presenceErr = result.diagnostics.find((d) => d.filePath.includes("index.ts"));
    expect(presenceErr).toBeDefined();
    expect(presenceErr?.message).toContain("必須ファイル 'index.ts' がモジュール 'src/features/auth' に存在しません");
  });

  it("--fix オプションで命名違反のリネームと必須ファイル生成が自動実行される", async () => {
    const authDir = path.join(tempDir, "src/features/auth");
    const uiDir = path.join(tempDir, "src/components/ui");
    await fs.mkdir(authDir, { recursive: true });
    await fs.mkdir(uiDir, { recursive: true });

    await fs.writeFile(path.join(authDir, "login.ts"), "export const login = () => {};\n", "utf-8");
    await fs.writeFile(path.join(uiDir, "button_group.tsx"), "export const ButtonGroup = () => null;\n", "utf-8");

    const linter = new StructureLinter(tempDir);
    const fixResult = await linter.lint(manifest, { fix: true });

    expect(fixResult.summary.fixedCount).toBe(2);

    // リネーム後の確認
    const renamedExists = await fs
      .stat(path.join(uiDir, "ButtonGroup.tsx"))
      .then(() => true)
      .catch(() => false);
    expect(renamedExists).toBe(true);

    // スタブ作成の確認
    const stubExists = await fs
      .stat(path.join(authDir, "index.ts"))
      .then(() => true)
      .catch(() => false);
    expect(stubExists).toBe(true);
  });

  it("禁止インポート（Feature間のクロスインポート）を検知し行番号と列番号を特定する", async () => {
    const cartDir = path.join(tempDir, "src/features/cart");
    const authDir = path.join(tempDir, "src/features/auth");
    await fs.mkdir(cartDir, { recursive: true });
    await fs.mkdir(authDir, { recursive: true });

    await fs.writeFile(path.join(cartDir, "index.ts"), "export const cart = {};\n", "utf-8");
    await fs.writeFile(path.join(authDir, "index.ts"), "export const auth = {};\n", "utf-8");

    // cart から auth を直接インポート (違反)
    const cartCode = `
import { auth } from "../auth/index.js";
export const useCart = () => auth;
`;
    await fs.writeFile(path.join(cartDir, "cart.ts"), cartCode, "utf-8");

    const linter = new StructureLinter(tempDir);
    const result = await linter.lint(manifest);

    expect(result.success).toBe(false);
    const importErr = result.diagnostics.find((d) => d.message.includes("禁止されているインポートパス"));
    expect(importErr).toBeDefined();
    expect(importErr?.line).toBe(2);
    expect(importErr?.forbiddenTarget).toBe("../auth/index.js");
  });
});
