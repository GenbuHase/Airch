import React, { useState, useEffect } from "react";
import {
  Layers,
  ShieldAlert,
  FileCode2,
  Bot,
  RefreshCw,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Copy,
  Network,
  ListFilter,
  Check,
  Code2,
  FolderGit2,
  Info,
  Rocket,
  Terminal,
  Wand2,
  ArrowRight,
} from "lucide-react";
import {
  fetchManifest,
  saveManifest,
  fetchDiagnostics,
  runFix,
  fetchRules,
  generateRulesOnDisk,
  initProject,
  type ManifestData,
  type DiagnosticsData,
  type GeneratedRulesData,
} from "./api.js";
import { ArchitectureGraph } from "./components/ArchitectureGraph.js";
import { ThemeSelector } from "./components/ThemeSelector.js";

type TabType = "overview" | "violations" | "editor" | "rules";
type OverviewViewMode = "graph" | "cards";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [overviewMode, setOverviewMode] = useState<OverviewViewMode>("graph");
  const [manifestData, setManifestData] = useState<ManifestData | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [rulesData, setRulesData] = useState<GeneratedRulesData | null>(null);
  const [rawYaml, setRawYaml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(false);
  const [cliCopied, setCliCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [activeRuleTarget, setActiveRuleTarget] = useState<string>("agents");
  const [severityFilter, setSeverityFilter] = useState<"all" | "error" | "warning">("all");
  const [copied, setCopied] = useState<boolean>(false);

  const showToast = (text: string, type: "info" | "success" | "error" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const m = await fetchManifest();
      setManifestData(m);
      if (m.initialized && m.manifest) {
        setRawYaml(m.rawYaml || "");
        const [d, r] = await Promise.all([fetchDiagnostics(), fetchRules()]);
        setDiagnosticsData(d);
        setRulesData(r);
      } else {
        setDiagnosticsData(null);
        setRulesData(null);
      }
    } catch (err) {
      console.error(err);
      showToast("データの同期に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleInit = async (architecture: "feature-sliced" | "clean-architecture" | "layered") => {
    setInitializing(true);
    try {
      const res = await initProject({ architecture });
      if (res.success) {
        showToast(`'${architecture}' プリセットで初期化を完了しました！`, "success");
        await loadAll();
      } else {
        showToast(`初期化エラー: ${res.message || "不明なエラー"}`, "error");
      }
    } catch {
      showToast("初期化リクエストに失敗しました", "error");
    } finally {
      setInitializing(false);
    }
  };

  const handleCopyCliCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCliCopied(true);
    showToast("CLI コマンドをコピーしました！", "info");
    setTimeout(() => setCliCopied(false), 2000);
  };

  const handleSaveManifest = async () => {
    setSaving(true);
    try {
      const res = await saveManifest(rawYaml);
      if (res.success) {
        showToast("airch.yaml を正常に保存しました！", "success");
        await loadAll();
      } else {
        showToast(`保存エラー: ${res.message}`, "error");
      }
    } catch {
      showToast("マニフェストの保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRunFix = async () => {
    try {
      const res = await runFix();
      if (res.success) {
        showToast(`${res.fixedCount}件の違反を自動修復しました！`, "success");
        await loadAll();
      }
    } catch {
      showToast("自動修復の実行に失敗しました", "error");
    }
  };

  const handleGenerateRules = async () => {
    try {
      const res = await generateRulesOnDisk();
      if (res.success) {
        showToast(`${res.count}個のAIルールファイルを同期保存しました！`, "success");
      }
    } catch {
      showToast("ルール生成に失敗しました", "error");
    }
  };

  const handleCopyRule = () => {
    const currentFile = rulesData?.files.find((f) => f.target === activeRuleTarget);
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      showToast("クリップボードにコピーしました！", "info");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !manifestData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base-100">
        <div className="flex flex-col items-center gap-3">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <span className="text-sm font-medium text-base-content/70">Loading Architecture Data...</span>
        </div>
      </div>
    );
  }

  const isInitialized = Boolean(manifestData?.initialized && manifestData?.manifest);

  // =========================================================================
  // 未初期化時のセットアップ案内画面
  // =========================================================================
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex flex-col bg-base-100 text-base-content font-sans">
        {/* トースト通知 */}
        {toastMessage && (
          <div className="toast toast-top toast-end z-50">
            <div
              className={`alert shadow-lg text-sm font-medium ${
                toastMessage.type === "success"
                  ? "alert-success"
                  : toastMessage.type === "error"
                  ? "alert-error"
                  : "alert-info"
              }`}
            >
              {toastMessage.type === "success" && <CheckCircle2 size={18} />}
              {toastMessage.type === "error" && <XCircle size={18} />}
              {toastMessage.type === "info" && <Info size={18} />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        {/* ヘッダー */}
        <header className="navbar bg-base-100 border-b border-base-300 px-6 py-2 sticky top-0 z-40 shadow-xs">
          <div className="navbar-start flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-content font-black text-lg shadow-sm">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">airch ui</span>
                <span className="badge badge-xs badge-neutral font-mono">v1.0</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-warning font-semibold">
                <AlertTriangle size={12} />
                <span>未初期化プロジェクト</span>
              </div>
            </div>
          </div>

          <div className="navbar-end flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading || initializing}
              className="btn btn-outline btn-sm gap-1.5"
              title="設定の検出を再試行"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-primary" : ""} />
              <span>再読み込み</span>
            </button>
            <ThemeSelector />
          </div>
        </header>

        {/* 未初期化案内メインコンテンツ */}
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full flex flex-col justify-center space-y-8">
          {/* ヒーローセクション */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
              <Rocket size={40} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Airch の初期化が必要です
            </h1>
            <p className="text-base text-base-content/70 leading-relaxed">
              プロジェクト内にアーキテクチャ定義ファイル（<code className="text-primary font-mono font-semibold bg-base-200 px-1.5 py-0.5 rounded">airch.yaml</code>）が見つかりません。<br className="hidden sm:inline" />
              モジュール境界の可視化やルール診断、AIエージェント向け指示書を生成するには、まずプロジェクトを初期化してください。
            </p>
          </div>

          {/* 2つのセットアップ方法 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* 方法 1: CLI 対話型セットアップ（推奨） */}
            <div className="card bg-base-200 border border-base-300 shadow-md flex flex-col">
              <div className="card-body p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-base-300 text-primary">
                      <Terminal size={20} />
                    </div>
                    <div>
                      <span className="badge badge-primary badge-xs uppercase font-mono tracking-wider font-semibold mb-0.5">Recommended</span>
                      <h2 className="card-title text-lg font-bold">ターミナルから初期化</h2>
                    </div>
                  </div>
                  <p className="text-xs text-base-content/70 leading-relaxed">
                    プロジェクトのルートディレクトリで以下のコマンドを実行し、対話型プロンプトに従ってプロジェクト名や構成を選択します。
                  </p>

                  <div className="mockup-code bg-base-300 text-xs py-3 px-4 shadow-inner relative group border border-base-content/10">
                    <pre data-prefix="$">
                      <code className="text-primary-content font-mono font-bold">pnpm airch init</code>
                    </pre>
                    <button
                      onClick={() => handleCopyCliCommand("pnpm airch init")}
                      className="btn btn-ghost btn-xs absolute right-2 top-2.5 opacity-80 hover:opacity-100"
                      title="コマンドをコピー"
                    >
                      {cliCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      <span className="text-[11px] font-normal">{cliCopied ? "コピー済み" : "コピー"}</span>
                    </button>
                  </div>

                  <div className="alert alert-info py-2 px-3 text-xs rounded-lg flex items-start gap-2 shadow-xs">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span>npx を利用する場合は <code className="font-mono font-semibold">npx @genbuhase/airch init</code> を実行してください。</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-base-300 space-y-2">
                  <p className="text-[11px] text-base-content/60">
                    ※ ターミナルで初期化コマンド完了後、下のボタンでUIを同期してください。
                  </p>
                  <button
                    onClick={loadAll}
                    disabled={loading}
                    className="btn btn-primary w-full gap-2 font-semibold shadow-sm"
                  >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    <span>初期化完了後に再読み込み</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 方法 2: この画面からクイック初期化 */}
            <div className="card bg-base-200 border border-base-300 shadow-md flex flex-col">
              <div className="card-body p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-base-300 text-accent">
                      <Wand2 size={20} />
                    </div>
                    <div>
                      <span className="badge badge-accent badge-xs uppercase font-mono tracking-wider font-semibold mb-0.5">Quick Setup</span>
                      <h2 className="card-title text-lg font-bold">UI からワンクリック初期化</h2>
                    </div>
                  </div>
                  <p className="text-xs text-base-content/70 leading-relaxed">
                    プリセットを選択すると、すぐに標準的な <code className="font-mono text-primary">airch.yaml</code> と AIルールファイルが生成されます。
                  </p>

                  {/* プリセット選択ボタン */}
                  <div className="space-y-2.5 pt-1">
                    {/* Feature-Sliced Design */}
                    <div className="p-3 rounded-box bg-base-100 border border-base-300 hover:border-primary/50 transition-all flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">Feature-Sliced Design</span>
                          <span className="badge badge-xs badge-info font-mono">Frontend / Next.js</span>
                        </div>
                        <p className="text-[11px] text-base-content/60 mt-0.5">
                          app / widgets / features / entities / shared
                        </p>
                      </div>
                      <button
                        onClick={() => handleInit("feature-sliced")}
                        disabled={initializing}
                        className="btn btn-primary btn-xs gap-1 font-semibold shrink-0"
                      >
                        {initializing ? <span className="loading loading-spinner loading-xs" /> : <ArrowRight size={13} />}
                        <span>初期化</span>
                      </button>
                    </div>

                    {/* Clean Architecture */}
                    <div className="p-3 rounded-box bg-base-100 border border-base-300 hover:border-primary/50 transition-all flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">Clean Architecture</span>
                          <span className="badge badge-xs badge-success font-mono">Backend / DDD</span>
                        </div>
                        <p className="text-[11px] text-base-content/60 mt-0.5">
                          domain / usecase / interface / infrastructure
                        </p>
                      </div>
                      <button
                        onClick={() => handleInit("clean-architecture")}
                        disabled={initializing}
                        className="btn btn-primary btn-xs gap-1 font-semibold shrink-0"
                      >
                        {initializing ? <span className="loading loading-spinner loading-xs" /> : <ArrowRight size={13} />}
                        <span>初期化</span>
                      </button>
                    </div>

                    {/* Layered MVC */}
                    <div className="p-3 rounded-box bg-base-100 border border-base-300 hover:border-primary/50 transition-all flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">Layered MVC</span>
                          <span className="badge badge-xs badge-neutral font-mono">Simple / 3-Tier</span>
                        </div>
                        <p className="text-[11px] text-base-content/60 mt-0.5">
                          controllers / services / repositories / models
                        </p>
                      </div>
                      <button
                        onClick={() => handleInit("layered")}
                        disabled={initializing}
                        className="btn btn-primary btn-xs gap-1 font-semibold shrink-0"
                      >
                        {initializing ? <span className="loading loading-spinner loading-xs" /> : <ArrowRight size={13} />}
                        <span>初期化</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-base-300">
                  <p className="text-[11px] text-base-content/60">
                    ※ 初期化後に上部の「airch.yaml」タブからいつでも構成をカスタマイズ可能です。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const manifest = manifestData?.manifest;
  const errorCount = diagnosticsData?.summary.errorCount ?? 0;
  const warnCount = diagnosticsData?.summary.warningCount ?? 0;
  const isClean = errorCount === 0;

  const filteredDiagnostics = (diagnosticsData?.diagnostics || []).filter((d) => {
    if (severityFilter === "all") return true;
    return d.severity === severityFilter;
  });

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content font-sans">
      {/* トースト通知 (DaisyUI Toast) */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div
            className={`alert shadow-lg text-sm font-medium ${
              toastMessage.type === "success"
                ? "alert-success"
                : toastMessage.type === "error"
                ? "alert-error"
                : "alert-info"
            }`}
          >
            {toastMessage.type === "success" && <CheckCircle2 size={18} />}
            {toastMessage.type === "error" && <XCircle size={18} />}
            {toastMessage.type === "info" && <Info size={18} />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* ヘッダー (Fomantic-UI Tabular / DaisyUI Navbar) */}
      <header className="navbar bg-base-100 border-b border-base-300 px-6 py-2 sticky top-0 z-40 shadow-xs">
        <div className="navbar-start flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-content font-black text-lg shadow-sm">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight">airch ui</span>
              <span className="badge badge-xs badge-neutral font-mono">v1.0</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-mono">
              <span>{manifest?.project.name || "Project"}</span>
              <span>•</span>
              <span className="text-primary font-semibold">{manifest?.project.architecture || "Custom"}</span>
            </div>
          </div>
        </div>

        {/* 4大ナビゲーションタブ */}
        <div className="navbar-center">
          <div className="tabs tabs-box bg-base-200 border border-base-300 p-1 rounded-box">
            <button
              onClick={() => setActiveTab("overview")}
              className={`tab tab-sm font-medium gap-2 rounded-field transition-all ${
                activeTab === "overview" ? "tab-active font-semibold shadow-xs" : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <Layers size={15} /> Overview
            </button>

            <button
              onClick={() => setActiveTab("violations")}
              className={`tab tab-sm font-medium gap-2 rounded-field transition-all ${
                activeTab === "violations" ? "tab-active font-semibold shadow-xs" : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <ShieldAlert size={15} /> Violations
              {errorCount > 0 ? (
                <span className="badge badge-error badge-xs font-mono font-bold px-1.5 py-0.5">
                  {errorCount}
                </span>
              ) : (
                <span className="badge badge-success badge-xs font-mono px-1 py-0.5">
                  0
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("editor")}
              className={`tab tab-sm font-medium gap-2 rounded-field transition-all ${
                activeTab === "editor" ? "tab-active font-semibold shadow-xs" : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <FileCode2 size={15} /> airch.yaml
            </button>

            <button
              onClick={() => setActiveTab("rules")}
              className={`tab tab-sm font-medium gap-2 rounded-field transition-all ${
                activeTab === "rules" ? "tab-active font-semibold shadow-xs" : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <Bot size={15} /> AI Rules
            </button>
          </div>
        </div>

        {/* 右側アクションエリア */}
        <div className="navbar-end flex items-center gap-2">
          {errorCount > 0 && (
            <button
              onClick={handleRunFix}
              className="btn btn-success btn-sm gap-1.5 shadow-sm font-semibold"
              title="アーキテクチャ違反を自動修正"
            >
              <Wrench size={14} /> Auto Fix
            </button>
          )}

          <button
            onClick={loadAll}
            className="btn btn-ghost btn-sm btn-square"
            title="最新状態に同期"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-primary" : ""} />
          </button>

          {/* DaisyUI テーマセレクター */}
          <ThemeSelector />
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* 1. Overview タブ */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* サマリー統計カード (Fomantic Statistics / DaisyUI Stats) */}
            <div className="stats stats-vertical sm:stats-horizontal shadow-sm bg-base-200 border border-base-300 w-full rounded-box">
              <div className="stat">
                <div className="stat-figure text-base-content/40">
                  {isClean ? <CheckCircle2 size={32} className="text-success" /> : <XCircle size={32} className="text-error" />}
                </div>
                <div className="stat-title text-xs">Architecture Health</div>
                <div className={`stat-value text-2xl font-bold ${isClean ? "text-success" : "text-error"}`}>
                  {isClean ? "Compliant" : `${errorCount} Violations`}
                </div>
                <div className="stat-desc text-xs mt-1">
                  {isClean ? "すべてのモジュール境界が遵守されています" : "禁止されたインポートまたは命名規則違反があります"}
                </div>
              </div>

              <div className="stat">
                <div className="stat-figure text-base-content/40">
                  <FolderGit2 size={32} />
                </div>
                <div className="stat-title text-xs">Scanned Files</div>
                <div className="stat-value text-2xl font-mono">
                  {diagnosticsData?.summary.totalFilesScanned || 0}
                </div>
                <div className="stat-desc text-xs mt-1">コードベース内の対象ファイル</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-base-content/40">
                  <Layers size={32} />
                </div>
                <div className="stat-title text-xs">Defined Modules</div>
                <div className="stat-value text-2xl font-mono">
                  {manifest?.structure.length || 0}
                </div>
                <div className="stat-desc text-xs mt-1">マニフェスト定義レイヤー数</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-base-content/40">
                  <Code2 size={32} />
                </div>
                <div className="stat-title text-xs">Lint Duration</div>
                <div className="stat-value text-2xl font-mono text-info">
                  {diagnosticsData?.summary.durationMs || 0} ms
                </div>
                <div className="stat-desc text-xs mt-1">超高速ローカル静的解析</div>
              </div>
            </div>

            {/* グラフ / カードリスト 表示切り替えパネル */}
            <div className="card bg-base-200 border border-base-300 shadow-sm">
              <div className="card-body p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-300 pb-3">
                  <div className="flex items-center gap-2">
                    <Network size={18} className="text-primary" />
                    <h2 className="font-bold text-base">Architectural Dependency Graph</h2>
                    <span className="badge badge-sm badge-neutral font-mono">
                      {manifest?.structure.length} slices
                    </span>
                  </div>

                  <div className="join border border-base-300 rounded-box p-0.5 bg-base-100">
                    <button
                      onClick={() => setOverviewMode("graph")}
                      className={`btn btn-xs join-item font-medium gap-1.5 ${
                        overviewMode === "graph" ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      <Network size={13} /> Interactive Graph
                    </button>
                    <button
                      onClick={() => setOverviewMode("cards")}
                      className={`btn btn-xs join-item font-medium gap-1.5 ${
                        overviewMode === "cards" ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      <ListFilter size={13} /> Module List
                    </button>
                  </div>
                </div>

                {/* グラフビュー (React Flow) */}
                {overviewMode === "graph" ? (
                  <ArchitectureGraph manifestData={manifestData!} diagnosticsData={diagnosticsData} />
                ) : (
                  /* モジュールカードリスト表示 (Fomantic Segments) */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {manifest?.structure.map((rule, idx) => {
                      const violations = (diagnosticsData?.diagnostics || []).filter(
                        (d) => d.ruleName === rule.name || d.ruleName === rule.path || d.filePath.includes(rule.path)
                      );
                      const hasViolations = violations.length > 0;

                      return (
                        <div
                          key={idx}
                          className={`card bg-base-100 border transition-all ${
                            hasViolations
                              ? "border-error/80 shadow-error/10 shadow-sm"
                              : "border-base-300 shadow-xs hover:border-primary/50"
                          }`}
                        >
                          <div className="card-body p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-sm flex items-center gap-1.5">
                                  <Layers size={15} className={hasViolations ? "text-error" : "text-primary"} />
                                  {rule.name || rule.path}
                                </h3>
                                <code className="text-xs font-mono text-base-content/70 bg-base-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  {rule.path}
                                </code>
                              </div>

                              {hasViolations ? (
                                <span className="badge badge-error badge-sm gap-1 font-mono font-semibold">
                                  <AlertTriangle size={12} /> {violations.length} violations
                                </span>
                              ) : (
                                <span className="badge badge-success badge-sm gap-1 font-mono">
                                  <CheckCircle2 size={12} /> Compliant
                                </span>
                              )}
                            </div>

                            {rule.description && (
                              <p className="text-xs text-base-content/70">{rule.description}</p>
                            )}

                            {/* インポート境界・規則 */}
                            <div className="space-y-1.5 pt-2 border-t border-base-200 text-xs">
                              {rule.forbidden_imports.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-error font-semibold text-[11px] w-16">Forbidden:</span>
                                  {rule.forbidden_imports.map((f, i) => (
                                    <span key={i} className="badge badge-error badge-outline font-mono text-[10px] py-0 px-1.5">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {rule.allowed_imports.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-success font-semibold text-[11px] w-16">Allowed:</span>
                                  {rule.allowed_imports.map((a, i) => (
                                    <span key={i} className="badge badge-success badge-outline font-mono text-[10px] py-0 px-1.5">
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {rule.naming_convention && (
                                <div className="flex items-center gap-1">
                                  <span className="text-base-content/60 text-[11px] w-16">Naming:</span>
                                  <span className="badge badge-neutral text-[10px] font-mono py-0 px-1.5">
                                    {rule.naming_convention}
                                  </span>
                                </div>
                              )}

                              {rule.required_files && rule.required_files.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-base-content/60 text-[11px] w-16">Required:</span>
                                  {rule.required_files.map((rf, i) => (
                                    <span key={i} className="badge badge-ghost text-[10px] font-mono py-0 px-1.5">
                                      {rf}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. Violations タブ */}
        {/* ========================================================================= */}
        {activeTab === "violations" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* ツールバー */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-200 p-4 rounded-box border border-base-300 shadow-xs">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <ShieldAlert size={18} className={errorCount > 0 ? "text-error" : "text-success"} />
                  Architectural Diagnostics
                </h2>
                <div className="join border border-base-300 rounded-box p-0.5 bg-base-100">
                  <button
                    onClick={() => setSeverityFilter("all")}
                    className={`btn btn-xs join-item ${severityFilter === "all" ? "btn-active font-semibold" : "btn-ghost"}`}
                  >
                    All ({diagnosticsData?.diagnostics.length || 0})
                  </button>
                  <button
                    onClick={() => setSeverityFilter("error")}
                    className={`btn btn-xs join-item ${severityFilter === "error" ? "btn-error font-semibold" : "btn-ghost"}`}
                  >
                    Errors ({errorCount})
                  </button>
                  <button
                    onClick={() => setSeverityFilter("warning")}
                    className={`btn btn-xs join-item ${severityFilter === "warning" ? "btn-warning font-semibold" : "btn-ghost"}`}
                  >
                    Warnings ({warnCount})
                  </button>
                </div>
              </div>

              {errorCount > 0 && (
                <button
                  onClick={handleRunFix}
                  className="btn btn-success btn-sm gap-1.5 font-semibold"
                >
                  <Wrench size={15} /> Remediate with --fix
                </button>
              )}
            </div>

            {/* 違反なし画面 */}
            {diagnosticsData?.diagnostics.length === 0 ? (
              <div className="card bg-base-200 border border-base-300 shadow-sm p-12 text-center items-center">
                <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="font-bold text-lg mb-2">No Architectural Violations Found!</h3>
                <p className="text-sm text-base-content/70 max-w-md">
                  すべてのモジュールとインポート関係が airch.yaml のアーキテクチャ定義に完全に準拠しています。
                </p>
              </div>
            ) : filteredDiagnostics.length === 0 ? (
              <div className="card bg-base-200 border border-base-300 p-8 text-center text-sm text-base-content/60">
                選択したフィルター（{severityFilter}）に該当する診断項目はありません。
              </div>
            ) : (
              /* 違反項目一覧 (Fomantic Items / DaisyUI Cards) */
              <div className="space-y-4">
                {filteredDiagnostics.map((diag, index) => (
                  <div
                    key={index}
                    className={`card bg-base-200 border-l-4 shadow-sm border border-base-300 transition-all ${
                      diag.severity === "error" ? "border-l-error" : "border-l-warning"
                    }`}
                  >
                    <div className="card-body p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`badge badge-sm font-bold text-xs uppercase ${
                              diag.severity === "error" ? "badge-error" : "badge-warning"
                            }`}
                          >
                            {diag.severity}
                          </span>
                          <code className="text-sm font-semibold font-mono text-primary">
                            {diag.filePath}
                            {diag.line ? `:${diag.line}:${diag.column || 1}` : ""}
                          </code>
                        </div>
                        <span className="badge badge-neutral badge-sm font-mono text-xs">
                          {diag.ruleName}
                        </span>
                      </div>

                      <p className="text-sm text-base-content/90 font-medium">{diag.message}</p>

                      {diag.sourceCode && (
                        <div className="mockup-code bg-base-300 text-xs py-2 px-4 shadow-inner text-error-content overflow-x-auto">
                          <pre data-prefix=">">
                            <code>{diag.sourceCode}</code>
                          </pre>
                        </div>
                      )}

                      {diag.suggestion && (
                        <div className="alert alert-warning py-2 px-3 text-xs shadow-xs rounded-lg flex items-center gap-2">
                          <span className="font-bold">💡 Solution:</span>
                          <span>{diag.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. airch.yaml エディタ タブ */}
        {/* ========================================================================= */}
        {activeTab === "editor" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between bg-base-200 p-3 rounded-box border border-base-300 shadow-xs">
              <div className="text-xs text-base-content/70">
                <span>Config Path: </span>
                <code className="font-mono bg-base-300 px-2 py-0.5 rounded text-primary font-medium">
                  {manifestData?.configPath}
                </code>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRawYaml(manifestData?.rawYaml || "")}
                  className="btn btn-ghost btn-xs font-normal"
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveManifest}
                  disabled={saving}
                  className="btn btn-primary btn-sm gap-1.5 font-semibold"
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save airch.yaml"}
                </button>
              </div>
            </div>

            {/* エディタモックアップ (DaisyUI Mockup Window) */}
            <div className="mockup-window border border-base-300 bg-base-200 shadow-md">
              <textarea
                value={rawYaml}
                onChange={(e) => setRawYaml(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[580px] p-4 bg-base-300 text-base-content font-mono text-sm leading-relaxed border-none focus:outline-none resize-y"
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. AI Rules プレビュー タブ */}
        {/* ========================================================================= */}
        {activeTab === "rules" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-200 p-3 rounded-box border border-base-300 shadow-xs">
              {/* ルールターゲット切り替え */}
              <div className="join border border-base-300 rounded-box p-0.5 bg-base-100">
                {rulesData?.files.map((file) => (
                  <button
                    key={file.target}
                    onClick={() => setActiveRuleTarget(file.target)}
                    className={`btn btn-xs join-item font-mono ${
                      activeRuleTarget === file.target ? "btn-primary font-bold" : "btn-ghost"
                    }`}
                  >
                    {file.relativePath}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyRule}
                  className="btn btn-outline btn-sm gap-1.5"
                  title="マークダウンをクリップボードにコピー"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
                <button
                  onClick={handleGenerateRules}
                  className="btn btn-primary btn-sm gap-1.5 font-semibold"
                  title="生成ルールをプロジェクト直下に保存"
                >
                  <Save size={14} /> Sync to Disk
                </button>
              </div>
            </div>

            {/* ルール内容のコード表示 (DaisyUI Mockup Code) */}
            <div className="mockup-code max-h-[640px] overflow-auto bg-base-300 border border-base-300 shadow-md text-xs font-mono leading-relaxed p-4">
              <pre className="text-base-content/90 whitespace-pre-wrap">
                <code>
                  {rulesData?.files.find((f) => f.target === activeRuleTarget)?.content || "No rules available."}
                </code>
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
