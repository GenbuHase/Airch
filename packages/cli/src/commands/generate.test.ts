import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { executeGenerate } from "./generate.js";

describe("CLI generate command", () => {
  let tempDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-cli-test-"));
    manifestPath = path.join(tempDir, "airch.yaml");

    const yamlContent = `
version: "1.0"
project:
  name: "cli-test-app"
  architecture: "feature-sliced"
structure:
  - path: "src/features/*"
    allowed_imports: ["src/lib"]
`;
    await fs.writeFile(manifestPath, yamlContent, "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("特定ターゲットのみを指定して生成できる", async () => {
    await executeGenerate({
      config: manifestPath,
      outDir: tempDir,
      target: ["cursor"],
    });

    const cursorExists = await fs
      .stat(path.join(tempDir, ".cursorrules"))
      .then(() => true)
      .catch(() => false);
    const agentsExists = await fs
      .stat(path.join(tempDir, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);

    expect(cursorExists).toBe(true);
    expect(agentsExists).toBe(false);
  });

  it("--check フラグで未作成ファイルがある場合に exitCode が 1 に設定される", async () => {
    process.exitCode = 0;
    await executeGenerate({
      config: manifestPath,
      outDir: tempDir,
      check: true,
    });

    expect(process.exitCode).toBe(1);
    process.exitCode = 0; // リセット
  });

  it("正常に生成された後、--check フラグで exitCode 0 で同期成功する", async () => {
    // 1. 生成
    await executeGenerate({
      config: manifestPath,
      outDir: tempDir,
    });

    // 2. 検証
    process.exitCode = 0;
    await executeGenerate({
      config: manifestPath,
      outDir: tempDir,
      check: true,
    });

    expect(process.exitCode).toBe(0);
  });
});
