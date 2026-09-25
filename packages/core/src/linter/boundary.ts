import { minimatch } from "minimatch";
import type { StructureRule } from "../schema/manifest.js";
import type { LintDiagnostic } from "./types.js";
import type { ExtractedImport } from "./ast-analyzer.js";
import type { ResolvedImport } from "./path-resolver.js";

/**
 * ルールパス（Glob）とファイルパスを照合し、モジュールのルートディレクトリを特定する
 * 例: rule.path = "src/features/*"
 *     filePath = "src/features/cart/ui/button.tsx"
 *     -> sliceDir = "src/features/cart"
 */
export function getSliceDirectory(rulePath: string, filePath: string): string | null {
  const normRule = rulePath.replace(/\\/g, "/");
  const normFile = filePath.replace(/\\/g, "/");

  const starIndex = normRule.indexOf("*");
  if (starIndex === -1) {
    // ワイルドカードがない固定パス（例: "src/components/ui"）
    if (normFile.startsWith(normRule)) {
      return normRule;
    }
    return null;
  }

  const prefix = normRule.slice(0, starIndex);
  if (!normFile.startsWith(prefix)) {
    return null;
  }

  const remainder = normFile.slice(prefix.length);
  const segments = remainder.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return prefix + segments[0];
}

/**
 * ファイルが指定された structure ルールに合致しているか判定する
 */
export function matchesRule(rulePath: string, filePath: string): boolean {
  const normRule = rulePath.replace(/\\/g, "/");
  const normFile = filePath.replace(/\\/g, "/");

  // 末尾が /* または /** の場合
  if (normRule.endsWith("/*")) {
    const prefix = normRule.slice(0, -1); // 末尾 * を除く
    return normFile.startsWith(prefix);
  }
  if (normRule.endsWith("/**")) {
    const prefix = normRule.slice(0, -2);
    return normFile.startsWith(prefix);
  }

  // 固定ディレクトリの場合
  if (normFile.startsWith(normRule + "/") || normFile === normRule) {
    return true;
  }

  // minimatch による汎用判定
  return minimatch(normFile, normRule, { dot: true });
}

/**
 * インポートパスが指定された Glob パターンに一致するか判定
 */
export function matchesPattern(targetPath: string, pattern: string): boolean {
  const normTarget = targetPath.replace(/\\/g, "/");
  const normPattern = pattern.replace(/\\/g, "/");

  // 末尾のワイルドカードの扱い
  if (normPattern.endsWith("/**")) {
    const prefix = normPattern.slice(0, -3);
    return normTarget === prefix || normTarget.startsWith(prefix + "/");
  }
  if (normPattern.endsWith("/*")) {
    const prefix = normPattern.slice(0, -2);
    if (!normTarget.startsWith(prefix + "/")) return false;
    // /* はプレフィックス直下のディレクトリまたはファイル
    return true;
  }

  if (normTarget === normPattern || normTarget.startsWith(normPattern + "/")) {
    return true;
  }

  return minimatch(normTarget, normPattern, { dot: true });
}

/**
 * インポート境界（allowed_imports / forbidden_imports）を検証する
 */
export function checkImportBoundaries(
  fromFilePath: string,
  rule: StructureRule,
  extracted: ExtractedImport,
  resolved: ResolvedImport
): LintDiagnostic | null {
  // 外部パッケージ (node_modules) かつ明示的な禁止ルールがない場合は通常スキップ
  const targetPath = resolved.projectRelativePath || resolved.rawSpecifier;

  // 1. 自己モジュール内（同一スライス内）のインポート判定
  const fromSlice = getSliceDirectory(rule.path, fromFilePath);
  const targetSlice = getSliceDirectory(rule.path, targetPath);

  if (fromSlice && targetSlice && fromSlice === targetSlice) {
    // 同一モジュール内部の相互参照は無条件で許可
    return null;
  }

  // 2. forbidden_imports のチェック (最優先)
  for (const forbiddenPattern of rule.forbidden_imports) {
    // ターゲットが自己スライスでない場合、パターン一致を判定
    if (matchesPattern(targetPath, forbiddenPattern)) {
      return {
        ruleName: rule.name || rule.path,
        filePath: fromFilePath,
        line: extracted.line,
        column: extracted.column,
        severity: "error",
        message: `禁止されているインポートパス '${forbiddenPattern}' への参照が検出されました: '${extracted.specifier}'`,
        sourceCode: extracted.sourceLineText,
        forbiddenTarget: extracted.specifier,
        suggestion: `モジュール境界違反です。'${targetPath}' への直接参照を避け、共有レイヤーへ抽出するか props 経由で渡してください。`,
        fixable: false,
      };
    }
  }

  // 3. allowed_imports のチェック (指定がある場合)
  if (rule.allowed_imports.length > 0) {
    // 外部パッケージ (node_modules/...) は allowed_imports の対象外として扱う（内部アーキテクチャ境界の検証）
    if (!resolved.isExternal) {
      let isAllowed = false;
      for (const allowedPattern of rule.allowed_imports) {
        if (matchesPattern(targetPath, allowedPattern)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        return {
          ruleName: rule.name || rule.path,
          filePath: fromFilePath,
          line: extracted.line,
          column: extracted.column,
          severity: "error",
          message: `許可されていないインポートパス '${targetPath}' への参照が検出されました (許可リスト: ${rule.allowed_imports.join(", ")})`,
          sourceCode: extracted.sourceLineText,
          forbiddenTarget: extracted.specifier,
          suggestion: `マニフェストの allowed_imports に追加するか、参照先を許可されたモジュール経由に変更してください。`,
          fixable: false,
        };
      }
    }
  }

  return null;
}
