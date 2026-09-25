import pc from "picocolors";
import type { LintResult } from "@airch/core";

export type ReporterFormat = "pretty" | "json" | "github" | "sarif";

/**
 * pretty フォーマッター (ターミナル向けリッチ表示)
 */
export function formatPretty(result: LintResult): string {
  const lines: string[] = [];

  if (result.diagnostics.length === 0) {
    lines.push(
      pc.green(`✔ No architectural violations found! (Scanned ${result.summary.totalFilesScanned} files in ${result.summary.durationMs}ms)`)
    );
    if (result.summary.fixedCount > 0) {
      lines.push(pc.cyan(`✨ Automatically fixed ${result.summary.fixedCount} issues.`));
    }
    return lines.join("\n");
  }

  lines.push(pc.bold("\n🔍 Architectural Violations Report:\n"));

  for (const diag of result.diagnostics) {
    const isError = diag.severity === "error";
    const badge = isError ? pc.bgRed(pc.white(" ERROR ")) : pc.bgYellow(pc.black(" WARN "));
    const loc = diag.line ? `:${diag.line}${diag.column ? `:${diag.column}` : ""}` : "";

    lines.push(`${badge} ${pc.bold(diag.filePath + loc)}`);
    lines.push(`  Rule: ${pc.cyan(diag.ruleName)}`);
    lines.push(`  Message: ${diag.message}`);

    if (diag.sourceCode) {
      lines.push("");
      lines.push(`  ${pc.gray(`${diag.line || 1} |`)} ${diag.sourceCode}`);
      if (diag.column) {
        const indent = " ".repeat(Math.max(0, diag.column - 1));
        lines.push(`  ${pc.gray("  |")} ${indent}${pc.red("^^^^^^^^^^^^^^^^")}`);
      }
    }

    if (diag.suggestion) {
      lines.push(`  ${pc.yellow("Hint:")} ${diag.suggestion}`);
    }
    lines.push("");
  }

  const errorText = `${result.summary.errorCount} error${result.summary.errorCount === 1 ? "" : "s"}`;
  const warnText = `${result.summary.warningCount} warning${result.summary.warningCount === 1 ? "" : "s"}`;
  const summaryLine = `✖ Found architectural violations (${errorText}, ${warnText}) in ${result.summary.durationMs}ms.`;

  lines.push(result.summary.errorCount > 0 ? pc.red(summaryLine) : pc.yellow(summaryLine));

  if (result.summary.fixedCount > 0) {
    lines.push(pc.green(`✔ Automatically remediated ${result.summary.fixedCount} issues with --fix.`));
  } else if (result.diagnostics.some((d) => d.fixable)) {
    lines.push(pc.gray("Run 'airch check --fix' to attempt automatic remediation for supported rules."));
  }

  return lines.join("\n");
}

/**
 * github フォーマッター (GitHub Actions ワークフローコマンド)
 */
export function formatGitHub(result: LintResult): string {
  const lines: string[] = [];

  for (const diag of result.diagnostics) {
    const level = diag.severity === "error" ? "error" : "warning";
    const lineArg = diag.line ? `line=${diag.line},` : "";
    const colArg = diag.column ? `col=${diag.column},` : "";
    lines.push(`::${level} file=${diag.filePath},${lineArg}${colArg}::[airch] ${diag.message}`);
  }

  return lines.join("\n");
}

/**
 * json フォーマッター
 */
export function formatJson(result: LintResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * sarif フォーマッター (SARIF 2.1.0)
 */
export function formatSarif(result: LintResult): string {
  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "airch",
            informationUri: "https://github.com/GenbuHase/Airch",
            version: "0.1.0",
            rules: [
              {
                id: "AIRCH-BOUNDARY-001",
                name: "ArchitecturalBoundaryViolation",
                shortDescription: { text: "Architectural boundary or forbidden import violation" },
              },
            ],
          },
        },
        results: result.diagnostics.map((diag) => ({
          ruleId: "AIRCH-BOUNDARY-001",
          level: diag.severity === "error" ? "error" : "warning",
          message: { text: diag.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: diag.filePath },
                region: {
                  startLine: diag.line || 1,
                  startColumn: diag.column || 1,
                },
              },
            },
          ],
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

/**
 * フォーマット指定に応じた文字列を出力
 */
export function renderLintReport(result: LintResult, format: ReporterFormat): string {
  switch (format) {
    case "json":
      return formatJson(result);
    case "github":
      return formatGitHub(result);
    case "sarif":
      return formatSarif(result);
    case "pretty":
    default:
      return formatPretty(result);
  }
}
