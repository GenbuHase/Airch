import * as fs from "node:fs/promises";
import * as path from "node:path";
import { minimatch } from "minimatch";
import type { StructureRule } from "../schema/manifest.js";
import type { LintDiagnostic } from "./types.js";

/**
 * 必須ファイルのデフォルトテンプレート
 */
const DEFAULT_BOILERPLATES: Record<string, string> = {
  "index.ts": "// Public API for this module\nexport {};\n",
  "types.ts": "// Type definitions for this module\nexport {};\n",
  "model/types.ts": "// Domain model types\nexport {};\n",
};

/**
 * モジュール直下の必須ファイル・禁止ファイルを検証する
 */
export async function checkFilePresence(
  moduleDir: string,
  rule: StructureRule,
  existingFiles: string[],
  projectRoot: string
): Promise<{ diagnostics: LintDiagnostic[]; fixableFiles: string[] }> {
  const diagnostics: LintDiagnostic[] = [];
  const fixableFiles: string[] = [];

  const existingFileSet = new Set(existingFiles);

  // 1. 必須ファイル (required_files) の存在検証
  for (const requiredFile of rule.required_files) {
    if (!existingFileSet.has(requiredFile)) {
      const relModulePath = path.relative(projectRoot, moduleDir).replace(/\\/g, "/");
      const expectedFilePath = path.join(relModulePath, requiredFile).replace(/\\/g, "/");

      diagnostics.push({
        ruleName: rule.name || rule.path,
        filePath: expectedFilePath,
        severity: "error",
        message: `必須ファイル '${requiredFile}' がモジュール '${relModulePath}' に存在しません`,
        suggestion: `'${expectedFilePath}' を作成してください。'--fix' で自動作成可能です。`,
        fixable: true,
      });
      fixableFiles.push(requiredFile);
    }
  }

  // 2. 禁止ファイル (disallowed_files) の存在検証
  for (const disallowedPattern of rule.disallowed_files) {
    for (const file of existingFiles) {
      if (minimatch(file, disallowedPattern)) {
        const relModulePath = path.relative(projectRoot, moduleDir).replace(/\\/g, "/");
        const filePath = path.join(relModulePath, file).replace(/\\/g, "/");

        diagnostics.push({
          ruleName: rule.name || rule.path,
          filePath,
          severity: "error",
          message: `禁止されているファイルパターン '${disallowedPattern}' に一致するファイルが存在します: '${file}'`,
          suggestion: `このファイルを削除するか別の場所へ移動してください。`,
          fixable: false,
        });
      }
    }
  }

  return { diagnostics, fixableFiles };
}

/**
 * 必須ファイルのスタブを自動作成する (--fix 用)
 */
export async function createRequiredFileStub(
  moduleDir: string,
  requiredFile: string
): Promise<void> {
  const fullPath = path.resolve(moduleDir, requiredFile);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  const content = DEFAULT_BOILERPLATES[requiredFile] || `// Auto-generated required file\nexport {};\n`;
  await fs.writeFile(fullPath, content, "utf-8");
}
