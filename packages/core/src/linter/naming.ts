import type { NamingConvention } from "../schema/manifest.js";

/**
 * 文字列を単語（トークン）配列に分割する
 * 例: "button_group" -> ["button", "group"]
 *     "user-profile" -> ["user", "profile"]
 *     "UserProfile" -> ["User", "Profile"]
 *     "useAuth" -> ["use", "Auth"]
 */
export function splitIntoWords(str: string): string[] {
  // アンダースコア・ハイフン・スペースで分割しつつ、CamelCase の大文字境界でも分割
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 各命名規則のバリデーション正規表現
 */
const PATTERNS: Record<NamingConvention, RegExp> = {
  "kebab-case": /^[a-z0-9]+(-[a-z0-9]+)*$/,
  "PascalCase": /^[A-Z][a-zA-Z0-9]*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z0-9]+(_[a-z0-9]+)*$/,
  UPPER_CASE: /^[A-Z0-9]+(_[A-Z0-9]+)*$/,
};

/**
 * ファイル名から拡張子を除いたベース名を抽出
 * 例: "button_group.tsx" -> "button_group"
 *     "user-profile.test.ts" -> "user-profile" (複合拡張子対応)
 */
export function getBaseNameWithoutExtensions(fileName: string): { baseName: string; extensions: string } {
  const parts = fileName.split(".");
  if (parts.length <= 1) {
    return { baseName: fileName, extensions: "" };
  }
  const baseName = parts[0]!;
  const extensions = "." + parts.slice(1).join(".");
  return { baseName, extensions };
}

/**
 * 文字列が指定された命名規則に合致しているか判定する
 */
export function checkNamingConvention(name: string, convention: NamingConvention | string): boolean {
  if (convention in PATTERNS) {
    const regex = PATTERNS[convention as NamingConvention];
    return regex.test(name);
  }

  // ユーザー定義の正規表現文字列
  try {
    const customRegex = new RegExp(convention);
    return customRegex.test(name);
  } catch {
    return false;
  }
}

/**
 * ファイル名またはディレクトリ名を指定された命名規則に合わせて変換する (--fix 用)
 */
export function convertToConvention(
  fullName: string,
  convention: NamingConvention | string,
  isFile: boolean = true
): string {
  const { baseName, extensions } = isFile
    ? getBaseNameWithoutExtensions(fullName)
    : { baseName: fullName, extensions: "" };

  const words = splitIntoWords(baseName);
  if (words.length === 0) return fullName;

  let newBase: string;

  switch (convention) {
    case "kebab-case":
      newBase = words.map((w) => w.toLowerCase()).join("-");
      break;
    case "PascalCase":
      newBase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
      break;
    case "camelCase":
      newBase = words
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join("");
      break;
    case "snake_case":
      newBase = words.map((w) => w.toLowerCase()).join("_");
      break;
    case "UPPER_CASE":
      newBase = words.map((w) => w.toUpperCase()).join("_");
      break;
    default:
      // カスタム正規表現の場合は自動変換が難しいためそのまま
      return fullName;
  }

  return newBase + extensions;
}
