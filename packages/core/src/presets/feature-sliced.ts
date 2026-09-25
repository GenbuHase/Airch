import type { AirchManifest } from "../schema/manifest.js";

/**
 * Feature-Sliced Design (FSD) プリセット
 */
export function createFeatureSlicedPreset(projectName: string = "my-app", rootDir: string = "src"): AirchManifest {
  const root = rootDir.replace(/^\.\/?/, "");
  const p = (rel: string) => (root === "." ? rel : `${root}/${rel}`);

  return {
    version: "1.0",
    project: {
      name: projectName,
      architecture: "feature-sliced",
      description: "Feature-Sliced Design (FSD) に準拠したスケーラブルなフロントエンド設計",
      root: rootDir,
    },
    structure: [
      {
        name: "App Router / Global",
        path: p("app/**"),
        description: "ルーティング、レイアウト、グローバルプロバイダ",
        allowed_imports: [
          p("widgets/**"),
          p("features/**"),
          p("entities/**"),
          p("shared/**"),
        ],
        forbidden_imports: [],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["app-layer"],
      },
      {
        name: "Widgets",
        path: p("widgets/*"),
        description: "複数FeatureやEntityを統合した完結型UIブロック（例: Header, ProductGrid）",
        allowed_imports: [
          p("features/**"),
          p("entities/**"),
          p("shared/**"),
        ],
        forbidden_imports: [
          p("widgets/*"),
          p("app/**"),
        ],
        naming_convention: "PascalCase",
        required_files: ["index.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["widgets-layer"],
      },
      {
        name: "Features",
        path: p("features/*"),
        description: "ユーザーインタラクションとビジネス価値を生む機能スライス（例: add-to-cart, auth）",
        allowed_imports: [
          p("entities/**"),
          p("shared/**"),
        ],
        forbidden_imports: [
          p("features/*"), // Feature同士の直接クロスインポート禁止
          p("widgets/**"),
          p("app/**"),
        ],
        naming_convention: "kebab-case",
        required_files: ["index.ts", "types.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["features-layer"],
      },
      {
        name: "Entities",
        path: p("entities/*"),
        description: "ビジネスドメインの実体・モデル（例: user, product）",
        allowed_imports: [
          p("shared/**"),
        ],
        forbidden_imports: [
          p("entities/*"),
          p("features/**"),
          p("widgets/**"),
          p("app/**"),
        ],
        naming_convention: "kebab-case",
        required_files: ["index.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["entities-layer"],
      },
      {
        name: "Shared",
        path: p("shared/**"),
        description: "プロジェクト全体で共有する再利用可能なUI部品、ユーティリティ基盤",
        allowed_imports: [],
        forbidden_imports: [
          p("entities/**"),
          p("features/**"),
          p("widgets/**"),
          p("app/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["shared-layer"],
      },
    ],
    conventions: {
      typescript: {
        strict: true,
        export_style: "named",
        type_import_style: "type-only",
      },
      rules: [
        "スライスの外部公開はすべて index.ts (Public API) 経由で行うこと。深層インポートは禁止。",
        "Feature同士の直接参照は禁止。共有データは entities へ抽出するか、上位 (Widget/App) から注入すること。",
        "Server Components を基本とし、クライアント側の対話が必要な場合のみ最上部に 'use client' を明記すること。",
      ],
    },
    commands: {
      dev: { run: "pnpm dev", description: "ローカル開発サーバー起動" },
      check: { run: "pnpm airch check --strict", description: "アーキテクチャ境界検証" },
      test: { run: "pnpm test", description: "テスト実行" },
    },
  };
}
