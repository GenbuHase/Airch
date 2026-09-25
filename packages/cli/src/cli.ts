import { Command } from "commander";
import pc from "picocolors";
import { AirchConfigError } from "@airch/core";
import { executeGenerate, type GenerateCommandOptions } from "./commands/generate.js";
import { logger } from "./utils/logger.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("airch")
    .description("Architectural manifest & AI context generator for AI-driven development")
    .version("0.1.0", "-v, --version", "バージョン情報を表示")
    .option("-c, --config <path>", "マニフェストファイルのパスを指定 (デフォルト: airch.yaml)")
    .option("--verbose", "詳細なデバッグログを出力")
    .option("--silent", "エラー以外の出力を抑制")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      logger.setOptions({
        silent: opts["silent"],
        verbose: opts["verbose"],
      });
    });

  // generate コマンド
  program
    .command("generate")
    .description("マニフェストから各種AIツール向けルールファイルを生成")
    .option(
      "-t, --target <types...>",
      "出力対象ターゲット (all, agents, cursor, copilot, claude)",
      ["all"]
    )
    .option("-o, --out-dir <path>", "ルールファイルの出力先基準ディレクトリ")
    .option("--dry-run", "実際のファイル書き込みを行わず、生成内容を標準出力に表示")
    .option("--check", "既存の生成ファイルがマニフェストと同期しているか検証 (CI用)")
    .action(async (cmdOptions: Omit<GenerateCommandOptions, "config">) => {
      const globalOpts = program.opts<{ config?: string }>();
      const options: GenerateCommandOptions = {
        ...cmdOptions,
        config: globalOpts.config,
      };

      try {
        await executeGenerate(options);
      } catch (err) {
        handleCliError(err);
      }
    });

  // 未実装コマンドのプレースホルダー（親切な案内）
  program
    .command("init")
    .description("プロジェクトの初期化ウィザードを実行し airch.yaml を生成 (Phase 3予定)")
    .action(() => {
      logger.info(pc.yellow("'airch init' は現在開発中です (Phase 3予定)。"));
      logger.info("現在は 'airch.example.yaml' をコピーして 'airch.yaml' としてご利用いただけます。");
    });

  program
    .command("check")
    .description("プロジェクト構造とインポート境界を検証 (Phase 2予定)")
    .action(() => {
      logger.info(pc.yellow("'airch check' は現在開発中です (Phase 2予定)。"));
    });

  program
    .command("ui")
    .alias("studio")
    .description("ローカルWebダッシュボード (airch ui) を起動 (Phase 4予定)")
    .action(() => {
      logger.info(pc.yellow("'airch ui' は現在開発中です (Phase 4予定)。"));
    });

  return program;
}

/**
 * CLI 実行時エラーの統一ハンドリング
 */
export function handleCliError(err: unknown): void {
  if (err instanceof AirchConfigError) {
    logger.error(err.format());
    process.exit(2);
  }

  if (err instanceof Error) {
    logger.error(`予期しないエラーが発生しました: ${err.message}`);
    if (process.env["DEBUG"] || process.argv.includes("--verbose")) {
      console.error(err.stack);
    }
    process.exit(3);
  }

  logger.error(`不明な例外が発生しました: ${String(err)}`);
  process.exit(3);
}
