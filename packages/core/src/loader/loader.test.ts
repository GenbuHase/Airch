import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ManifestLoader } from "./loader.js";
import { AirchConfigError } from "./errors.js";

describe("ManifestLoader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-loader-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("airch.yaml を自動検出して正しくロードできる", async () => {
    const yamlContent = `
version: "1.0"
project:
  name: "auto-detect-app"
  architecture: "feature-sliced"
structure:
  - path: "src/features/*"
`;
    await fs.writeFile(path.join(tempDir, "airch.yaml"), yamlContent, "utf-8");

    const loader = new ManifestLoader(tempDir);
    const { manifest, configPath } = await loader.load();

    expect(manifest.project.name).toBe("auto-detect-app");
    expect(configPath).toBe(path.resolve(tempDir, "airch.yaml"));
  });

  it("設定ファイルが存在しない場合は AirchConfigError がスローされる", async () => {
    const loader = new ManifestLoader(tempDir);
    await expect(loader.load()).rejects.toThrow(AirchConfigError);
  });

  it("スキーマ不正な設定ファイルの場合は詳細エラー付きでスローされる", async () => {
    const invalidYaml = `
version: "99.0"
project:
  name: ""
structure: []
`;
    await fs.writeFile(path.join(tempDir, "airch.yaml"), invalidYaml, "utf-8");

    const loader = new ManifestLoader(tempDir);
    try {
      await loader.load();
      expect.fail("エラーが発生するべきです");
    } catch (err) {
      expect(err).toBeInstanceOf(AirchConfigError);
      const configErr = err as AirchConfigError;
      expect(configErr.details).toBeDefined();
      expect(configErr.details!.length).toBeGreaterThan(0);
      expect(configErr.format()).toContain("[airch] 設定エラー");
    }
  });

  it("extends による設定継承・マージが正しく機能する", async () => {
    const parentYaml = `
version: "1.0"
project:
  name: "base-project"
  architecture: "layered"
structure:
  - path: "src/shared/*"
    allowed_imports: ["src/lib"]
conventions:
  rules:
    - "Base Rule"
commands:
  build:
    run: "pnpm build"
`;
    const childYaml = `
version: "1.0"
extends: "./base.yaml"
project:
  name: "child-project"
structure:
  - path: "src/features/*"
conventions:
  rules:
    - "Child Rule"
commands:
  test:
    run: "pnpm test"
`;
    await fs.writeFile(path.join(tempDir, "base.yaml"), parentYaml, "utf-8");
    await fs.writeFile(path.join(tempDir, "airch.yaml"), childYaml, "utf-8");

    const loader = new ManifestLoader(tempDir);
    const { manifest } = await loader.load();

    expect(manifest.project.name).toBe("child-project");
    expect(manifest.project.architecture).toBe("layered"); // 親から継承
    expect(manifest.structure).toHaveLength(2); // shared と features の両方
    expect(manifest.conventions?.rules).toEqual(["Base Rule", "Child Rule"]); // ルールの結合
    expect(manifest.commands?.build?.run).toBe("pnpm build"); // 親のコマンド
    expect(manifest.commands?.test?.run).toBe("pnpm test"); // 子のコマンド
  });

  it("設定の循環参照を検知してエラーをスローする", async () => {
    const aYaml = `
version: "1.0"
extends: "./b.yaml"
project: { name: "a", architecture: "x" }
structure: [{ path: "src/*" }]
`;
    const bYaml = `
version: "1.0"
extends: "./a.yaml"
project: { name: "b", architecture: "x" }
structure: [{ path: "src/*" }]
`;
    await fs.writeFile(path.join(tempDir, "a.yaml"), aYaml, "utf-8");
    await fs.writeFile(path.join(tempDir, "b.yaml"), bYaml, "utf-8");

    const loader = new ManifestLoader(tempDir);
    await expect(loader.load("a.yaml")).rejects.toThrow("循環継承");
  });
});
