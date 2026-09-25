# マニフェスト仕様書 (Manifest Specification)

- **プロダクト名**: `airch`
- **対象ファイル**: `airch.yaml` / `airch.yml`
- **スキーマバージョン**: 1.0.0
- **ドキュメントバージョン**: 1.0.0
- **作成日**: 2026-09-26

---

## 1. 概要

`airch.yaml` は、プロジェクトのアーキテクチャ境界、ディレクトリ階層ルール、命名規則、コーディング規約、およびAIエージェントへの指示事項を一元管理する **Single Source of Truth (SSOT)** です。

### 1.1 設定ファイルの配置場所と読み込み優先度
CLI実行時、カレントディレクトリから以下の優先順位でマニフェストファイルを自動探索します。
1. `--config <path>` オプションで明示されたパス
2. `airch.yaml`
3. `airch.yml`
4. `.airch/airch.yaml`
5. `.airch/airch.yml`

### 1.2 JSON Schema サポート
エディタ補完を有効にするため、マニフェストの先頭に以下のメタタグを付与することを推奨します。
```yaml
# yaml-language-server: $schema=https://unpkg.com/@genbuhase/airch/schema/v1.json
version: "1.0"
```

---

## 2. フィールド定義仕様 (Field Definitions)

トップレベルスキーマは以下の要素から構成されます。

| フィールド名 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `version` | `string` | **Yes** | マニフェスト仕様バージョン（現在: `"1.0"`） |
| `extends` | `string \| string[]` | No | 外部またはローカルの設定ファイルパス（継承元） |
| `project` | `ProjectConfig` | **Yes** | プロジェクトの基本メタデータ |
| `structure` | `StructureRule[]` | **Yes** | ディレクトリ構造・モジュール境界ルールのリスト |
| `conventions` | `ConventionsConfig` | No | コーディング規約およびAIエージェント向け指示 |
| `commands` | `Record<string, CommandConfig>` | No | プロジェクトの主要コマンド（AIが実行可能なタスク定義） |

---

### 2.1 `project` オブジェクト
プロジェクトの識別情報と主要アーキテクチャスタイルを定義します。

```yaml
project:
  name: "my-awesome-app"
  architecture: "feature-sliced" # "feature-sliced" | "clean-architecture" | "layered" | "modular" | "custom"
  description: "Next.js 15 エンタープライズWebアプリケーション"
  root: "./src"                   # 検証対象のルートディレクトリ (デフォルト: ".")
```

- `name` (`string`, 必須): プロジェクト名。
- `architecture` (`string`, 必須): 代表的なアーキテクチャスタイル識別子。
- `description` (`string`, 任意): プロジェクト概要。AIプロンプトのコンテキストとして利用。
- `root` (`string`, 任意, デフォルト: `"."`): ソースコード解析の基準ディレクトリ。

---

### 2.2 `structure` 配列 (`StructureRule`)
ディレクトリやモジュールの責務、命名規則、依存関係境界を定義します。

```yaml
structure:
  - name: "Features"                     # ルール識別名（任意）
    path: "src/features/*"               # 対象パス（Glob）
    description: "ドメイン固有のビジネス機能モジュール"
    allowed_imports:                     # インポート許可モジュール（Glob）
      - "src/components/ui/**"
      - "src/lib/**"
      - "src/entities/**"
    forbidden_imports:                   # インポート禁止モジュール（Glob）
      - "src/features/*"                 # 同一・別Feature同士の直接参照を禁止
      - "src/app/**"
    naming_convention: "kebab-case"      # ディレクトリ/ファイル命名規則
    file_naming_convention:              # 拡張子ごとの個別命名規則（任意）
      "*.tsx": "PascalCase"
      "*.ts": "kebab-case"
    required_files:                      # モジュール直下に存在が必須なファイル
      - "index.ts"
      - "types.ts"
    disallowed_files:                    # モジュール内に配置を禁止するファイルパターン
      - "**/*.old.ts"
    allow_unmatched_files: false         # 定義外ファイルの存在を許容するか
    tags: ["business-logic", "ui-slice"]
```

