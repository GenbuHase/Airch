import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectProject,
  getPreset,
  stringifyManifest,
  PRESET_NAMES,
  type PresetName,
  GeneratorEngine,
  ALL_TARGETS,
  type GeneratorTarget,
} from "@genbuhase/airch-core";
import { logger } from "../utils/logger.js";

export interface InitCommandOptions {
  preset?: string;
  yes?: boolean;
  force?: boolean;
  outDir?: string;
}

export async function executeInit(options: InitCommandOptions): Promise<void> {
  const cwd = options.outDir || process.cwd();
  const manifestPath = path.join(cwd, "airch.yaml");

  // 1. 既存ファイルのチェック
  let fileExists = false;
  try {
    await fs.stat(manifestPath);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  if (fileExists && !options.force) {
    logger.error(`'${manifestPath}' は既に存在します。上書きする場合は '--force' を指定してください。`);
    process.exitCode = 1;
    return;
  }

  // 2. プロジェクトの自動推測
  const detected = await detectProject(cwd);

  let projectName = detected.suggestedName;
  let architecture: PresetName = detected.suggestedArchitecture;
  let rootDir = detected.suggestedRoot;
  let selectedTargets: GeneratorTarget[] = [...ALL_TARGETS];

  // 3. 非対話モード (--yes または CI / 非TTY)
  const isInteractive = Boolean(process.stdout.isTTY) && !options.yes;

  if (options.preset) {
    const matchedPreset = PRESET_NAMES.find(
      (p) => p.toLowerCase() === options.preset?.toLowerCase()
    );
    if (!matchedPreset) {
      logger.error(`無効なプリセット '${options.preset}' です。利用可能: ${PRESET_NAMES.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    architecture = matchedPreset;
  }

  if (isInteractive && !options.preset) {
    p.intro(pc.bold(pc.cyan("◆  airch - Architecture as Code Setup")));

    // プロジェクト名入力
    const nameInput = await p.text({
      message: "プロジェクト名を入力してください",
      placeholder: detected.suggestedName,
      defaultValue: detected.suggestedName,
    });
    if (p.isCancel(nameInput)) {
      p.cancel("セットアップを中止しました。");
      return;
    }
    projectName = String(nameInput).trim() || detected.suggestedName;

    // アーキテクチャ選択
    const archSelect = await p.select({
      message: "アーキテクチャパターンを選択してください",
      initialValue: detected.suggestedArchitecture,
      options: [
        {
          value: "feature-sliced",
          label: "Feature-Sliced Design",
          hint: "推奨: Next.js / フロントエンド",
        },
        {
          value: "clean-architecture",
          label: "Clean Architecture",
          hint: "推奨: バックエンド / ドメイン駆動設計",
        },
        {
          value: "layered",
          label: "Layered MVC",
          hint: "軽量な三層構造 (Controller/Service/Repo)",
        },
      ],
    });
    if (p.isCancel(archSelect)) {
      p.cancel("セットアップを中止しました。");
      return;
    }
    architecture = archSelect as PresetName;

    // ソースコードルート
    const rootInput = await p.text({
      message: "ソースコードのルートディレクトリを指定してください",
      placeholder: detected.suggestedRoot,
      defaultValue: detected.suggestedRoot,
    });
    if (p.isCancel(rootInput)) {
      p.cancel("セットアップを中止しました。");
      return;
    }
    rootDir = String(rootInput).trim() || detected.suggestedRoot;

    // AIターゲット選択
    const targetSelect = await p.multiselect({
      message: "生成するAIルールファイルを選択してください",
      options: [
        { value: "agents", label: "AGENTS.md", hint: "マルチエージェント共通規格" },
        { value: "cursor", label: ".cursorrules", hint: "Cursor IDE" },
        { value: "copilot", label: ".github/copilot-instructions.md", hint: "GitHub Copilot" },
        { value: "claude", label: "CLAUDE.md", hint: "Claude Code CLI" },
      ],
      initialValues: ["agents", "cursor", "copilot"],
    });
    if (p.isCancel(targetSelect)) {
      p.cancel("セットアップを中止しました。");
      return;
    }
    selectedTargets = targetSelect as GeneratorTarget[];
  }

  // 4. マニフェストオブジェクトの生成と書き込み
  const manifest = getPreset(architecture, projectName, rootDir);
  const fullYamlContent = stringifyManifest(manifest);
  await fs.writeFile(manifestPath, fullYamlContent, "utf-8");

  // 5. ルールファイルの自動生成
  const engine = new GeneratorEngine(cwd);
  const writtenFiles = await engine.write(manifest, selectedTargets, cwd);

  if (isInteractive) {
    p.note(
      `マニフェスト: ${pc.cyan("airch.yaml")}\nルールファイル: ${writtenFiles.map((f) => f.relativePath).join(", ")}`,
      "生成完了"
    );
    p.outro(pc.green("✔ airch.yaml と初期AIルールファイルを正常に作成しました！"));
  } else {
    logger.success(`Created ${pc.bold("airch.yaml")} using preset '${architecture}'`);
    for (const file of writtenFiles) {
      logger.success(`Generated ${pc.bold(file.relativePath)}`);
    }
    logger.info(pc.green("✨ Project setup completed successfully."));
  }
}
