import pc from "picocolors";

export interface LoggerOptions {
  silent?: boolean;
  verbose?: boolean;
}

export class Logger {
  private silent: boolean;
  private verbose: boolean;

  constructor(options: LoggerOptions = {}) {
    this.silent = options.silent ?? false;
    this.verbose = options.verbose ?? false;
  }

  public setOptions(options: LoggerOptions): void {
    if (options.silent !== undefined) this.silent = options.silent;
    if (options.verbose !== undefined) this.verbose = options.verbose;
  }

  public info(message: string): void {
    if (this.silent) return;
    console.log(message);
  }

  public success(message: string): void {
    if (this.silent) return;
    console.log(`${pc.green("✔")} ${message}`);
  }

  public warn(message: string): void {
    if (this.silent) return;
    console.warn(`${pc.yellow("⚠")} ${pc.yellow(message)}`);
  }

  public error(message: string): void {
    console.error(`${pc.red("✖")} ${pc.red(message)}`);
  }

  public debug(message: string): void {
    if (this.silent || !this.verbose) return;
    console.log(`${pc.gray("⚙")} ${pc.gray(message)}`);
  }

  public raw(message: string): void {
    if (this.silent) return;
    console.log(message);
  }
}

export const logger = new Logger();
