import * as http from "node:http";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import {
  ManifestLoader,
  ManifestSchema,
  StructureLinter,
  GeneratorEngine,
  AirchConfigError,
  detectProject,
  getPreset,
  stringifyManifest,
  type PresetName,
} from "@airch/core";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  configPath?: string;
  readonly?: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * リクエストボディを JSON として読み取る
 */
async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * JSON レスポンスを送信する
 */
function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

/**
 * airch ui のローカル HTTP サーバー
 */
export class UIServer {
  private readonly port: number;
  private readonly host: string;
  private readonly configPath?: string;
  private readonly isReadonly: boolean;
  private server?: http.Server;
  private staticDir: string;

  constructor(options: ServerOptions = {}) {
    this.port = options.port !== undefined ? options.port : 4567;
    this.host = options.host || "localhost";
    this.configPath = options.configPath;
    this.isReadonly = options.readonly || false;

    // packages/ui/dist の探索
    // 実行パス (dist/server/server.js) から見た packages/ui/dist
    const candidates = [
      path.resolve(__dirname, "../../../ui/dist"),
      path.resolve(__dirname, "../../ui/dist"),
      path.resolve(process.cwd(), "packages/ui/dist"),
      path.resolve(process.cwd(), "node_modules/@airch/ui/dist"),
    ];

    let foundDir = candidates[0]!;
    for (const c of candidates) {
      if (fsSync.existsSync(c)) {
        foundDir = c;
        break;
      }
    }
    this.staticDir = foundDir;
  }

