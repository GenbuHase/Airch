import * as fs from "node:fs/promises";
import * as path from "node:path";
import yaml from "js-yaml";
import type { AirchManifest } from "../schema/manifest.js";
import { createFeatureSlicedPreset } from "./feature-sliced.js";
import { createCleanArchitecturePreset } from "./clean-architecture.js";
import { createLayeredPreset } from "./layered.js";

const SCHEMA_HEADER = `# yaml-language-server: $schema=https://unpkg.com/@genbuhase/airch/schema/v1.json\n`;

/**
 * マニフェストオブジェクトを YAML 文字列にシリアライズする
 */
export function stringifyManifest(manifest: AirchManifest): string {
  const yamlString = yaml.dump(manifest, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  return SCHEMA_HEADER + yamlString;
}

export const PRESET_NAMES = ["feature-sliced", "clean-architecture", "layered"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export interface ProjectDetectionResult {
  suggestedName: string;
  suggestedArchitecture: PresetName;
  suggestedRoot: string;
  detectedFramework?: string;
}

/**
 * プリセット名からマニフェストオブジェクトを生成する
 */
export function getPreset(name: string, projectName: string = "my-app", rootDir: string = "src"): AirchManifest {
  switch (name.toLowerCase()) {
    case "feature-sliced":
    case "fsd":
      return createFeatureSlicedPreset(projectName, rootDir);
    case "clean-architecture":
    case "clean":
      return createCleanArchitecturePreset(projectName, rootDir);
    case "layered":
    case "mvc":
    default:
      return createLayeredPreset(projectName, rootDir);
  }
}

/**
 * プロジェクト環境（package.json / ディレクトリ構造）から推奨設定を自動推測する
 */
export async function detectProject(cwd: string = process.cwd()): Promise<ProjectDetectionResult> {
  let suggestedName = path.basename(cwd);
  let suggestedArchitecture: PresetName = "feature-sliced";
  let detectedFramework: string | undefined;

  // 1. package.json の解析
  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);

    if (pkg.name && typeof pkg.name === "string") {
      // @org/name の場合は name 部分を抽出するかそのまま使用
      suggestedName = pkg.name.startsWith("@") ? pkg.name.split("/")[1] || pkg.name : pkg.name;
    }

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    if ("next" in allDeps) {
      suggestedArchitecture = "feature-sliced";
      detectedFramework = "Next.js";
    } else if ("@nestjs/core" in allDeps) {
      suggestedArchitecture = "clean-architecture";
      detectedFramework = "NestJS";
    } else if ("react" in allDeps || "vue" in allDeps || "svelte" in allDeps) {
      suggestedArchitecture = "feature-sliced";
      detectedFramework = "React/Frontend";
    } else if ("fastify" in allDeps || "express" in allDeps) {
      suggestedArchitecture = "clean-architecture";
      detectedFramework = "Node.js Server";
    }
  } catch {
    // package.json がない場合はデフォルト値
  }

  // 2. ソースルートディレクトリの推測 (src ディレクトリの有無)
  let suggestedRoot = ".";
  try {
    const srcStat = await fs.stat(path.join(cwd, "src"));
    if (srcStat.isDirectory()) {
      suggestedRoot = "src";
    }
  } catch {
    suggestedRoot = ".";
  }

  return {
    suggestedName,
    suggestedArchitecture,
    suggestedRoot,
    detectedFramework,
  };
}
