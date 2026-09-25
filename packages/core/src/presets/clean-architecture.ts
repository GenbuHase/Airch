import type { AirchManifest } from "../schema/manifest.js";

/**
 * Clean Architecture プリセット
 */
export function createCleanArchitecturePreset(projectName: string = "my-service", rootDir: string = "src"): AirchManifest {
  const root = rootDir.replace(/^\.\/?/, "");
  const p = (rel: string) => (root === "." ? rel : `${root}/${rel}`);

  return {
    version: "1.0",
    project: {
      name: projectName,
      architecture: "clean-architecture",
      description: "依存性の逆転原則 (DIP) に基づく堅牢なクリーンアーキテクチャ設計",
      root: rootDir,
    },
    structure: [
      {
        name: "Domain Layer",
        path: p("domain/**"),
        description: "エンティティ、値オブジェクト、リポジトリIF（最内層・外部依存禁止）",
        allowed_imports: [],
        forbidden_imports: [
          p("application/**"),
          p("adapters/**"),
          p("infrastructure/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["domain-layer"],
      },
      {
        name: "Application Layer (Use Cases)",
        path: p("application/use-cases/*"),
        description: "業務ユースケースクラスと入力DTO",
        allowed_imports: [
          p("domain/**"),
        ],
        forbidden_imports: [
          p("adapters/**"),
          p("infrastructure/**"),
        ],
        naming_convention: "kebab-case",
        required_files: ["index.ts"],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["application-layer"],
      },
      {
        name: "Adapters / Controllers",
        path: p("adapters/**"),
        description: "RESTコントローラー、プレゼンター、APIリクエストハンドラー",
        allowed_imports: [
          p("domain/**"),
          p("application/**"),
        ],
        forbidden_imports: [
          p("infrastructure/**"), // 具象インフラへの直接依存禁止
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["adapter-layer"],
      },
      {
        name: "Infrastructure Layer",
        path: p("infrastructure/**"),
        description: "DB/ORM実装、外部APIクライアント、キャッシュ基盤",
        allowed_imports: [
          p("domain/**"),
          p("application/**"),
        ],
        forbidden_imports: [
          p("adapters/**"),
        ],
        naming_convention: "kebab-case",
        required_files: [],
        disallowed_files: [],
        allow_unmatched_files: true,
        tags: ["infrastructure-layer"],
      },
    ],
    conventions: {
      typescript: {
        strict: true,
        export_style: "named",
        type_import_style: "type-only",
        prefer_interface: true,
      },
      rules: [
        "Domain レイヤーにはフレームワークやORMなど外部ライブラリを絶対にインポートしないこと。",
        "ユースケースは依存先をインターフェースとして受け取り、DIコンテナ経由で注入すること。",
        "すべてのドメインエラーは共通の DomainError 基底クラスを継承すること。",
      ],
    },
    commands: {
      check: { run: "pnpm airch check --strict", description: "アーキテクチャ境界検証" },
      test: { run: "pnpm test", description: "テスト実行" },
      build: { run: "pnpm build", description: "ビルド実行" },
    },
  };
}
