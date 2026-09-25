import type { AirchManifest } from "../schema/manifest.js";

/**
 * Layered MVC プリセット
 */
export function createLayeredPreset(projectName: string = "my-project", rootDir: string = "src"): AirchManifest {
  const root = rootDir.replace(/^\.\/?/, "");
  const p = (rel: string) => (root === "." ? rel : `${root}/${rel}`);

  return {
    version: "1.0",
    project: {
      name: projectName,
      architecture: "layered",
      description: "シンプルで明快な標準的三層アーキテクチャ (Presentation / Service / Data)",
      root: rootDir,
    },
    structure: [
      {
        name: "Presentation Layer",
        path: p("controllers/**"),
        description: "ルーティング、HTTPハンドラー、ビュー",
        allowed_imports: [
          p("services/**"),
          p("common/**"),
        ],
        forbidden_imports: [
          p("repositories/**"), // コントローラーからDB層の直接アクセス禁止
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["presentation"],
      },
      {
        name: "Service / Business Layer",
        path: p("services/**"),
        description: "ビジネスロジック、トランザクション管理",
        allowed_imports: [
          p("repositories/**"),
          p("common/**"),
        ],
        forbidden_imports: [
          p("controllers/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["business-logic"],
      },
      {
        name: "Data / Repository Layer",
        path: p("repositories/**"),
        description: "データアクセス、永続化、モデル",
        allowed_imports: [
          p("common/**"),
        ],
        forbidden_imports: [
          p("services/**"),
          p("controllers/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["data-access"],
      },
      {
        name: "Common / Utilities",
        path: p("common/**"),
        description: "共通ユーティリティ、型定義、ヘルパー関数",
        allowed_imports: [],
        forbidden_imports: [
          p("controllers/**"),
          p("services/**"),
          p("repositories/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["common"],
      },
    ],
    conventions: {
      typescript: {
        strict: true,
        export_style: "named",
        type_import_style: "type-only",
      },
      rules: [
        "コントローラーからリポジトリを直接呼び出してはならない。必ずサービスを経由すること。",
        "サービス層は特定のHTTPフレームワーク（Request / Response）に依存しない純粋関数・クラスとすること。",
      ],
    },
    commands: {
      check: { run: "pnpm airch check --strict", description: "アーキテクチャ境界検証" },
      test: { run: "pnpm test", description: "テスト実行" },
    },
  };
}
