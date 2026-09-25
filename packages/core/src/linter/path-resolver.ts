import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

const EXTENSIONS_TO_TRY = [
  "",
  ".ts",
  ".tsx",
  ".d.ts",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
  "/index.js",
];

export interface ResolvedImport {
  rawSpecifier: string;
  isExternal: boolean;
  projectRelativePath?: string;
  absolutePath?: string;
}

/**
 * tsconfig.json を読み込み、パスエイリアスやモジュール解決を行うクラス
 */
export class PathResolver {
  private readonly projectRoot: string;
  private readonly compilerOptions: ts.CompilerOptions;
  private readonly baseUrl: string;

  constructor(projectRoot: string, customTsConfigPath?: string) {
    this.projectRoot = path.resolve(projectRoot);
    const tsConfigPath = customTsConfigPath
      ? path.resolve(this.projectRoot, customTsConfigPath)
      : ts.findConfigFile(this.projectRoot, ts.sys.fileExists, "tsconfig.json");

    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsConfigPath)
      );
      this.compilerOptions = parsed.options;
      this.baseUrl = this.compilerOptions.baseUrl || path.dirname(tsConfigPath);
    } else {
      this.compilerOptions = {};
      this.baseUrl = this.projectRoot;
    }
  }

  /**
   * インポート指定子（importSpecifier）をプロジェクト相対パスに解決する
   */
  public resolve(importSpecifier: string, fromFilePath: string): ResolvedImport {
    // 1. 相対インポート (./ または ../)
    if (importSpecifier.startsWith("./") || importSpecifier.startsWith("../")) {
      const fromDir = path.dirname(path.resolve(this.projectRoot, fromFilePath));
      const absTarget = path.resolve(fromDir, importSpecifier);
      const matchedPath = this.tryExtensions(absTarget);

      const resolved = matchedPath || absTarget;
      const relPath = path.relative(this.projectRoot, resolved).replace(/\\/g, "/");

      return {
        rawSpecifier: importSpecifier,
        isExternal: false,
        projectRelativePath: relPath,
        absolutePath: resolved,
      };
    }

    // 2. tsconfig の paths (エイリアス) による解決
    if (this.compilerOptions.paths) {
      for (const [pattern, targetPatterns] of Object.entries(this.compilerOptions.paths)) {
        const starIndex = pattern.indexOf("*");
        if (starIndex !== -1) {
          const prefix = pattern.slice(0, starIndex);
          const suffix = pattern.slice(starIndex + 1);

          if (importSpecifier.startsWith(prefix) && importSpecifier.endsWith(suffix)) {
            const wildcard = importSpecifier.slice(prefix.length, importSpecifier.length - suffix.length);

            for (const targetPattern of targetPatterns) {
              const substituted = targetPattern.replace("*", wildcard);
              const absCandidate = path.resolve(this.baseUrl, substituted);
              const matched = this.tryExtensions(absCandidate);

              const chosen = matched || absCandidate;
              const relPath = path.relative(this.projectRoot, chosen).replace(/\\/g, "/");
              return {
                rawSpecifier: importSpecifier,
                isExternal: false,
                projectRelativePath: relPath,
                absolutePath: chosen,
              };
            }
          }
        } else if (pattern === importSpecifier) {
          for (const target of targetPatterns) {
            const absCandidate = path.resolve(this.baseUrl, target);
            const matched = this.tryExtensions(absCandidate);
            const chosen = matched || absCandidate;
            const relPath = path.relative(this.projectRoot, chosen).replace(/\\/g, "/");
            return {
              rawSpecifier: importSpecifier,
              isExternal: false,
              projectRelativePath: relPath,
              absolutePath: chosen,
            };
          }
        }
      }
    }

    // 3. baseUrl からの解決
    if (this.compilerOptions.baseUrl) {
      const absCandidate = path.resolve(this.baseUrl, importSpecifier);
      const matched = this.tryExtensions(absCandidate);
      if (matched) {
        return {
          rawSpecifier: importSpecifier,
          isExternal: false,
          projectRelativePath: path.relative(this.projectRoot, matched).replace(/\\/g, "/"),
          absolutePath: matched,
        };
      }
    }

    // 4. 外部パッケージ (node_modules)
    return {
      rawSpecifier: importSpecifier,
      isExternal: true,
      projectRelativePath: `node_modules/${importSpecifier}`,
    };
  }

  private tryExtensions(basePath: string): string | null {
    for (const ext of EXTENSIONS_TO_TRY) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }
}
