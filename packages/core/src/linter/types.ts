/**
 * リント診断の重要度
 */
export type LintSeverity = "error" | "warning";

/**
 * 個別のリント診断情報
 */
export interface LintDiagnostic {
  ruleName: string;
  filePath: string;
  line?: number;
  column?: number;
  severity: LintSeverity;
  message: string;
  sourceCode?: string;
  forbiddenTarget?: string;
  suggestion?: string;
  fixable?: boolean;
}

/**
 * リント実行オプション
 */
export interface LintOptions {
  strict?: boolean;
  fix?: boolean;
  rootDir?: string;
  tsConfigPath?: string;
  files?: string[];
}

/**
 * リント実行結果サマリー
 */
export interface LintSummary {
  totalFilesScanned: number;
  errorCount: number;
  warningCount: number;
  fixedCount: number;
  durationMs: number;
}

/**
 * リント実行結果
 */
export interface LintResult {
  success: boolean;
  summary: LintSummary;
  diagnostics: LintDiagnostic[];
}
