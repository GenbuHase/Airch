import { exec } from "node:child_process";
import pc from "picocolors";
import { UIServer } from "../server/server.js";
import { logger } from "../utils/logger.js";

export interface UiCommandOptions {
  port?: string | number;
  host?: string;
  open?: boolean;
  readonly?: boolean;
  config?: string;
}

/**
 * デフォルトブラウザで URL を開く
 */
function openBrowser(url: string): void {
  const startCmd =
    process.platform === "win32"
      ? "start"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";

  exec(`${startCmd} ${url}`);
}

/**
 * ui コマンドハンドラー
 */
export async function executeUi(options: UiCommandOptions): Promise<void> {
  const port = options.port ? Number(options.port) : 4567;
  const host = options.host || "localhost";
  const shouldOpen = options.open !== false;

  const server = new UIServer({
    port,
    host,
    configPath: options.config,
    readonly: options.readonly,
  });

  try {
    const { url } = await server.start();

    logger.info("");
    logger.info(pc.bold(pc.cyan("🚀 airch ui running at:")));
    logger.info(`   > Local:   ${pc.bold(pc.green(url))}`);
    if (options.readonly) {
      logger.info(`   > Mode:    ${pc.yellow("Read-only")}`);
    }
    logger.info(pc.gray("\nPress Ctrl+C to stop the server.\n"));

    if (shouldOpen) {
      openBrowser(url);
    }

    // 終了シグナルのハンドリング
    const shutdown = async () => {
      logger.info("\nStopping airch ui server...");
      await server.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    logger.error(`Failed to start airch ui server: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
