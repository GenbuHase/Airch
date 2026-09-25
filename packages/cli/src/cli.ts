import { Command } from "commander";
import { AirchConfigError } from "@airch/core";
import { executeGenerate, type GenerateCommandOptions } from "./commands/generate.js";
import { executeCheck, type CheckCommandOptions } from "./commands/check.js";
import { executeInit, type InitCommandOptions } from "./commands/init.js";
import { executeUi, type UiCommandOptions } from "./commands/ui.js";
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

  // init コマンド
  program
    .command("init")
    .description("プロジェクトの初期化ウィザードを実行し airch.yaml を生成")
    .option("-p, --preset <name>", "アーキテクチャプリセットを指定 (feature-sliced, clean-architecture, layered)")
    .option("-y, --yes", "対話プロンプトをスキップしデフォルト値で自動生成")
    .option("-f, --force", "既存の airch.yaml が存在する場合に上書き")
    .option("-o, --out-dir <path>", "生成先ディレクトリ (デフォルト: カレントディレクトリ)")
    .action(async (cmdOptions: InitCommandOptions) => {
      try {
        await executeInit(cmdOptions);
      } catch (err) {
        handleCliError(err);
      }
    });

  // check コマンド
  program
    .command("check")
    .description("プロジェクト構造とインポート境界を検証 (Linter)")
    .option("-s, --strict", "警告 (Warning) もエラーとして扱い、終了コード 1 を返却")
    .option("--fix", "自動修正可能な項目（命名違反リネーム、必須ファイル生成）を自動実行")
    .option(
      "-f, --format <type>",
      "出力フォーマット (pretty, json, github, sarif)",
      "pretty"
    )
    .option("--changed-only", "Git 差分ファイルのみを対象に高速検証")
    .option("--base <git-ref>", "Git 差分比較の対象参照 (デフォルト: HEAD)", "HEAD")
    .action(async (cmdOptions: Omit<CheckCommandOptions, "config">) => {
      const globalOpts = program.opts<{ config?: string }>();
      const options: CheckCommandOptions = {
        ...cmdOptions,
        config: globalOpts.config,
      };

      try {
        await executeCheck(options);
      } catch (err) {
        handleCliError(err);
      }
    });

  // ui コマンド
  program
    .command("ui")
    .alias("studio")
    .description("ローカルWebダッシュボード (airch ui) を起動")
    .option("-p, --port <number>", "サーバーポート番号", "4567")
    .option("--host <string>", "リッスンするホストアドレス", "localhost")
    .option("--no-open", "ブラウザの自動起動を無効化")
    .option("--readonly", "閲覧専用モード (変更・保存APIを無効化)")
    .action(async (cmdOptions: Omit<UiCommandOptions, "config">) => {
      const globalOpts = program.opts<{ config?: string }>();
      const options: UiCommandOptions = {
        ...cmdOptions,
        config: globalOpts.config,
      };

      try {
        await executeUi(options);
      } catch (err) {
        handleCliError(err);
      }
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
