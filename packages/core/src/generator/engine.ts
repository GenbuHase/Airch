import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AirchManifest } from "../schema/manifest.js";
import type { GeneratedFile, GeneratorTarget, TargetDiff } from "./types.js";
import { ALL_TARGETS } from "./types.js";
import { generateAgentsMd } from "./targets/agents.js";
import { generateCursorRules } from "./targets/cursor.js";
import { generateCopilotInstructions } from "./targets/copilot.js";
import { generateClaudeMd } from "./targets/claude.js";

/**
 * ターゲットごとのジェネレーター関数のマップ
 */
const GENERATORS: Record<GeneratorTarget, (manifest: AirchManifest) => GeneratedFile> = {
  agents: generateAgentsMd,
  cursor: generateCursorRules,
  copilot: generateCopilotInstructions,
  claude: generateClaudeMd,
};

/**
 * AI コンテキストファイルの決定論的生成エンジン
 */
export class GeneratorEngine {
  private readonly outDir: string;

  constructor(outDir: string = process.cwd()) {
    this.outDir = path.resolve(outDir);
  }

  /**
   * 指定ターゲットのファイルをインメモリで生成（純粋関数的レンダリング）
   */
  public render(manifest: AirchManifest, targets: GeneratorTarget[] = ALL_TARGETS): GeneratedFile[] {
    const targetSet = new Set(targets);
    const results: GeneratedFile[] = [];

    // 出力順序を決定論的に固定するため ALL_TARGETS の順序で処理
    for (const target of ALL_TARGETS) {
      if (targetSet.has(target)) {
        const generator = GENERATORS[target];
        results.push(generator(manifest));
      }
    }

    return results;
  }

  /**
   * 生成結果をファイルシステムに書き出す
   */
  public async write(
    manifest: AirchManifest,
    targets: GeneratorTarget[] = ALL_TARGETS,
    customOutDir?: string
  ): Promise<GeneratedFile[]> {
    const baseDir = customOutDir ? path.resolve(customOutDir) : this.outDir;
    const generatedFiles = this.render(manifest, targets);

    for (const file of generatedFiles) {
      const targetPath = path.resolve(baseDir, file.relativePath);
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(targetPath, file.content, "utf-8");
    }

    return generatedFiles;
  }

  /**
   * 既存ファイルと期待される生成内容の同期状態を検証する (--check 用)
   */
  public async diff(
    manifest: AirchManifest,
    targets: GeneratorTarget[] = ALL_TARGETS,
    customOutDir?: string
  ): Promise<{ isSynced: boolean; diffs: TargetDiff[] }> {
    const baseDir = customOutDir ? path.resolve(customOutDir) : this.outDir;
    const generatedFiles = this.render(manifest, targets);
    const diffs: TargetDiff[] = [];
    let isSynced = true;

    for (const file of generatedFiles) {
      const targetPath = path.resolve(baseDir, file.relativePath);
      let exists = false;
      let actualContent: string | undefined;

      try {
        actualContent = await fs.readFile(targetPath, "utf-8");
        exists = true;
      } catch {
        exists = false;
      }

      // 改行コード差分等を考慮して正規化比較
      const normalizedActual = actualContent ? actualContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : undefined;
      const normalizedExpected = file.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const matched = exists && normalizedActual === normalizedExpected;

      if (!matched) {
        isSynced = false;
      }

      diffs.push({
        target: file.target,
        relativePath: file.relativePath,
        exists,
        isSynced: matched,
        actualContent,
        expectedContent: file.content,
      });
    }

    return { isSynced, diffs };
  }
}