#### パスパターンの評価仕様
- パス表現には標準的なGlob構文（`fast-glob` / `minimatch`）を使用します。
- `src/features/*`: `src/features/` 直下の各サブディレクトリが1つのモジュールとして判定されます。
- `src/features/*` が `forbidden_imports: ["src/features/*"]` を指定した場合、**「自分自身以外の `src/features/*` からのインポート」** を禁止します（自己モジュール内の相対インポートは当然許可されます）。
- インポートパスは、相対パス（`../../lib/utils`）および `tsconfig.json` のパスエイリアス（`@/lib/utils`）の双方が自動的にプロジェクト相対パス（`src/lib/utils.ts`）に解決された上で判定されます。

#### 命名規則 (`naming_convention`)
以下のプリセット値、または正規表現が利用可能です。
- `kebab-case`: `user-profile.ts`, `auth-provider`
- `PascalCase`: `UserProfile.tsx`, `AuthProvider`
- `camelCase`: `useAuth.ts`, `fetchUser.ts`
- `snake_case`: `user_profile.py`, `data_loader`
- `UPPER_CASE`: `CONSTANTS.ts`
- 正規表現: `^([a-z]+)\.(service|controller)\.ts$`

---

### 2.3 `conventions` オブジェクト
TypeScriptの言語規約、スタイリング、AIに対する自然言語プロンプトの指示を記述します。

```yaml
conventions:
  typescript:
    strict: true
    export_style: "named"           # "named" | "default" | "allow-both"
    type_import_style: "type-only"  # "type-only" (`import type { ... }`) | "inline"
    prefer_interface: true          # interface vs type alias
  
  rules:
    - "すべての副作用を伴う非同期処理はカスタムフックにカプセル化すること。"
    - "コンポーネント内にインラインでスタイルを直接書かず、Tailwindのユーティリティクラスを使用すること。"
    - "Server Actionsを定義する際は、必ず zod による引数バリデーションを実施すること。"

  state_management: "Zustand only. Do not use React Context for global state."
  testing:
    unit_runner: "vitest"
    e2e_runner: "playwright"
    test_location: "colocated"      # "colocated" (同階層) | "separate" (__tests__)
    file_pattern: "*.test.ts"
```

---

### 2.4 `commands` オブジェクト
AIエージェントおよび開発者がプロジェクトのライフサイクル（テスト・リント・ビルド）を自律実行するためのコマンド辞書です。

```yaml
commands:
  dev:
    run: "pnpm dev"
    description: "ローカル開発サーバーの起動 (ポート: 3000)"
  lint:
    run: "pnpm lint && pnpm airch check"
    description: "ESLintおよびアーキテクチャ境界検証の実行"
  test:unit:
    run: "pnpm vitest run"
    description: "単体テストの実行"
  build:
    run: "pnpm build"
    description: "プロダクションビルド"
```

---

## 3. Zod によるスキーマ定義 (TypeScript)

`airch` コアパーサーが使用する内部スキーマ定義の骨格です。

```typescript
import { z } from "zod";

export const NamingConventionSchema = z.enum([
  "kebab-case",
  "PascalCase",
  "camelCase",
  "snake_case",
  "UPPER_CASE",
]);

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

export const ManifestSchema = z.object({
  version: z.literal("1.0"),
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  project: z.object({
    name: z.string().min(1),
    architecture: z.string().min(1),
    description: z.string().optional(),
    root: z.string().default("."),
  }),
  structure: z.array(StructureRuleSchema).min(1, "structure には少なくとも1つのルールが必要です"),
  conventions: z.object({
    typescript: z.object({
      strict: z.boolean().default(true),
      export_style: z.enum(["named", "default", "allow-both"]).default("named"),
      type_import_style: z.enum(["type-only", "inline", "any"]).default("type-only"),
      prefer_interface: z.boolean().optional(),
    }).optional(),
    rules: z.array(z.string()).default([]),
    state_management: z.string().optional(),
    testing: z.record(z.string(), z.any()).optional(),
  }).optional(),
  commands: z.record(
    z.string(),
    z.object({
      run: z.string(),
      description: z.string().optional(),
    })
  ).optional(),
});

export type AirchManifest = z.infer<typeof ManifestSchema>;
export type StructureRule = z.infer<typeof StructureRuleSchema>;
```

