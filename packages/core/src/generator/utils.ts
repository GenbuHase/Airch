import type { AirchManifest, StructureRule } from "../schema/manifest.js";

/**
 * 文字列配列を決定論的に安定ソートする
 */
export function sortStrings(items: string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}

/**
 * structure ルールを path のアルファベット順でソートする
 */
export function sortStructureRules(rules: StructureRule[]): StructureRule[] {
  return [...rules].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * 改行コードを LF に統一し、余分な末尾改行を正規化する
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd() + "\n";
}

/**
 * 境界ルールの一覧を Markdown 形式で生成
 */
export function renderArchitectureRulesMarkdown(manifest: AirchManifest): string {
  const sortedRules = sortStructureRules(manifest.structure);
  const lines: string[] = [];

  for (const rule of sortedRules) {
    const title = rule.name ? `${rule.name} (\`${rule.path}\`)` : `\`${rule.path}\``;
    lines.push(`### ${title}`);

    if (rule.description) {
      lines.push(`${rule.description}`);
      lines.push("");
    }

    // 依存関係ルール
    lines.push("- **Import Boundaries**:");
    if (rule.forbidden_imports.length > 0) {
      const forbiddenList = sortStrings(rule.forbidden_imports)
        .map((p) => `\`${p}\``)
        .join(", ");
      lines.push(`  - ❌ **FORBIDDEN**: ${forbiddenList}`);
    } else {
      lines.push("  - ❌ **FORBIDDEN**: None explicitly listed");
    }

    if (rule.allowed_imports.length > 0) {
      const allowedList = sortStrings(rule.allowed_imports)
        .map((p) => `\`${p}\``)
        .join(", ");
      lines.push(`  - ⭕ **ALLOWED**: ${allowedList}`);
    } else if (rule.forbidden_imports.length > 0) {
      lines.push("  - ⭕ **ALLOWED**: Any imports except forbidden ones");
    } else {
      lines.push("  - ⭕ **ALLOWED**: All");
    }

    // 命名規則
    if (rule.naming_convention) {
      lines.push(`- **Naming Convention**: \`${rule.naming_convention}\``);
    }

    if (rule.file_naming_convention && Object.keys(rule.file_naming_convention).length > 0) {
      const conventions = Object.entries(rule.file_naming_convention)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pattern, conv]) => `\`${pattern}\` -> \`${conv}\``)
        .join(", ");
      lines.push(`- **File Naming**: ${conventions}`);
    }

    // 必須ファイル
    if (rule.required_files.length > 0) {
      const reqList = sortStrings(rule.required_files)
        .map((f) => `\`${f}\``)
        .join(", ");
      lines.push(`- **Required Files**: ${reqList}`);
    }

    // 禁止ファイル
    if (rule.disallowed_files.length > 0) {
      const disList = sortStrings(rule.disallowed_files)
        .map((f) => `\`${f}\``)
        .join(", ");
      lines.push(`- **Disallowed Files**: ${disList}`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * コーディング規約を Markdown 形式で生成
 */
export function renderConventionsMarkdown(manifest: AirchManifest): string {
  if (!manifest.conventions) return "";

  const lines: string[] = [];
  const conv = manifest.conventions;

  if (conv.typescript) {
    lines.push("### TypeScript Standards");
    lines.push(`- **Strict Mode**: ${conv.typescript.strict ? "Enabled (`true`)" : "Disabled"}`);
    lines.push(`- **Export Style**: \`${conv.typescript.export_style}\` export`);
    lines.push(`- **Type Import Style**: \`${conv.typescript.type_import_style}\``);
    if (conv.typescript.prefer_interface !== undefined) {
      lines.push(`- **Prefer Interface**: ${conv.typescript.prefer_interface ? "Yes" : "No"}`);
    }
    lines.push("");
  }

  if (conv.state_management) {
    lines.push("### State Management");
    lines.push(conv.state_management);
    lines.push("");
  }

  if (conv.rules && conv.rules.length > 0) {
    lines.push("### Architectural Principles & AI Instructions");
    for (const rule of conv.rules) {
      lines.push(`- ${rule}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * 実行可能コマンドを Markdown 形式で生成
 */
export function renderCommandsMarkdown(manifest: AirchManifest): string {
  if (!manifest.commands || Object.keys(manifest.commands).length === 0) return "";

  const lines: string[] = [];
  lines.push("### Executable Project Commands");
  lines.push("Use these commands to verify, test, and build your changes:");
  lines.push("");

  const sortedCommands = Object.entries(manifest.commands).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, cmd] of sortedCommands) {
    lines.push(`- **\`${name}\`**: \`${cmd.run}\`${cmd.description ? ` - ${cmd.description}` : ""}`);
  }

  return lines.join("\n");
}
