import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { executeCheck } from "./check.js";

describe("CLI check command", () => {
  let tempDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-cli-check-test-"));
    manifestPath = path.join(tempDir, "airch.yaml");

    const yamlContent = `
version: "1.0"
project:
  name: "cli-check-app"
  architecture: "feature-sliced"
  root: "./src"
structure:
  - path: "src/features/*"
    allowed_imports: ["src/lib"]
    forbidden_imports: ["src/features/*"]
    naming_convention: "kebab-case"
    required_files: ["index.ts"]
`;
    await fs.writeFile(manifestPath, yamlContent, "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("境界違反がない場合は exitCode 0 で正常終了する", async () => {
    const cartDir = path.join(tempDir, "src/features/cart");
    await fs.mkdir(cartDir, { recursive: true });
    await fs.writeFile(path.join(cartDir, "index.ts"), "export const cart = 1;\n", "utf-8");

    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
    });

    expect(process.exitCode).toBe(0);
  });

  it("必須ファイル欠落や命名違反がある場合は exitCode 1 に設定される", async () => {
    const authDir = path.join(tempDir, "src/features/auth");
    await fs.mkdir(authDir, { recursive: true });
    // index.ts がなく、命名違反の Bad_Login.ts がある
    await fs.writeFile(path.join(authDir, "Bad_Login.ts"), "export const x = 1;\n", "utf-8");

    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
    });

    expect(process.exitCode).toBe(1);
    process.exitCode = 0; // リセット
  });

  it("--format json で実行できる", async () => {
    const cartDir = path.join(tempDir, "src/features/cart");
    await fs.mkdir(cartDir, { recursive: true });
    await fs.writeFile(path.join(cartDir, "index.ts"), "export const cart = 1;\n", "utf-8");

    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
      format: "json",
    });

    expect(process.exitCode).toBe(0);
  });

  it("--fix オプションで命名不整合と必須ファイルが修正され正常終了する", async () => {
    const authDir = path.join(tempDir, "src/features/auth");
    await fs.mkdir(authDir, { recursive: true });
    await fs.writeFile(path.join(authDir, "Bad_Login.ts"), "export const x = 1;\n", "utf-8");

    // 1. 最初は違反ありで失敗
    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
    });
    expect(process.exitCode).toBe(1);

    // 2. --fix を指定して修復実行
    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
      fix: true,
    });

    // 3. 修復されたため、再度 check すると成功 (exitCode 0) となる
    process.exitCode = 0;
    await executeCheck({
      config: manifestPath,
    });
    expect(process.exitCode).toBe(0);
  });
});
