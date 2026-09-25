import { z } from "zod";

/**
 * 命名規則の識別子
 */
export const NamingConventionSchema = z.enum([
  "kebab-case",
  "PascalCase",
  "camelCase",
  "snake_case",
  "UPPER_CASE",
]);
export type NamingConvention = z.infer<typeof NamingConventionSchema>;

/**
 * ディレクトリ・モジュール構造のルール定義スキーマ
 */
export const StructureRuleSchema = z.object({
  name: z.string().optional(),
  path: z.string().min(1, "path は必須です"),
  description: z.string().optional(),
  allowed_imports: z.array(z.string()).default([]),
  forbidden_imports: z.array(z.string()).default([]),
  naming_convention: z.union([NamingConventionSchema, z.string()]).optional(),
  file_naming_convention: z.record(z.string(), z.union([NamingConventionSchema, z.string()])).optional(),
  required_files: z.array(z.string()).default([]),
  disallowed_files: z.array(z.string()).default([]),
  allow_unmatched_files: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});
export type StructureRule = z.infer<typeof StructureRuleSchema>;

/**
 * TypeScript コーディング規約スキーマ
 */
export const TypeScriptConventionSchema = z.object({
  strict: z.boolean().default(true),
  export_style: z.enum(["named", "default", "allow-both"]).default("named"),
  type_import_style: z.enum(["type-only", "inline", "any"]).default("type-only"),
  prefer_interface: z.boolean().optional(),
});
export type TypeScriptConvention = z.infer<typeof TypeScriptConventionSchema>;

/**
 * コーディングスタイル・AIへの指示事項スキーマ
 */
export const ConventionsConfigSchema = z
  .object({
    typescript: TypeScriptConventionSchema.optional(),
    rules: z.array(z.string()).default([]),
    state_management: z.string().optional(),
    testing: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough(); // 未知のキーも柔軟に許可
export type ConventionsConfig = z.infer<typeof ConventionsConfigSchema>;

/**
 * コマンド定義スキーマ
 */
export const CommandConfigSchema = z.object({
  run: z.string().min(1, "run コマンド文字列は必須です"),
  description: z.string().optional(),
});
export type CommandConfig = z.infer<typeof CommandConfigSchema>;

/**
 * プロジェクト情報スキーマ
 */
export const ProjectConfigSchema = z.object({
  name: z.string().min(1, "project.name は必須です"),
  architecture: z.string().min(1, "project.architecture は必須です"),
  description: z.string().optional(),
  root: z.string().default("."),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * airch.yaml のルートスキーマ
 */
export const ManifestSchema = z.object({
  version: z.literal("1.0", {
    errorMap: () => ({ message: "version は '1.0' である必要があります" }),
  }),
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  project: ProjectConfigSchema,
  structure: z.array(StructureRuleSchema).min(1, "structure には少なくとも1つのルールが必要です"),
  conventions: ConventionsConfigSchema.optional(),
  commands: z.record(z.string(), CommandConfigSchema).optional(),
});

export type AirchManifest = z.infer<typeof ManifestSchema>;
