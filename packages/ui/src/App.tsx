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
  ExternalLink,
} from "lucide-react";
import {
  fetchManifest,
  saveManifest,
  fetchDiagnostics,
  runFix,
  fetchRules,
  generateRulesOnDisk,
  type ManifestData,
  type DiagnosticsData,
  type GeneratedRulesData,
} from "./api.js";

type TabType = "overview" | "violations" | "editor" | "rules";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [manifestData, setManifestData] = useState<ManifestData | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [rulesData, setRulesData] = useState<GeneratedRulesData | null>(null);
  const [rawYaml, setRawYaml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeRuleTarget, setActiveRuleTarget] = useState<string>("agents");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, d, r] = await Promise.all([fetchManifest(), fetchDiagnostics(), fetchRules()]);
      setManifestData(m);
      setRawYaml(m.rawYaml);
      setDiagnosticsData(d);
      setRulesData(r);
    } catch (err) {
      console.error(err);
      showToast("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveManifest = async () => {
    setSaving(true);
    try {
      const res = await saveManifest(rawYaml);
      if (res.success) {
        showToast("airch.yaml を正常に保存しました！");
        await loadAll();
      } else {
        showToast(`保存エラー: ${res.message}`);
      }
    } catch {
      showToast("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleRunFix = async () => {
    try {
      const res = await runFix();
      if (res.success) {
        showToast(`${res.fixedCount}件の問題を自動修正しました！`);
        await loadAll();
      }
    } catch {
      showToast("自動修正に失敗しました");
    }
  };

  const handleGenerateRules = async () => {
    try {
      const res = await generateRulesOnDisk();
      if (res.success) {
        showToast(`${res.count}個のルールファイルを同期・保存しました！`);
      }
    } catch {
      showToast("ルールの生成に失敗しました");
    }
  };

  if (loading && !manifestData) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <RefreshCw style={{ animation: "spin 1s linear infinite", width: 32, height: 32, color: "#38bdf8" }} />
      </div>
    );
  }

  const manifest = manifestData?.manifest;
  const errorCount = diagnosticsData?.summary.errorCount ?? 0;
  const warnCount = diagnosticsData?.summary.warningCount ?? 0;
  const isClean = errorCount === 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* トースト通知 */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            backgroundColor: "#0284c7",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* ヘッダー */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-secondary)",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                color: "#0f172a",
              }}
            >
              A
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>airch ui</span>
          </div>

          <div style={{ height: 20, width: 1, backgroundColor: "var(--border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{manifest?.project.name || "Project"}</span>
            <span
              style={{
                fontSize: 12,
                backgroundColor: "#1e293b",
                padding: "2px 8px",
                borderRadius: 9999,
                border: "1px solid #475569",
                color: "#94a3b8",
              }}
            >
              {manifest?.project.architecture || "Custom"}
            </span>
          </div>
        </div>

        {/* タブナビゲーション */}
        <nav style={{ display: "flex", gap: 4, backgroundColor: "var(--bg-primary)", padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTab === "overview" ? "var(--bg-card)" : "transparent",
              color: activeTab === "overview" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <Layers size={16} /> Overview
          </button>
          <button
            onClick={() => setActiveTab("violations")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTab === "violations" ? "var(--bg-card)" : "transparent",
              color: activeTab === "violations" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <ShieldAlert size={16} /> Violations
            {errorCount > 0 && (
              <span
                style={{
                  backgroundColor: "var(--accent-red)",
                  color: "#fff",
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 9999,
                  fontWeight: 700,
                }}
              >
                {errorCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTab === "editor" ? "var(--bg-card)" : "transparent",
              color: activeTab === "editor" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <FileCode2 size={16} /> airch.yaml
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTab === "rules" ? "var(--bg-card)" : "transparent",
              color: activeTab === "rules" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <Bot size={16} /> AI Rules
          </button>
        </nav>

        {/* アクションボタン */}
        <div style={{ display: "flex", gap: 8 }}>
          {errorCount > 0 && (
            <button
              onClick={handleRunFix}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#22c55e",
                color: "#0f172a",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Wrench size={14} /> Auto Fix
            </button>
          )}
          <button
            onClick={loadAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} /> Sync
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {/* 1. Overview タブ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto" }}>
            {/* サマリーカード */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div style={{ backgroundColor: "var(--bg-secondary)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Architecture Health</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {isClean ? <CheckCircle2 color="#22c55e" size={24} /> : <XCircle color="#ef4444" size={24} />}
                  <span style={{ fontSize: 24, fontWeight: 700, color: isClean ? "#22c55e" : "#ef4444" }}>
                    {isClean ? "Clean & Compliant" : `${errorCount} Violations`}
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: "var(--bg-secondary)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Scanned Files</span>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
                  {diagnosticsData?.summary.totalFilesScanned || 0}
                </div>
              </div>

              <div style={{ backgroundColor: "var(--bg-secondary)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Defined Layers / Rules</span>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
                  {manifest?.structure.length || 0}
                </div>
              </div>

              <div style={{ backgroundColor: "var(--bg-secondary)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Lint Scan Duration</span>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "#38bdf8" }}>
                  {diagnosticsData?.summary.durationMs || 0} ms
                </div>
              </div>
            </div>

            {/* モジュール階層ダイアグラム */}
            <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={18} color="#38bdf8" /> Architectural Modules & Import Boundaries
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {manifest?.structure.map((rule, idx) => {
                  const hasViolation = diagnosticsData?.diagnostics.some((d) => d.ruleName === rule.name || d.ruleName === rule.path);
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        padding: 16,
                        borderRadius: 8,
                        border: hasViolation ? "1px solid #ef4444" : "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{rule.name || rule.path}</span>
                          <code style={{ fontSize: 12, backgroundColor: "#0f172a", padding: "2px 6px", borderRadius: 4, color: "#38bdf8" }}>
                            {rule.path}
                          </code>
                        </div>
                        {hasViolation && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#ef4444", fontSize: 12, fontWeight: 600 }}>
                            <AlertTriangle size={14} /> Has Violations
                          </span>
                        )}
                      </div>

                      {rule.description && (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rule.description}</p>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginTop: 4 }}>
                        {rule.forbidden_imports.length > 0 && (
                          <div>
                            <span style={{ color: "#ef4444", fontWeight: 600 }}>Forbidden: </span>
                            {rule.forbidden_imports.map((f, i) => (
                              <code key={i} style={{ backgroundColor: "#450a0a", color: "#fca5a5", padding: "1px 5px", borderRadius: 3, margin: "0 2px" }}>
                                {f}
                              </code>
                            ))}
                          </div>
                        )}
                        {rule.allowed_imports.length > 0 && (
                          <div>
                            <span style={{ color: "#22c55e", fontWeight: 600 }}>Allowed: </span>
                            {rule.allowed_imports.map((a, i) => (
                              <code key={i} style={{ backgroundColor: "#052e16", color: "#86efac", padding: "1px 5px", borderRadius: 3, margin: "0 2px" }}>
                                {a}
                              </code>
                            ))}
                          </div>
                        )}
                        {rule.naming_convention && (
                          <div>
                            <span style={{ color: "#94a3b8" }}>Naming: </span>
                            <span style={{ fontWeight: 500 }}>{rule.naming_convention}</span>
                          </div>
                        )}
                        {rule.required_files && rule.required_files.length > 0 && (
                          <div>
                            <span style={{ color: "#94a3b8" }}>Required: </span>
                            {rule.required_files.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. Violations タブ */}
        {activeTab === "violations" && (
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                Architectural Violations ({diagnosticsData?.diagnostics.length || 0})
              </h2>
              {errorCount > 0 && (
                <button
                  onClick={handleRunFix}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#22c55e",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Wrench size={16} /> Remediate with --fix
                </button>
              )}
            </div>

            {diagnosticsData?.diagnostics.length === 0 ? (
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  padding: 40,
                  borderRadius: 10,
                  textAlign: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <CheckCircle2 color="#22c55e" size={48} style={{ margin: "0 auto 16px" }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No architectural violations!</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  All code strictly adheres to the boundaries and conventions specified in airch.yaml.
                </p>
              </div>
            ) : (
              diagnosticsData?.diagnostics.map((diag, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 8,
                    border: "1px solid #ef4444",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ backgroundColor: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                        {diag.severity.toUpperCase()}
                      </span>
                      <code style={{ fontWeight: 600, fontSize: 14 }}>
                        {diag.filePath}
                        {diag.line ? `:${diag.line}:${diag.column || 1}` : ""}
                      </code>
                    </div>
                    <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 500 }}>{diag.ruleName}</span>
                  </div>

                  <p style={{ fontSize: 14 }}>{diag.message}</p>

                  {diag.sourceCode && (
                    <pre
                      style={{
                        backgroundColor: "#020617",
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 13,
                        overflowX: "auto",
                        border: "1px solid #1e293b",
                        color: "#f87171",
                      }}
                    >
                      {diag.sourceCode}
                    </pre>
                  )}

                  {diag.suggestion && (
                    <div style={{ fontSize: 13, color: "#fbbf24", backgroundColor: "#451a03", padding: "6px 12px", borderRadius: 4 }}>
                      💡 <strong>Hint:</strong> {diag.suggestion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. airch.yaml エディタ タブ */}
        {activeTab === "editor" && (
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Editing: <code>{manifestData?.configPath}</code>
              </span>
              <button
                onClick={handleSaveManifest}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Save size={16} /> {saving ? "Saving..." : "Save airch.yaml"}
              </button>
            </div>

            <textarea
              value={rawYaml}
              onChange={(e) => setRawYaml(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "550px",
                backgroundColor: "#020617",
                color: "#e2e8f0",
                fontFamily: "monospace",
                fontSize: 14,
                lineHeight: 1.6,
                padding: 16,
                borderRadius: 8,
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
            />
          </div>
        )}

        {/* 4. AI Rules プレビュー タブ */}
        {activeTab === "rules" && (
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {rulesData?.files.map((file) => (
                  <button
                    key={file.target}
                    onClick={() => setActiveRuleTarget(file.target)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "none",
                      backgroundColor: activeRuleTarget === file.target ? "#0284c7" : "var(--bg-secondary)",
                      color: activeRuleTarget === file.target ? "#ffffff" : "var(--text-secondary)",
                    }}
                  >
                    {file.relativePath}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const currentFile = rulesData?.files.find((f) => f.target === activeRuleTarget);
                    if (currentFile) {
                      navigator.clipboard.writeText(currentFile.content);
                      showToast("クリップボードにコピーしました！");
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "var(--bg-card)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  onClick={handleGenerateRules}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#38bdf8",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Save size={14} /> Sync to Disk
                </button>
              </div>
            </div>

            {/* ルール本文プレビュー */}
            <div
              style={{
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid var(--border)",
                padding: 20,
                maxHeight: "600px",
                overflowY: "auto",
              }}
            >
              <pre style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {rulesData?.files.find((f) => f.target === activeRuleTarget)?.content || "No rules available."}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
