import * as path from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";
import { ManifestLoader, StructureLinter } from "@airch/core";
import { renderLintReport, type ReporterFormat } from "../reporters/index.js";
import { logger } from "../utils/logger.js";

export interface CheckCommandOptions {
  strict?: boolean;
  fix?: boolean;
  format?: ReporterFormat;
  changedOnly?: boolean;
  base?: string;
  config?: string;
}

/**
 * Git から変更されたファイル一覧を取得する
 */
function getChangedFiles(baseRef: string = "HEAD"): string[] | null {
  try {
    // ステージング済み + 未ステージングの変更ファイル
    const statusOutput = execSync("git status --porcelain", { encoding: "utf-8" });
    const changed = new Set<string>();

    for (const line of statusOutput.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // " M path/to/file" または "??"
      const filePath = trimmed.slice(3).trim();
      changed.add(filePath);
    }

    // baseRef との差分
    try {
      const diffOutput = execSync(`git diff --name-only ${baseRef}`, { encoding: "utf-8" });
      for (const line of diffOutput.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) changed.add(trimmed);
      }
    } catch {
      // baseRef が存在しない場合は status のみ
    }

    return Array.from(changed);
  } catch {
    return null; // Git 管理外の場合は null
  }
}

/**
 * check コマンドハンドラー
 */
export async function executeCheck(options: CheckCommandOptions): Promise<void> {
  // 1. マニフェスト読み込み
  const loader = new ManifestLoader();
  const { manifest, configPath } = await loader.load(options.config);

  const format = options.format || "pretty";
  if (format === "pretty") {
    logger.info(`🔍 Scanning project architecture based on ${pc.cyan(path.basename(configPath))}...`);
  }

  // 2. 対象ファイル（--changed-only の場合）
  let targetFiles: string[] | undefined;
  if (options.changedOnly) {
    const changed = getChangedFiles(options.base);
    if (changed && changed.length > 0) {
      targetFiles = changed;
      if (format === "pretty") {
        logger.info(pc.gray(`ℹ Git changed files mode enabled (${targetFiles.length} files to check).`));
      }
    } else if (changed && changed.length === 0) {
      if (format === "pretty") {
        logger.info(pc.green("✔ No changed files detected by Git. Architecture check passed."));
      }
      return;
    }
  }

  // 3. StructureLinter 実行
  const projectRoot = path.dirname(configPath);
  const linter = new StructureLinter(projectRoot);
  const result = await linter.lint(manifest, {
    strict: options.strict,
    fix: options.fix,
    files: targetFiles,
  });

  // 4. レポート出力
  const reportOutput = renderLintReport(result, format);
  if (reportOutput) {
    logger.raw(reportOutput);
  }

  // 5. 終了コードの設定
  if (!result.success) {
    process.exitCode = 1;
  }
}
