# CLI仕様書 (CLI Specification)

- **プロダクト名**: `airch`
- **CLIバージョン**: 1.0.0
- **採用フレームワーク**: `commander` (Node.js >= 20.x, ES2024 / NodeNext)
- **ドキュメントバージョン**: 1.0.0
- **作成日**: 2026-09-26

---

## 1. コマンド構成一覧

```text
airch [global-options] <command> [command-options]

Commands:
  init                       プロジェクトの初期化ウィザードを実行し airch.yaml を生成
  generate [options]         マニフェストから各種AIツール向けルールファイルを生成
  check [options]            プロジェクト構造とインポート境界を検証 (Linter)
  ui [options]               ローカルWebダッシュボード (airch ui) を起動

Global Options:
  -c, --config <path>        マニフェストファイルのパスを指定 (デフォルト: airch.yaml)
  -v, --version              バージョン情報を表示
  -h, --help                 ヘルプメッセージを表示
  --verbose                  詳細なデバッグログを出力
  --silent                   エラー以外の出力を抑制
```

---

## 2. コマンド詳細仕様

### 2.1 `airch init` (対話的初期化ウィザード)

新規プロジェクトにおいて、最適な `airch.yaml` を対話形式で生成します。

#### コマンド構文
```bash
airch init [options]
```

#### オプション
| オプション | 型 | デフォルト値 | 説明 |
| :--- | :---: | :---: | :--- |
| `-p, --preset <name>` | `string` | なし | プリセット（`feature-sliced`, `clean-architecture`, `layered`）を直接指定して質問を省略 |
| `-y, --yes` | `boolean` | `false` | すべての質問にデフォルト値で自動回答 |
| `-f, --force` | `boolean` | `false` | 既存の `airch.yaml` が存在する場合に上書き |

#### 対話フロー例
```text
$ airch init

◆  airch - Architecture as Code Setup
│
◇  プロジェクト名を入力してください
│  ecommerce-web
│
◇  アーキテクチャパターンを選択してください
│  ● Feature-Sliced Design (推奨: Next.js / フロントエンド)
│  ○ Clean Architecture (推奨: バックエンド / ドメイン駆動設計)
│  ○ Layered MVC (軽量な三層構造)
│  ○ Custom (空のマニフェストを作成)
│
◇  ソースコードのルートディレクトリを指定してください
│  src
│
◇  生成するAIルールファイルを選択してください (複数選択可)
│  [*] AGENTS.md (マルチエージェント共通規格)
│  [*] .cursorrules (Cursor IDE)
│  [*] .github/copilot-instructions.md (GitHub Copilot)
│  [ ] CLAUDE.md (Claude Code)
│
✔  airch.yaml を正常に作成しました！
✔  初期ルールファイルを生成しました (AGENTS.md, .cursorrules)
```

---

### 2.2 `airch generate` (AIルール生成エンジン)

`airch.yaml` の定義を読み込み、指定されたAIツール向け設定ファイルを決定論的に出力します。

#### コマンド構文
```bash
airch generate [options]
```

#### オプション
| オプション | 型 | デフォルト値 | 説明 |
| :--- | :---: | :---: | :--- |
| `-t, --target <types...>` | `string` | `all` | 出力対象ターゲット (`all`, `agents`, `cursor`, `copilot`, `claude`) |
| `-o, --out-dir <path>` | `string` | `.` | ルールファイルの出力先基準ディレクトリ |
| `--dry-run` | `boolean` | `false` | 実際のファイル書き込みを行わず、生成内容を標準出力に表示 |
| `--check` | `boolean` | `false` | 既存の生成ファイルがマニフェストと同期しているか検証 (CI用) |

#### 動作仕様
- 各ターゲットに対応するファイルパス:
  - `agents`  -> `./AGENTS.md`
  - `cursor`  -> `./.cursorrules`
  - `copilot` -> `./.github/copilot-instructions.md`
  - `claude`  -> `./CLAUDE.md`
- `--check` フラグ指定時:
  - ファイルが存在しない、または内容に1文字でも差分がある場合、終了コード `1` で終了します。
  - CIパイプラインで「開発者が `airch generate` の実行を忘れてコミットしていないか」を検知するために使用します。

#### ターミナル出力例
```text
$ airch generate

✔ Loaded airch.yaml (version 1.0)
✔ Generated AGENTS.md (142 lines)
✔ Generated .cursorrules (98 lines)
✔ Generated .github/copilot-instructions.md (110 lines)

✨ All AI rules generated successfully in 32ms.
```

---

### 2.3 `airch check` (構造リンター & 境界バリデータ)

プロジェクト内のファイルツリー、命名規則、必須ファイル、およびモジュール間のインポート依存関係を検証します。

#### コマンド構文
```bash
airch check [options]
```