  /**
   * サーバーを起動する
   */
  public async start(): Promise<{ url: string; port: number; close: () => Promise<void> }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err) {
          logger.error(`Server Error: ${err instanceof Error ? err.message : String(err)}`);
          sendJson(res, 500, { success: false, error: "Internal Server Error" });
        }
      });

      this.server.on("error", reject);

      this.server.listen(this.port, this.host, () => {
        const address = this.server?.address();
        const actualPort = typeof address === "object" && address ? address.port : this.port;
        const url = `http://${this.host}:${actualPort}/`;
        resolve({
          url,
          port: actualPort,
          close: () => this.stop(),
        });
      });
    });
  }

  /**
   * サーバーを停止する
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * リクエストハンドラー
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // CORS プリフライト
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    // --- API ルート ---
    if (pathname.startsWith("/api/")) {
      await this.handleApiRequest(pathname, req, res);
      return;
    }

    // --- 静的アセット配信 ---
    await this.handleStaticRequest(pathname, res);
  }

  /**
   * REST API ハンドラー
   */
  private async handleApiRequest(
    pathname: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const loader = new ManifestLoader();

    // 1. GET /api/manifest
    if (pathname === "/api/manifest" && req.method === "GET") {
      try {
        const { manifest, configPath } = await loader.load(this.configPath);
        const rawYaml = await fs.readFile(configPath, "utf-8");
        sendJson(res, 200, { initialized: true, manifest, configPath, rawYaml });
      } catch (err) {
        if (err instanceof AirchConfigError) {
          sendJson(res, 200, {
            initialized: false,
            message: err.message,
          });
          return;
        }
        throw err;
      }
      return;
    }

    // 2. POST /api/manifest (保存)
    if (pathname === "/api/manifest" && req.method === "POST") {
      if (this.isReadonly) {
        sendJson(res, 403, { success: false, message: "サーバーは閲覧専用モードです" });
        return;
      }
      const body = await readBody(req);
      const newYaml = body.yaml;
      if (typeof newYaml !== "string") {
        sendJson(res, 400, { success: false, message: "yaml 文字列が必要です" });
        return;
      }

      // バリデーション
      try {
        const parsed = yaml.load(newYaml);
        ManifestSchema.parse(parsed);

        const configPath = await loader.findConfigFile(this.configPath);
        await fs.writeFile(configPath, newYaml, "utf-8");
        sendJson(res, 200, { success: true });
      } catch (err) {
        sendJson(res, 400, {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // 3. GET /api/diagnostics (リント)
    if (pathname === "/api/diagnostics" && req.method === "GET") {
      try {
        const { manifest, configPath } = await loader.load(this.configPath);
        const projectRoot = path.dirname(configPath);
        const linter = new StructureLinter(projectRoot);
        const result = await linter.lint(manifest);
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof AirchConfigError) {
          sendJson(res, 200, {
            success: false,
            summary: {
              totalFilesScanned: 0,
              errorCount: 0,
              warningCount: 0,
              fixedCount: 0,
              durationMs: 0,
            },
            diagnostics: [],
          });
          return;
        }
        throw err;
      }
      return;
    }

    // 4. POST /api/fix (自動修正)
    if (pathname === "/api/fix" && req.method === "POST") {
      if (this.isReadonly) {
        sendJson(res, 403, { success: false, message: "サーバーは閲覧専用モードです" });
        return;
      }
      const { manifest, configPath } = await loader.load(this.configPath);
      const projectRoot = path.dirname(configPath);
      const linter = new StructureLinter(projectRoot);
      const result = await linter.lint(manifest, { fix: true });
      sendJson(res, 200, { success: true, fixedCount: result.summary.fixedCount });
      return;
    }

    // 5. GET /api/rules (ルール取得)
    if (pathname === "/api/rules" && req.method === "GET") {
      try {
        const { manifest } = await loader.load(this.configPath);
        const engine = new GeneratorEngine();
        const files = engine.render(manifest);
        sendJson(res, 200, { files });
      } catch (err) {
        if (err instanceof AirchConfigError) {
          sendJson(res, 200, { files: [] });
          return;
        }
        throw err;
      }
      return;
    }

    // 6. POST /api/generate (ルール書き出し)
    if (pathname === "/api/generate" && req.method === "POST") {
      if (this.isReadonly) {
        sendJson(res, 403, { success: false, message: "サーバーは閲覧専用モードです" });
        return;
      }
      const { manifest, configPath } = await loader.load(this.configPath);
      const projectRoot = path.dirname(configPath);
      const engine = new GeneratorEngine(projectRoot);
      const files = await engine.write(manifest);
      sendJson(res, 200, { success: true, count: files.length });
      return;
    }

    // 7. POST /api/init (プロジェクト初期化)
    if (pathname === "/api/init" && req.method === "POST") {
      if (this.isReadonly) {
        sendJson(res, 403, { success: false, message: "サーバーは閲覧専用モードです" });
        return;
      }
      try {
        const body = await readBody(req);
        const architecture = (body.architecture || "feature-sliced") as PresetName;
        const projectDir = this.configPath ? path.dirname(path.resolve(this.configPath)) : process.cwd();
        const detected = await detectProject(projectDir);
        const projectName = body.projectName || detected.suggestedName;
        const rootDir = body.root || detected.suggestedRoot;

        const manifest = getPreset(architecture, projectName, rootDir);
        const fullYamlContent = stringifyManifest(manifest);
        const manifestPath = this.configPath ? path.resolve(this.configPath) : path.join(projectDir, "airch.yaml");

        await fs.writeFile(manifestPath, fullYamlContent, "utf-8");

        const engine = new GeneratorEngine(projectDir);
        const writtenFiles = await engine.write(manifest, undefined, projectDir);

        sendJson(res, 200, {
          success: true,
          manifestPath,
          files: writtenFiles.map((f) => f.relativePath),
        });
      } catch (err) {
        sendJson(res, 500, {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    sendJson(res, 404, { success: false, error: "Not Found" });
  }

  /**
   * 静的ファイル配信ハンドラー
   */
  private async handleStaticRequest(pathname: string, res: http.ServerResponse): Promise<void> {
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(this.staticDir, safePath);

    let stat: fsSync.Stats | undefined;
    try {
      stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        stat = await fs.stat(filePath);
      }
    } catch {
      // SPA フォールバック (index.html)
      filePath = path.join(this.staticDir, "index.html");
      try {
        stat = await fs.stat(filePath);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("UI assets not found. Run 'pnpm --filter @airch/ui build' to build the frontend.");
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const content = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      });
      res.end(content);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error loading static asset");
    }
  }
}
