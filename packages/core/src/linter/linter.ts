import * as fs from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import type { AirchManifest } from "../schema/manifest.js";
import type { LintDiagnostic, LintOptions, LintResult, LintSummary } from "./types.js";
import { checkNamingConvention, convertToConvention } from "./naming.js";
import { checkFilePresence, createRequiredFileStub } from "./presence.js";
import { PathResolver } from "./path-resolver.js";
import { extractImportsFromSource } from "./ast-analyzer.js";
import { checkImportBoundaries, matchesRule, getSliceDirectory } from "./boundary.js";

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.airch/**",
];

export class StructureLinter {
  private readonly projectRoot: string;
  private readonly pathResolver: PathResolver;

  constructor(projectRoot: string = process.cwd(), customTsConfigPath?: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.pathResolver = new PathResolver(this.projectRoot, customTsConfigPath);
  }

  /**
   * プロジェクト全体の構造とインポート境界をリント検証する
   */
  public async lint(manifest: AirchManifest, options: LintOptions = {}): Promise<LintResult> {
    const startTime = performance.now();
    const diagnostics: LintDiagnostic[] = [];
    let fixedCount = 0;

    // 1. 対象ファイルの走査
    let targetFiles: string[];
    if (options.files && options.files.length > 0) {
      targetFiles = options.files.map((f) => path.relative(this.projectRoot, f).replace(/\\/g, "/"));
    } else {
      const globPattern = manifest.project.root
        ? `${manifest.project.root.replace(/^\.\/?/, "")}/**/*.{ts,tsx,js,jsx}`
        : "**/*.{ts,tsx,js,jsx}";

      targetFiles = await fg(globPattern, {
        cwd: this.projectRoot,
        ignore: DEFAULT_IGNORE,
        dot: false,
      });
    }

    // 2. モジュール直下の必須ファイル・禁止ファイルの検証
    const checkedModuleDirs = new Set<string>();

    for (const file of targetFiles) {
      for (const rule of manifest.structure) {
        const sliceDir = getSliceDirectory(rule.path, file);
        if (sliceDir && !checkedModuleDirs.has(sliceDir)) {
          checkedModuleDirs.add(sliceDir);
          const fullModuleDir = path.resolve(this.projectRoot, sliceDir);

          let dirFiles: string[] = [];
          try {
            const entries = await fs.readdir(fullModuleDir, { recursive: true });
            dirFiles = entries.map((e) => e.replace(/\\/g, "/"));
          } catch {
            continue;
          }

          const { diagnostics: presenceDiags, fixableFiles } = await checkFilePresence(
            fullModuleDir,
            rule,
            dirFiles,
            this.projectRoot
          );

          if (options.fix && fixableFiles.length > 0) {
            for (const reqFile of fixableFiles) {
              await createRequiredFileStub(fullModuleDir, reqFile);
              fixedCount++;
            }
          } else {
            diagnostics.push(...presenceDiags);
          }
        }
      }
    }

    // 3. 各ファイルの命名規則 & インポート境界の検証
    for (let i = 0; i < targetFiles.length; i++) {
      const relFile = targetFiles[i]!;
      const fullPath = path.resolve(this.projectRoot, relFile);

      // マッチするルールの探索
      const matchedRule = manifest.structure.find((r) => matchesRule(r.path, relFile));
      if (!matchedRule) {
        continue;
      }

      // 3.1 命名規則の検証
      if (matchedRule.naming_convention) {
        const fileName = path.basename(relFile);
        const { name: baseName } = path.parse(fileName);
        const isValid = checkNamingConvention(baseName, matchedRule.naming_convention);

        if (!isValid) {
          if (options.fix) {
            const newName = convertToConvention(fileName, matchedRule.naming_convention, true);
            const newFullPath = path.join(path.dirname(fullPath), newName);
            try {
              await fs.rename(fullPath, newFullPath);
              fixedCount++;
              // ターゲットファイル配列内のパスを更新
              targetFiles[i] = path.relative(this.projectRoot, newFullPath).replace(/\\/g, "/");
            } catch {
              diagnostics.push({
                ruleName: matchedRule.name || matchedRule.path,
                filePath: relFile,
                severity: "error",
                message: `ファイル名 '${fileName}' が命名規則 '${matchedRule.naming_convention}' に違反しています`,
                suggestion: `'${newName}' への自動リネームに失敗しました。`,
                fixable: false,
              });
            }
          } else {
            const expectedName = convertToConvention(fileName, matchedRule.naming_convention, true);
            diagnostics.push({
              ruleName: matchedRule.name || matchedRule.path,
              filePath: relFile,
              severity: "error",
              message: `ファイル名 '${fileName}' が命名規則 '${matchedRule.naming_convention}' に違反しています`,
              suggestion: `'${expectedName}' へのリネームを推奨します。'--fix' で自動リネーム可能です。`,
              fixable: true,
            });
          }
        }
      }

      // 3.2 AST インポート解析 & 境界検証
      let sourceText = "";
      try {
        sourceText = await fs.readFile(path.resolve(this.projectRoot, targetFiles[i]!), "utf-8");
      } catch {
        continue;
      }

      const extractedImports = extractImportsFromSource(targetFiles[i]!, sourceText);

      for (const extracted of extractedImports) {
        const resolved = this.pathResolver.resolve(extracted.specifier, targetFiles[i]!);
        const boundaryDiag = checkImportBoundaries(targetFiles[i]!, matchedRule, extracted, resolved);
        if (boundaryDiag) {
          diagnostics.push(boundaryDiag);
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

    const summary: LintSummary = {
      totalFilesScanned: targetFiles.length,
      errorCount,
      warningCount,
      fixedCount,
      durationMs,
    };

    return {
      success: errorCount === 0 && (!options.strict || warningCount === 0),
      summary,
      diagnostics,
    };
  }
}