#### オプション
| オプション | 型 | デフォルト値 | 説明 |
| :--- | :---: | :---: | :--- |
| `-s, --strict` | `boolean` | `false` | 警告（Warning）もエラーとして扱い、終了コード 1 を返却 |
| `--fix` | `boolean` | `false` | 自動修正可能な項目（命名違反のリネーム、必須ファイルのスタブ作成）を自動実行 |
| `-f, --format <type>` | `string` | `pretty` | 出力フォーマット (`pretty`, `json`, `github`, `sarif`) |
| `--changed-only` | `boolean` | `false` | Gitステージングまたは差分ファイルのみを対象に高速検証 |
| `--base <git-ref>` | `string` | `HEAD` | `--changed-only` 時の比較対象コミット/ブランチ |

#### ターミナル出力例 (通常エラー時: `pretty` フォーマット)
```text
$ airch check

🔍 Scanning project architecture based on airch.yaml...

[ERROR] Forbidden Import: Feature-to-Feature Cross Import
  File: src/features/checkout/api/checkout-handler.ts:4:22
  Rule: Features (src/features/*)
  Violation: Importing from forbidden path 'src/features/cart/model'
  
  4 | import { getCartItems } from "@/features/cart/model";
    |                          ^^^^^^^^^^^^^^^^^^^^^^^^^^
  Hint: Features cannot directly import other features. Pass cart data via props, URL, or extract shared entities to 'src/entities/cart'.

[ERROR] Naming Convention Violation
  File: src/components/ui/button_group.tsx
  Rule: UI Components (src/components/ui)
  Violation: File name 'button_group.tsx' does not match required convention 'PascalCase'
  Hint: Expected 'ButtonGroup.tsx'. Run with --fix to automatically rename.

[ERROR] Missing Required File
  Directory: src/features/auth
  Rule: Features (src/features/*)
  Violation: Required file 'types.ts' is missing in module 'auth'
  Hint: Run with --fix to create a boilerplate 'types.ts'.

✖ Found 3 architectural violations (3 errors, 0 warnings).
Run 'airch check --fix' to attempt automatic remediation for supported rules.
```

#### GitHub Actions フォーマット (`--format github`)
```text
::error file=src/features/checkout/api/checkout-handler.ts,line=4,col=22::[airch] Forbidden Import: Importing from forbidden path 'src/features/cart/model'
::error file=src/components/ui/button_group.tsx,line=1,col=1::[airch] Naming Convention Violation: File name does not match 'PascalCase'
::error file=src/features/auth,line=1,col=1::[airch] Missing Required File: 'types.ts' is missing in 'src/features/auth'
```

#### JSON フォーマット (`--format json`)
```json
{
  "success": false,
  "summary": {
    "totalFilesScanned": 248,
    "errorCount": 3,
    "warningCount": 0,
    "durationMs": 142
  },
  "diagnostics": [
    {
      "ruleName": "Features",
      "severity": "error",
      "filePath": "src/features/checkout/api/checkout-handler.ts",
      "line": 4,
      "column": 22,
      "message": "Importing from forbidden path 'src/features/cart/model'",
      "forbiddenTarget": "src/features/cart/model",
      "suggestion": "Features cannot directly import other features. Extract to entities or pass via props."
    }
  ]
}
```

---

### 2.4 `airch ui` (ローカルWebダッシュボード起動)

ブラウザ上で依存関係グラフの可視化やマニフェストのGUI編集を行うためのローカルWebサーバーを起動します。

#### コマンド構文
```bash
airch ui [options]
```

#### オプション
| オプション | 型 | デフォルト値 | 説明 |
| :--- | :---: | :---: | :--- |
| `-p, --port <number>` | `number` | `4567` | サーバー起動ポート番号 |
| `--host <string>` | `string` | `localhost` | リッスンするホストアドレス |
| `--open` | `boolean` | `true` | サーバー起動時に自動でブラウザを開く (`--no-open` で無効化) |
| `--readonly` | `boolean` | `false` | 閲覧専用モード（ファイル変更・保存APIを無効化） |

#### 動作仕様
- カレントディレクトリ（または `--config` で指定されたパス）に `airch.yaml` が存在しない場合でも、CLIサーバーは異常終了せず正常起動します。
- ブラウザ上には自動的に **「Setup Required（セットアップ案内画面）」** が表示されます。
  - ターミナルでの `pnpm airch init` コマンド実行ガイド（ワンクリックコピー対応）
  - GUI上から直接主要プリセット（Feature-Sliced Design / Clean Architecture / Layered MVC）を選択して初期化できる **1-Click Quick Setup** 機能
- 初期化完了後は即座にダッシュボード（Overviewグラフ、ルール設定）へ自動遷移します。

#### ターミナル出力例
```text
$ airch ui

🚀 airch ui running at:
   > Local:   http://localhost:4567/
   > Network: http://192.168.1.10:4567/

✔ Watching airch.yaml and source files for live reload.
Press Ctrl+C to stop the server.
```