---

## 4. 実践的マニフェスト構成例 (Real-World Examples)

### 4.1 例1: Next.js 15 (App Router) + Feature-Sliced Architecture (FSD)
FSDのレイヤー原則（上流レイヤーは下流レイヤーのみに依存可能。同一スライス間の横断参照は禁止）を厳格に定義した例です。

```yaml
# yaml-language-server: $schema=https://unpkg.com/@genbuhase/airch/schema/v1.json
version: "1.0"

project:
  name: "ecommerce-web-platform"
  architecture: "feature-sliced"
  description: "Next.js 15 (App Router) を採用した大規模コマースフロントエンド"
  root: "./src"

structure:
  # 1. App レイヤー (ルーティング・グローバルプロバイダ)
  - name: "App Router"
    path: "src/app/**"
    description: "Next.js App Routerのページ定義、レイアウト、グローバルCSS"
    allowed_imports:
      - "src/processes/**"
      - "src/pages/**"
      - "src/widgets/**"
      - "src/features/**"
      - "src/entities/**"
      - "src/shared/**"
    naming_convention: "kebab-case"

  # 2. Widgets レイヤー (複数FeatureやEntityを統合した完結型UIブロック)
  - name: "Widgets"
    path: "src/widgets/*"
    description: "独立した複合UIウィジェット（例: Header, ProductGrid）"
    allowed_imports:
      - "src/features/**"
      - "src/entities/**"
      - "src/shared/**"
    forbidden_imports:
      - "src/widgets/*" # 他のWidgetへの直接依存を禁止
      - "src/app/**"
    naming_convention: "PascalCase"
    required_files:
      - "index.ts"

  # 3. Features レイヤー (ユーザーインタラクションを伴う機能単位)
  - name: "Features"
    path: "src/features/*"
    description: "ユーザー操作・ビジネス価値を生む機能単位（例: add-to-cart, auth-by-email）"
    allowed_imports:
      - "src/entities/**"
      - "src/shared/**"
    forbidden_imports:
      - "src/features/*" # Feature同士の直接依存（クロスインポート）を厳格に禁止
      - "src/widgets/**"
      - "src/app/**"
    naming_convention: "kebab-case"
    required_files:
      - "index.ts"
      - "types.ts"

  # 4. Entities レイヤー (ビジネスドメインの実体・モデル)
  - name: "Entities"
    path: "src/entities/*"
    description: "ビジネス実体（例: user, product, order）のUI・モデル・API"
    allowed_imports:
      - "src/shared/**"
    forbidden_imports:
      - "src/entities/*" # 他のEntityへの直接依存を禁止
      - "src/features/**"
      - "src/widgets/**"
    naming_convention: "kebab-case"
    required_files:
      - "index.ts"
      - "model/types.ts"

  # 5. Shared レイヤー (共通基盤)
  - name: "Shared"
    path: "src/shared/**"
    description: "再利用可能なUIコンポーネント、ユーティリティ、APIクライアント基盤"
    forbidden_imports:
      - "src/entities/**"
      - "src/features/**"
      - "src/widgets/**"
      - "src/app/**"
    naming_convention: "kebab-case"

conventions:
  typescript:
    strict: true
    export_style: "named" # App Routerの特定ファイル(page.tsx, layout.tsx)以外はnamed exportを強制
    type_import_style: "type-only"
  
  rules:
    - "すべてのレイヤーはPublic API (index.ts) 経由でのみ外部へ公開すること。スライス内部の直接深層インポートは禁止。"
    - "Server Component をデフォルトとし、クライアント側の対話が必要な場合のみ最上部に 'use client' を明記すること。"
    - "状態管理には TanStack Query (サーバー状態) および Zustand (クライアントグローバル状態) を使用すること。"
    - "アイコンは lucide-react からインポートすること。"

commands:
  dev:
    run: "pnpm dev"
    description: "Next.js開発サーバー起動"
  check:
    run: "pnpm airch check --strict"
    description: "FSDアーキテクチャ境界違反の検証"
  test:
    run: "pnpm vitest"
    description: "単体テスト実行"
```

