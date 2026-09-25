import { describe, it, expect } from "vitest";
import { checkNamingConvention, convertToConvention, splitIntoWords } from "./naming.js";

describe("NamingValidator", () => {
  it("splitIntoWords で様々なケースを単語に分割できる", () => {
    expect(splitIntoWords("button_group")).toEqual(["button", "group"]);
    expect(splitIntoWords("user-profile")).toEqual(["user", "profile"]);
    expect(splitIntoWords("UserProfile")).toEqual(["User", "Profile"]);
    expect(splitIntoWords("useAuthHook")).toEqual(["use", "Auth", "Hook"]);
  });

  describe("checkNamingConvention", () => {
    it("kebab-case を正しく検証できる", () => {
      expect(checkNamingConvention("user-profile", "kebab-case")).toBe(true);
      expect(checkNamingConvention("cart", "kebab-case")).toBe(true);
      expect(checkNamingConvention("UserProfile", "kebab-case")).toBe(false);
      expect(checkNamingConvention("user_profile", "kebab-case")).toBe(false);
    });

    it("PascalCase を正しく検証できる", () => {
      expect(checkNamingConvention("Button", "PascalCase")).toBe(true);
      expect(checkNamingConvention("ButtonGroup", "PascalCase")).toBe(true);
      expect(checkNamingConvention("buttonGroup", "PascalCase")).toBe(false);
      expect(checkNamingConvention("button-group", "PascalCase")).toBe(false);
    });

    it("camelCase を正しく検証できる", () => {
      expect(checkNamingConvention("useAuth", "camelCase")).toBe(true);
      expect(checkNamingConvention("fetchUserData", "camelCase")).toBe(true);
      expect(checkNamingConvention("FetchUserData", "camelCase")).toBe(false);
    });

    it("snake_case を正しく検証できる", () => {
      expect(checkNamingConvention("user_profile", "snake_case")).toBe(true);
      expect(checkNamingConvention("user-profile", "snake_case")).toBe(false);
    });

    it("カスタム正規表現を検証できる", () => {
      expect(checkNamingConvention("auth.service", "^[a-z]+\\.service$")).toBe(true);
      expect(checkNamingConvention("auth.controller", "^[a-z]+\\.service$")).toBe(false);
    });
  });

  describe("convertToConvention (--fix 用)", () => {
    it("button_group.tsx を PascalCase (ButtonGroup.tsx) に変換できる", () => {
      const converted = convertToConvention("button_group.tsx", "PascalCase", true);
      expect(converted).toBe("ButtonGroup.tsx");
    });

    it("UserProfile.tsx を kebab-case (user-profile.tsx) に変換できる", () => {
      const converted = convertToConvention("UserProfile.tsx", "kebab-case", true);
      expect(converted).toBe("user-profile.tsx");
    });

    it("ディレクトリ名を kebab-case に変換できる", () => {
      const converted = convertToConvention("UserFeatures", "kebab-case", false);
      expect(converted).toBe("user-features");
    });
  });
});
