import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { ZodError } from "zod";
import { ManifestSchema, type AirchManifest, type StructureRule } from "../schema/manifest.js";
import { AirchConfigError } from "./errors.js";

/**
 * 探索する設定ファイル名の候補リスト（探索順）
 */
const DEFAULT_CONFIG_FILES = [
  "airch.yaml",
  "airch.yml",
  path.join(".airch", "airch.yaml"),
  path.join(".airch", "airch.yml"),
];

/**
 * オブジェクトかどうかを判定するヘルパー
 */
function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * ディープマージ関数（親設定に子設定を上書き）
 */
function deepMerge<T extends Record<string, unknown>>(parent: T, child: Partial<T>): T {
  const result: Record<string, unknown> = { ...parent };

  for (const [key, childVal] of Object.entries(child)) {
    if (childVal === undefined) continue;

    const parentVal = result[key];
    if (isRecord(parentVal) && isRecord(childVal)) {
      result[key] = deepMerge(parentVal, childVal);
    } else {
      result[key] = childVal;
    }
  }

  return result as T;
}

/**
 * structure ルールリストのマージ
 * - 同一の `path` を持つルールはマージし、新しいルールは末尾に追加する
 */
function mergeStructureRules(parentRules: StructureRule[], childRules: StructureRule[]): StructureRule[] {
  const merged: StructureRule[] = [];
  const parentMap = new Map<string, StructureRule>();

  for (const rule of parentRules) {
    parentMap.set(rule.path, rule);
  }

  const seenPaths = new Set<string>();

  for (const childRule of childRules) {
    seenPaths.add(childRule.path);
    const parentRule = parentMap.get(childRule.path);
    if (parentRule) {
      // 同一 path の場合、配列系は重複排除して結合、単一プロパティは子で上書き
      merged.push({
        ...parentRule,
        ...childRule,
        allowed_imports: Array.from(new Set([...parentRule.allowed_imports, ...childRule.allowed_imports])),
        forbidden_imports: Array.from(new Set([...parentRule.forbidden_imports, ...childRule.forbidden_imports])),
        required_files: Array.from(new Set([...parentRule.required_files, ...childRule.required_files])),
        disallowed_files: Array.from(new Set([...parentRule.disallowed_files, ...childRule.disallowed_files])),
        tags: Array.from(new Set([...parentRule.tags, ...childRule.tags])),
      });
    } else {
      merged.push(childRule);
    }
  }

  // 親にのみ存在するルールも追加
  for (const parentRule of parentRules) {
    if (!seenPaths.has(parentRule.path)) {
      merged.push(parentRule);
    }
  }

  return merged;
}

/**
 * マニフェストオブジェクトの生データをマージする
 */
function mergeRawManifests(parent: Record<string, unknown>, child: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...parent, ...child };

  if (isRecord(parent["project"]) && isRecord(child["project"])) {
    merged["project"] = { ...parent["project"], ...child["project"] };
  }

  if (Array.isArray(parent["structure"]) && Array.isArray(child["structure"])) {
    merged["structure"] = mergeStructureRules(
      parent["structure"] as StructureRule[],
      child["structure"] as StructureRule[]
    );
  }

  if (isRecord(parent["conventions"]) && isRecord(child["conventions"])) {
    merged["conventions"] = deepMerge(parent["conventions"], child["conventions"]);
    // conventions.rules (文字列配列) の結合
    const parentRules = Array.isArray(parent["conventions"]["rules"]) ? parent["conventions"]["rules"] : [];
    const childRules = Array.isArray(child["conventions"]["rules"]) ? child["conventions"]["rules"] : [];
    (merged["conventions"] as Record<string, unknown>)["rules"] = Array.from(new Set([...parentRules, ...childRules]));
  }

  if (isRecord(parent["commands"]) && isRecord(child["commands"])) {
    merged["commands"] = { ...parent["commands"], ...child["commands"] };
  }

  return merged;
}

