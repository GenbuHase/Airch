# Airch (Architecture as Code)

> 🏛️ **Architecture as Code (AaC) for AI-Driven Development**  
> マニフェスト（`airch.yaml`）でアーキテクチャ境界を定義し、決定論的な境界リントと各種AI向けルールファイル（Cursor, Claude, Copilot等）の同期を実現する次世代CLI/GUIツール。

[![CI](https://github.com/GenbuHase/Airch/actions/workflows/architecture.yml/badge.svg)](https://github.com/GenbuHase/Airch/actions/workflows/architecture.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: 5.8](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Node: >=20](https://img.shields.io/badge/Node->=20-green.svg)](https://nodejs.org/)

---

## 📌 背景と課題

AIコーディングアシスタント（Cursor, Claude Code, GitHub Copilot, Windsurf等）の普及により、コード生成のスピードは飛躍的に向上しました。しかし、プロジェクトの規模拡大に伴い以下の課題が浮き彫りになっています。

1. **アーキテクチャの急速なエントロピー増大**: AIがプロジェクトの境界（レイヤー構造、循環参照、禁止クロスインポート）を破り、放置すると短期間でコードベースがスパゲッティ化する。
2. **AI指示書の陳腐化と同期ズレ**: `.cursorrules` や `AGENTS.md` などの手動管理はメンテナンスコストが高く、設計変更と同期が取れなくなる。
3. **決定論的ルールの強制機構の欠如**: 自然言語プロンプトだけではルール遵守を100%保証できず、CI/CDによる静的解析・境界遮断が不可欠。

`Airch` は **`airch.yaml` を唯一の真実の源泉（Single Source of Truth: SSOT）** と位置づけ、アーキテクチャ境界の静的検証とAIコンテキストの決定論的自動生成を提供します。

---

## ✨ コア機能

- 🔍 **決定論的構造リント (`airch check`)**:
  - TypeScript AST解析による禁止インポート（`forbidden_imports`）および許可インポート（`allowed_imports`）の静的判定。
  - ディレクトリ命名規則（`kebab-case`, `PascalCase`, 正規表現等）および必須ファイル（`required_files`）の存在検証。
  - `--fix` による自動リネームや必須ボイラープレートの自動生成。
  - 多様なレポーター（`pretty`, `github`, `json`, `sarif`）に対応。
- 🤖 **AIルール自動同期 (`airch generate`)**:
  - `airch.yaml` から `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, `CLAUDE.md` を一括生成。
  - 順序・改行を正規化した決定論的レンダリング（同一マニフェストから常にバイト一致で出力）。
  - `--check` フラグにより、CI上でAIルールファイルの同期漏れを自動検知。
- 🚀 **対話型初期化ウィザード (`airch init`)**:
  - `@clack/prompts` による直感的な対話型CLIセットアップ。
  - **Feature-Sliced Design (FSD)**、**Clean Architecture**、**Layered MVC** などの主要プリセットを標準同梱。
- 🎨 **ビジュアルWebダッシュボード (`airch ui`)**:
  - ローカルWebサーバーを起動し、ブラウザ上でモジュール間の依存関係グラフをインタラクティブに可視化（`@xyflow/react`）。
  - 違反インポートを赤色破線でリアルタイムにハイライト表示。
  - Tailwind CSS v4 + DaisyUI 5 によるセマンティックUIとマルチテーマ切り替え（`dark`, `night`, `dracula`, `light` 等）。
  - 未初期化プロジェクトでも自動起動し、Web画面から1クリックで初期化可能（Quick Setup Wizard）。

---

## 🚀 クイックスタート

### 1. インストール

プロジェクトの `devDependencies` としてインストール、または `npx` / `pnpm dlx` で即座に実行できます。

```bash
# pnpm
pnpm add -D @genbuhase/airch

# npm
npm install --save-dev @genbuhase/airch

# bun
bun add -d @genbuhase/airch
```

### 2. 初期化ウィザードの実行

対話形式でプロジェクト名やアーキテクチャスタイルを選択し、`airch.yaml` を生成します。

```bash
pnpm airch init
```

非対話モードでプリセットを指定して一括セットアップすることも可能です。

```bash
pnpm airch init --preset feature-sliced --yes
```

### 3. AIコンテキストの生成

マニフェストをもとに、各種AIツール向けの設定ファイルを一括生成します。

```bash
pnpm airch generate
```

### 4. アーキテクチャ境界の検証 (Linter)

プロジェクト内のインポート関係や命名規則を静的検証します。

```bash
# 通常実行
pnpm airch check

# 警告もエラーとして扱い、CIで厳格に検証
pnpm airch check --strict

# 自動修正（命名違反のリネームや必須ファイルの作成）
pnpm airch check --fix
```

### 5. Webダッシュボードの起動

ブラウザ上で視覚的にアーキテクチャ構造と違反状況を俯瞰します。

```bash
pnpm airch ui
```

---

## 📋 マニフェスト設定例 (`airch.yaml`)

エディタ自動補完（JSON Schema）に対応しています。

```yaml
# yaml-language-server: $schema=https://unpkg.com/@genbuhase/airch/schema/v1.json
version: "1.0"

project:
  name: "my-awesome-app"
  architecture: "feature-sliced"
  description: "Next.js 15 を採用した大規模コマースフロントエンド"
  root: "./src"

structure:
  # Features レイヤー
  - name: "Features"
    path: "src/features/*"
    description: "ユーザー操作・ビジネス価値を生む機能単位"
    allowed_imports:
      - "src/entities/**"
      - "src/shared/**"
    forbidden_imports:
      - "src/features/*" # Feature同士の直接参照（クロスインポート）を禁止
      - "src/app/**"
    naming_convention: "kebab-case"
    required_files:
      - "index.ts"
      - "types.ts"

  # Entities レイヤー
  - name: "Entities"
    path: "src/entities/*"
    description: "ビジネス実体・モデル"
    allowed_imports:
      - "src/shared/**"
    forbidden_imports:
      - "src/features/**"
    naming_convention: "kebab-case"
    required_files:
      - "index.ts"

conventions:
  typescript:
    strict: true
    export_style: "named"
    type_import_style: "type-only"
  rules:
    - "すべてのレイヤーは index.ts 経由でのみ公開すること。"
    - "コンポーネント内にインラインスタイルを直接書かないこと。"

commands:
  build:
    run: "pnpm build"
    description: "プロダクションビルド"
  test:
    run: "pnpm vitest run"
    description: "単体テストの実行"
  check:
    run: "pnpm airch check --strict"
    description: "アーキテクチャ境界の検証"
```

---

## 🔄 CI/CD パイプライン連携 (GitHub Actions)

プルリクエスト時にアーキテクチャ境界を検証し、AIルールファイルとの同期漏れを検知するワークフロー例です。

```yaml
name: Architecture Lint

on:
  pull_request:
    branches: [main, develop]

jobs:
  airch-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: Verify Architecture Boundaries
        run: pnpm airch check --strict --format github
      - name: Verify AI Rules Sync
        run: pnpm airch generate --check
```

---

## 📦 モノレポ構造 (Architecture)

本リポジトリは疎結合なモノレポ（pnpm workspaces）として構築されています。

```text
Airch/ (root: @genbuhase/airch-root)
├── packages/
│   ├── core/       # @genbuhase/airch-core
│   │               ├── ManifestLoader (YAMLパース, Zod検証)
│   │               ├── GeneratorEngine (Markdown決定論的生成)
│   │               └── StructureLinter (AST境界解析, 命名規則チェック)
│   │
│   ├── cli/        # @genbuhase/airch (npm実行バイナリ)
│   │               ├── Commander CLI 定義 (init, generate, check, ui)
│   │               ├── UIServer (内蔵HTTP API & SPA静的配信)
│   │               └── レポーター (Console, GitHub, JSON, SARIF)
│   │
│   └── ui/         # @genbuhase/airch-ui (GUI Web Dashboard)
│                   ├── React 19 + Vite フロントエンド
│                   ├── Tailwind CSS v4 + DaisyUI 5
│                   └── @xyflow/react アーキテクチャグラフ
└── docs/           # 要件定義・詳細設計ドキュメント群
```

- **`@genbuhase/airch-core`**: 純粋なドメインロジック。外部UI/CLIに依存せず、ブラウザ/Node双方で動作可能。
- **`@genbuhase/airch`**: ターミナルから `airch` コマンドを実行するエントリポイント。
- **`@genbuhase/airch-ui`**: ローカルWebスタジオ。単体でも `pnpm --filter @genbuhase/airch-ui dev` で高速HMR開発が可能。

---

## 📚 ドキュメント一覧

詳細な仕様書および設計書は [`docs/`](docs/) ディレクトリに収録されています。

- [01. 要件定義書 (Requirements Definition)](docs/01_requirements_definition.md)
- [02. マニフェスト仕様書 (Manifest Specification)](docs/02_manifest_specification.md)
- [03. システムアーキテクチャ設計書 (System Architecture)](docs/03_system_architecture.md)
- [04. CLI仕様書 (CLI Specification)](docs/04_cli_specification.md)
- [05. GUI仕様書 (GUI Specification)](docs/05_gui_specification.md)

---

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