---

### 4.2 例2: Clean Architecture / Layered Modular API (Fastify / NestJS)
依存性の逆転原則（DIP: Dependency Inversion Principle）を適用し、ドメインロジックがフレームワークやデータベース等のインフラストラクチャに一切依存しない設計を強制した例です。

```yaml
# yaml-language-server: $schema=https://unpkg.com/@genbuhase/airch/schema/v1.json
version: "1.0"

project:
  name: "payment-gateway-service"
  architecture: "clean-architecture"
  description: "高信頼性が求められる決済マイクロサービスバックエンド"
  root: "./src"

structure:
  # 1. Domain Layer (コアビジネスルール - 最内層)
  - name: "Domain"
    path: "src/domain/**"
    description: "エンティティ、値オブジェクト(VO)、リポジトリインターフェース、ドメインイベント"
    allowed_imports: [] # 外部依存および他レイヤーへの依存は一切不可 (Node標準ライブラリのみ)
    forbidden_imports:
      - "src/application/**"
      - "src/adapters/**"
      - "src/infrastructure/**"
      - "node_modules/fastify"
      - "node_modules/@prisma/client"
      - "node_modules/typeorm"
    naming_convention: "kebab-case"
    tags: ["core-domain"]

  # 2. Application Layer (ユースケース - 業務フロー)
  - name: "Application Use Cases"
    path: "src/application/use-cases/*"
    description: "システム固有の業務ロジックを実行するユースケースクラス"
    allowed_imports:
      - "src/domain/**"
    forbidden_imports:
      - "src/adapters/**"
      - "src/infrastructure/**"
      - "node_modules/fastify"
    naming_convention: "kebab-case"
    required_files:
      - "index.ts"
    tags: ["use-case"]

  # 3. Adapters / Controllers Layer (インターフェース変換)
  - name: "Adapters"
    path: "src/adapters/**"
    description: "RESTコントローラー、DTOバリデーション、プレゼンター"
    allowed_imports:
      - "src/domain/**"
      - "src/application/**"
    forbidden_imports:
      - "src/infrastructure/**" # 具象インフラへの直接依存を禁止（DIコンテナ経由で注入）
    naming_convention: "kebab-case"
    tags: ["interface-adapter"]

  # 4. Infrastructure Layer (技術基盤 - 最外層)
  - name: "Infrastructure"
    path: "src/infrastructure/**"
    description: "Prisma/TypeORM等のDB実装、Stripe外部APIクライアント、Redisキャッシュ"
    allowed_imports:
      - "src/domain/**"
      - "src/application/**"
    forbidden_imports:
      - "src/adapters/**"
    naming_convention: "kebab-case"
    tags: ["infrastructure"]

conventions:
  typescript:
    strict: true
    export_style: "named"
    type_import_style: "type-only"
    prefer_interface: true

  rules:
    - "Domainレイヤーにはいかなる外部ライブラリ（ORM、Webフレームワーク）も持ち込んではならない。"
    - "ユースケースは必ず入力DTOを受け取り、Promise<Result<Success, Failure>> 型を返すこと。"
    - "すべての例外は DomainError を継承した独自エラークラスとして表現すること。"
    - "Controllerはリクエストの検証とUseCaseの呼び出しのみを行い、直接ビジネスロジックを書かないこと。"

commands:
  lint:
    run: "pnpm eslint . && pnpm airch check"
    description: "ESLintおよびClean Architecture境界チェック"
  test:unit:
    run: "pnpm vitest run src/domain src/application"
    description: "DomainおよびUseCaseの高速単体テスト"
  test:integration:
    run: "pnpm vitest run src/infrastructure"
    description: "DB/インフラ統合テスト"
```
