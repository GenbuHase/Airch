/**
 * airch マニフェスト設定に関連するエラークラス
 */
export class AirchConfigError extends Error {
  public override readonly name = "AirchConfigError";
  public readonly filePath?: string;
  public readonly details?: string[];

  constructor(message: string, filePath?: string, details?: string[]) {
    super(message);
    this.filePath = filePath;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * 人間が読みやすい整形済みエラーメッセージを取得
   */
  public format(): string {
    const lines: string[] = [];
    lines.push(`[airch] 設定エラー: ${this.message}`);
    if (this.filePath) {
      lines.push(`  対象ファイル: ${this.filePath}`);
    }
    if (this.details && this.details.length > 0) {
      lines.push("  詳細:");
      for (const d of this.details) {
        lines.push(`    - ${d}`);
      }
    }
    return lines.join("\n");
  }
}
