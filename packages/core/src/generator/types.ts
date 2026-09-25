/**
 * 生成対象のターゲット識別子
 */
export type GeneratorTarget = "agents" | "cursor" | "copilot" | "claude";

export const ALL_TARGETS: GeneratorTarget[] = ["agents", "cursor", "copilot", "claude"];

/**
 * 生成されたファイル情報
 */
export interface GeneratedFile {
  target: GeneratorTarget;
  relativePath: string;
  content: string;
}

/**
 * 同期差分情報
 */
export interface TargetDiff {
  target: GeneratorTarget;
  relativePath: string;
  exists: boolean;
  isSynced: boolean;
  actualContent?: string;
  expectedContent: string;
}
