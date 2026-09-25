import * as path from "node:path";
import pc from "picocolors";
import {
  ManifestLoader,
  GeneratorEngine,
  ALL_TARGETS,
  type GeneratorTarget,
} from "@airch/core";
import { logger } from "../utils/logger.js";

export interface GenerateCommandOptions {
  target?: string[];
  outDir?: string;
  dryRun?: boolean;
  check?: boolean;
  config?: string;
}

/**
 * 渡されたターゲット文字列配列を正規の GeneratorTarget 配列に変換する
 */
function resolveTargets(targetInput?: string[]): GeneratorTarget[] {
  if (!targetInput || targetInput.length === 0 || targetInput.includes("all")) {
    return ALL_TARGETS;
  }

  const validTargets = new Set<string>(ALL_TARGETS);
  const resolved: GeneratorTarget[] = [];

  for (const t of targetInput) {
    const normalized = t.toLowerCase().trim();
    if (validTargets.has(normalized)) {
      resolved.push(normalized as GeneratorTarget);
    } else {
      logger.warn(`未知のターゲット '${t}' はスキップされました。利用可能: ${ALL_TARGETS.join(", ")}, all`);
    }
  }

  return resolved.length > 0 ? resolved : ALL_TARGETS;
}

/**
 * generate コマンドハンドラー
 */
export async function executeGenerate(options: GenerateCommandOptions): Promise<void> {
  const startTime = performance.now();

  // 1. マニフェスト読み込み
  const loader = new ManifestLoader();
  logger.debug(`Loading configuration...`);
  const { manifest, configPath } = await loader.load(options.config);
  logger.success(`Loaded ${pc.bold(path.basename(configPath))} (version ${manifest.version})`);

  // 2. ターゲットの決定
  const targets = resolveTargets(options.target);
  const outDir = options.outDir || process.cwd();
  const engine = new GeneratorEngine(outDir);

  // 3. --check モードの処理 (CI用)
  if (options.check) {
    logger.info(`🔍 Checking AI context files sync with ${pc.cyan(path.basename(configPath))}...`);
    const { isSynced, diffs } = await engine.diff(manifest, targets, outDir);

    let hasErrors = false;
    for (const diff of diffs) {
      if (!diff.exists) {
        logger.error(`Missing file: ${diff.relativePath} does not exist.`);
        hasErrors = true;
      } else if (!diff.isSynced) {
        logger.error(`Out of sync: ${diff.relativePath} does not match airch.yaml definition.`);
        hasErrors = true;
      } else {
        logger.success(`Synced: ${diff.relativePath}`);
      }
    }

    if (hasErrors || !isSynced) {
      logger.error("\nAI rule files are NOT in sync with the architecture manifest!");
      logger.info(`Run ${pc.cyan("airch generate")} to update and sync the rule files.`);
      process.exitCode = 1;
      return;
    }

    const elapsed = Math.round(performance.now() - startTime);
    logger.info(`\n${pc.green("✨ All AI rules are perfectly synced.")} (${elapsed}ms)`);
    return;
  }

  // 4. --dry-run モードの処理
  if (options.dryRun) {
    logger.info(`${pc.yellow("[DRY-RUN]")} Generating AI rule files in memory...\n`);
    const files = engine.render(manifest, targets);

    for (const file of files) {
      logger.info(pc.bold(pc.cyan(`--- [${file.relativePath}] (${file.target}) ---`)));
      logger.raw(file.content);
      logger.info(pc.cyan(`--- End of ${file.relativePath} ---\n`));
    }

    logger.info(`${pc.yellow("[DRY-RUN]")} Completed. No files were written to disk.`);
    return;
  }

  // 5. 通常書き込みモード
  const files = await engine.write(manifest, targets, outDir);
  for (const file of files) {
    const lineCount = file.content.split("\n").length;
    logger.success(`Generated ${pc.bold(file.relativePath)} (${lineCount} lines)`);
  }

  const elapsed = Math.round(performance.now() - startTime);
  logger.info(`\n${pc.green("✨ All AI rules generated successfully")} in ${elapsed}ms.`);
}
