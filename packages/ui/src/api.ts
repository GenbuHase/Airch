export interface ManifestData {
  initialized?: boolean;
  message?: string;
  manifest?: {
    version: string;
    project: {
      name: string;
      architecture: string;
      description?: string;
      root?: string;
    };
    structure: Array<{
      name?: string;
      path: string;
      description?: string;
      allowed_imports: string[];
      forbidden_imports: string[];
      naming_convention?: string;
      required_files?: string[];
      disallowed_files?: string[];
    }>;
    conventions?: {
      typescript?: {
        strict?: boolean;
        export_style?: string;
        type_import_style?: string;
      };
      rules?: string[];
      state_management?: string;
    };
    commands?: Record<string, { run: string; description?: string }>;
  };
  configPath?: string;
  rawYaml?: string;
}

export interface DiagnosticItem {
  ruleName: string;
  filePath: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
  message: string;
  sourceCode?: string;
  forbiddenTarget?: string;
  suggestion?: string;
  fixable?: boolean;
}

export interface DiagnosticsData {
  success: boolean;
  summary: {
    totalFilesScanned: number;
    errorCount: number;
    warningCount: number;
    fixedCount: number;
    durationMs: number;
  };
  diagnostics: DiagnosticItem[];
}

export interface GeneratedRulesData {
  files: Array<{
    target: string;
    relativePath: string;
    content: string;
  }>;
}

export async function fetchManifest(): Promise<ManifestData> {
  const res = await fetch("/api/manifest");
  if (!res.ok) throw new Error("マニフェストの取得に失敗しました");
  const data = await res.json();
  if (data.initialized === undefined) {
    data.initialized = Boolean(data.manifest);
  }
  return data;
}

export async function initProject(options: {
  architecture: "feature-sliced" | "clean-architecture" | "layered";
  projectName?: string;
}): Promise<{ success: boolean; manifestPath?: string; message?: string; files?: string[] }> {
  const res = await fetch("/api/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return res.json();
}

export async function saveManifest(rawYaml: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch("/api/manifest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: rawYaml }),
  });
  return res.json();
}

export async function fetchDiagnostics(): Promise<DiagnosticsData> {
  const res = await fetch("/api/diagnostics");
  if (!res.ok) throw new Error("診断結果の取得に失敗しました");
  return res.json();
}

export async function runFix(): Promise<{ success: boolean; fixedCount: number }> {
  const res = await fetch("/api/fix", { method: "POST" });
  if (!res.ok) throw new Error("自動修正の実行に失敗しました");
  return res.json();
}

export async function fetchRules(): Promise<GeneratedRulesData> {
  const res = await fetch("/api/rules");
  if (!res.ok) throw new Error("AIルールの取得に失敗しました");
  return res.json();
}

export async function generateRulesOnDisk(): Promise<{ success: boolean; count: number }> {
  const res = await fetch("/api/generate", { method: "POST" });
  if (!res.ok) throw new Error("ルールファイルの書き出しに失敗しました");
  return res.json();
}
