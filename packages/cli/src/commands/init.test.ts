import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { executeInit } from "./init.js";

describe("CLI init command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-cli-init-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("非対話モード (--yes) で airch.yaml とルールファイルが自動生成される", async () => {
    process.exitCode = 0;
    await executeInit({
      outDir: tempDir,
      preset: "feature-sliced",
      yes: true,
    });

    expect(process.exitCode).toBe(0);

    const manifestExists = await fs
      .stat(path.join(tempDir, "airch.yaml"))
      .then(() => true)
      .catch(() => false);
    expect(manifestExists).toBe(true);

    const content = await fs.readFile(path.join(tempDir, "airch.yaml"), "utf-8");
    expect(content).toContain("yaml-language-server: $schema=");
    expect(content).toContain("feature-sliced");

    // ルールファイルも生成されていること
    const agentsExists = await fs
      .stat(path.join(tempDir, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);
    expect(agentsExists).toBe(true);
  });

  it("既存の airch.yaml が存在する場合、--force なしでは失敗する", async () => {
    await fs.writeFile(path.join(tempDir, "airch.yaml"), "existing", "utf-8");

    process.exitCode = 0;
    await executeInit({
      outDir: tempDir,
      preset: "clean-architecture",
      yes: true,
      force: false,
    });

    expect(process.exitCode).toBe(1);
    process.exitCode = 0; // リセット
  });

  it("--force オプションで既存の airch.yaml を上書きできる", async () => {
    await fs.writeFile(path.join(tempDir, "airch.yaml"), "existing", "utf-8");

    process.exitCode = 0;
    await executeInit({
      outDir: tempDir,
      preset: "clean-architecture",
      yes: true,
      force: true,
    });

    expect(process.exitCode).toBe(0);
    const content = await fs.readFile(path.join(tempDir, "airch.yaml"), "utf-8");
    expect(content).toContain("clean-architecture");
  });
});
