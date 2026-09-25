import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { UIServer } from "./server.js";

describe("UIServer (API & Server)", () => {
  let tempDir: string;
  let manifestPath: string;
  let server: UIServer;
  let serverUrl: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-server-test-"));
    manifestPath = path.join(tempDir, "airch.yaml");

    const yamlContent = `
version: "1.0"
project:
  name: "server-test-app"
  architecture: "feature-sliced"
  root: "./src"
structure:
  - path: "src/features/*"
    allowed_imports: ["src/lib"]
`;
    await fs.writeFile(manifestPath, yamlContent, "utf-8");

    // ポート 0 でOSから空きポートを動的に割り当て
    server = new UIServer({
      port: 0,
      host: "127.0.0.1",
      configPath: manifestPath,
    });

    const info = await server.start();
    // 実際にバインドされたポートを含む URL を取得
    // @ts-expect-error private access for test
    const actualPort = server.server?.address()?.port;
    serverUrl = `http://127.0.0.1:${actualPort}`;
  });

  afterEach(async () => {
    await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("GET /api/manifest でマニフェスト情報と生YAMLを取得できる", async () => {
    const res = await fetch(`${serverUrl}/api/manifest`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.manifest.project.name).toBe("server-test-app");
    expect(data.manifest.version).toBe("1.0");
    expect(data.rawYaml).toContain("server-test-app");
  });

  it("GET /api/diagnostics で最新の境界診断結果を取得できる", async () => {
    const res = await fetch(`${serverUrl}/api/diagnostics`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(Array.isArray(data.diagnostics)).toBe(true);
  });

  it("GET /api/rules で生成されるAIルール一覧を取得できる", async () => {
    const res = await fetch(`${serverUrl}/api/rules`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.files).toBeDefined();
    expect(data.files.length).toBeGreaterThan(0);
    expect(data.files.some((f: any) => f.target === "agents")).toBe(true);
  });

  it("POST /api/manifest でマニフェストを保存・更新できる", async () => {
    const updatedYaml = `
version: "1.0"
project:
  name: "updated-app"
  architecture: "clean-architecture"
structure:
  - path: "src/domain/*"
`;

    const res = await fetch(`${serverUrl}/api/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml: updatedYaml }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // ディスクに書き込まれたか確認
    const diskContent = await fs.readFile(manifestPath, "utf-8");
    expect(diskContent).toContain("updated-app");
  });

  it("POST /api/manifest で不正なYAMLを送信すると400エラーとなる", async () => {
    const invalidYaml = `
version: "99.0"
project: {}
`;

    const res = await fetch(`${serverUrl}/api/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml: invalidYaml }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("静的アセット（SPAフォールバック）が正しく配信される", async () => {
    const res = await fetch(`${serverUrl}/`);
    // UIビルド済みなら200でHTMLが返る
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("airch ui");
    }
  });

  it("未初期化（airch.yaml が存在しない）ディレクトリで initialized: false が返り、POST /api/init で初期化できる", async () => {
    // 空の一時ディレクトリを作成
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "airch-uninit-test-"));
    const uninitManifestPath = path.join(emptyDir, "airch.yaml");

    const uninitServer = new UIServer({
      port: 0,
      host: "127.0.0.1",
      configPath: uninitManifestPath,
    });
    await uninitServer.start();
    // @ts-expect-error private access for test
    const uninitPort = uninitServer.server?.address()?.port;
    const uninitUrl = `http://127.0.0.1:${uninitPort}`;

    try {
      // 1. 未初期化時の GET /api/manifest
      const resManifest = await fetch(`${uninitUrl}/api/manifest`);
      expect(resManifest.status).toBe(200);
      const dataManifest = await resManifest.json();
      expect(dataManifest.initialized).toBe(false);
      expect(dataManifest.message).toBeDefined();

      // 2. 未初期化時の GET /api/diagnostics
      const resDiag = await fetch(`${uninitUrl}/api/diagnostics`);
      expect(resDiag.status).toBe(200);
      const dataDiag = await resDiag.json();
      expect(dataDiag.diagnostics).toEqual([]);

      // 3. POST /api/init で初期化
      const resInit = await fetch(`${uninitUrl}/api/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          architecture: "feature-sliced",
          projectName: "my-uninit-app",
        }),
      });
      expect(resInit.status).toBe(200);
      const dataInit = await resInit.json();
      expect(dataInit.success).toBe(true);

      // 4. 初期化後の GET /api/manifest
      const resAfter = await fetch(`${uninitUrl}/api/manifest`);
      expect(resAfter.status).toBe(200);
      const dataAfter = await resAfter.json();
      expect(dataAfter.initialized).toBe(true);
      expect(dataAfter.manifest.project.name).toBe("my-uninit-app");
      expect(dataAfter.manifest.project.architecture).toBe("feature-sliced");
    } finally {
      await uninitServer.stop();
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});