/**
 * airch マニフェストファイルの探索・読み込み・検証クラス
 */
export class ManifestLoader {
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = path.resolve(cwd);
  }

  /**
   * 設定ファイルのパスを探索する
   */
  public async findConfigFile(customPath?: string): Promise<string> {
    if (customPath) {
      const resolved = path.isAbsolute(customPath) ? customPath : path.resolve(this.cwd, customPath);
      try {
        const stat = await fs.stat(resolved);
        if (stat.isFile()) {
          return resolved;
        }
        throw new AirchConfigError(`指定されたパスはファイルではありません: ${customPath}`, resolved);
      } catch (err) {
        if (err instanceof AirchConfigError) throw err;
        throw new AirchConfigError(`指定された設定ファイルが見つかりません: ${customPath}`, resolved);
      }
    }

    for (const relativePath of DEFAULT_CONFIG_FILES) {
      const candidate = path.resolve(this.cwd, relativePath);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          return candidate;
        }
      } catch {
        // 次の候補を探索
      }
    }

    throw new AirchConfigError(
      `設定ファイルが見つかりません。探索パス: ${DEFAULT_CONFIG_FILES.join(", ")}\n'airch init' を実行して新規作成してください。`,
      this.cwd
    );
  }

  /**
   * マニフェストを探索・ロード・検証する
   */
  public async load(customPath?: string): Promise<{ manifest: AirchManifest; configPath: string }> {
    const configPath = await this.findConfigFile(customPath);
    const rawData = await this.loadRawWithExtends(configPath, new Set<string>());

    try {
      const manifest = ManifestSchema.parse(rawData);
      return { manifest, configPath };
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => {
          const pathStr = e.path.join(".") || "(root)";
          return `[${pathStr}]: ${e.message}`;
        });
        throw new AirchConfigError(
          `マニフェストファイルのスキーマ検証に失敗しました (${details.length}件のエラー)`,
          configPath,
          details
        );
      }
      throw err;
    }
  }

  /**
   * 単一のYAMLファイルを読み込んでオブジェクトに変換
   */
  private async readYamlFile(filePath: string): Promise<Record<string, unknown>> {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (err) {
      throw new AirchConfigError(
        `設定ファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        filePath
      );
    }

    try {
      const parsed = yaml.load(content);
      if (!isRecord(parsed)) {
        throw new AirchConfigError(
          "マニフェストファイルの内容が有効なYAMLオブジェクトではありません",
          filePath
        );
      }
      return parsed;
    } catch (err) {
      if (err instanceof AirchConfigError) throw err;
      throw new AirchConfigError(
        `YAML構文の解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        filePath
      );
    }
  }

  /**
   * extends を再帰的に解決しながら生データをロードする
   */
  private async loadRawWithExtends(
    filePath: string,
    visitedPaths: Set<string>
  ): Promise<Record<string, unknown>> {
    const normalizedPath = path.normalize(filePath);
    if (visitedPaths.has(normalizedPath)) {
      throw new AirchConfigError(
        `設定の循環継承（循環参照）が検出されました: ${normalizedPath}`,
        normalizedPath
      );
    }
    visitedPaths.add(normalizedPath);

    const currentData = await this.readYamlFile(normalizedPath);
    const extendsField = currentData["extends"];

    if (!extendsField) {
      return currentData;
    }

    const extendPaths: string[] = Array.isArray(extendsField)
      ? extendsField.map(String)
      : [String(extendsField)];

    let accumulatedParent: Record<string, unknown> = {};

    for (const extendPath of extendPaths) {
      const baseDir = path.dirname(normalizedPath);
      const resolvedExtendPath = path.isAbsolute(extendPath)
        ? extendPath
        : path.resolve(baseDir, extendPath);

      const parentData = await this.loadRawWithExtends(resolvedExtendPath, new Set(visitedPaths));
      accumulatedParent = mergeRawManifests(accumulatedParent, parentData);
    }

    return mergeRawManifests(accumulatedParent, currentData);
  }
}
