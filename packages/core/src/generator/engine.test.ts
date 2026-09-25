import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { GeneratorEngine } from "./engine.js";
import type { AirchManifest } from "../schema/manifest.js";

describe("GeneratorEngine", () => {
  let tempDir: string;

  const sampleManifest: AirchManifest = {
    version: "1.0",
    project: {
      name: "sample-app",
      architecture: "feature-sliced",
      description: "Sample Description",
      root: "./src",
    },
    structure: [
      {
        path: "src/widgets/*",
        allowed_imports: ["src/features/*", "src/entities/*"],
        forbidden_imports: ["src/widgets/*"],
        naming_convention: "PascalCase",
        required_files: ["index.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: [],
      },
      {
        path: "src/features/*",
        allowed_imports: ["src/entities/*"],
        forbidden_imports: ["src/features/*"],
        naming_convention: "kebab-case",
        required_files: ["index.ts", "types.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: [],
      },
    ],
    conventions: {
      typescript: {
        strict: true,
        export_style: "named",
        type_import_style: "type-only",
      },
      rules: ["Rule 1", "Rule 2"],
    },
    commands: {
      test: { run: "pnpm test", description: "Run tests" },
      lint: { run: "pnpm lint", description: "Run lint" },
    },
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-generator-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("すべてのターゲット（agents, cursor, copilot, claude）を生成できる", () => {
    const engine = new GeneratorEngine(tempDir);
    const files = engine.render(sampleManifest);

    expect(files).toHaveLength(4);
    const targets = files.map((f) => f.target);
    expect(targets).toEqual(["agents", "cursor", "copilot", "claude"]);

    for (const file of files) {
      expect(file.content).toContain(sampleManifest.project.name);
      expect(file.content).toContain("src/features/*");
      expect(file.content).toContain("FORBIDDEN");
      expect(file.content.endsWith("\n")).toBe(true);
    }
  });

  it("決定論性: 同じマニフェストから生成されたファイルは完全に同一（バイト一致）である", () => {
    const engine = new GeneratorEngine(tempDir);
    const run1 = engine.render(sampleManifest);
    const run2 = engine.render(sampleManifest);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]?.content).toBe(run2[i]?.content);
    }
  });

  it("構造ルールの定義順序が異なっていても、パス順でソートされ出力が一致する", () => {
    const reversedManifest: AirchManifest = {
      ...sampleManifest,
      structure: [...sampleManifest.structure].reverse(),
    };

    const engine = new GeneratorEngine(tempDir);
    const normalOutput = engine.render(sampleManifest);
    const reversedOutput = engine.render(reversedManifest);

    for (let i = 0; i < normalOutput.length; i++) {
      expect(normalOutput[i]?.content).toBe(reversedOutput[i]?.content);
    }
  });

  it("write() でファイルシステムへ正常に書き込みができる", async () => {
    const engine = new GeneratorEngine(tempDir);
    const written = await engine.write(sampleManifest);

    expect(written).toHaveLength(4);
    for (const file of written) {
      const fullPath = path.join(tempDir, file.relativePath);
      const exists = await fs
        .stat(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const diskContent = await fs.readFile(fullPath, "utf-8");
      expect(diskContent).toBe(file.content);
    }
  });

  it("diff() で同期状態・非同期状態・未存在を正確に検出できる", async () => {
    const engine = new GeneratorEngine(tempDir);

    // 1. ファイル未作成の状態 -> isSynced: false
    const initialDiff = await engine.diff(sampleManifest);
    expect(initialDiff.isSynced).toBe(false);
    expect(initialDiff.diffs.every((d) => !d.exists)).toBe(true);

    // 2. 書き込み後 -> isSynced: true
    await engine.write(sampleManifest);
    const syncedDiff = await engine.diff(sampleManifest);
    expect(syncedDiff.isSynced).toBe(true);
    expect(syncedDiff.diffs.every((d) => d.isSynced)).toBe(true);

    // 3. 1つのファイルを改ざん -> isSynced: false
    const targetFile = path.join(tempDir, "AGENTS.md");
    await fs.writeFile(targetFile, "tampered content", "utf-8");
    const tamperedDiff = await engine.diff(sampleManifest);
    expect(tamperedDiff.isSynced).toBe(false);
    const agentsDiff = tamperedDiff.diffs.find((d) => d.target === "agents");
    expect(agentsDiff?.isSynced).toBe(false);
    expect(agentsDiff?.actualContent).toBe("tampered content");
  });
});
