import { describe, it, expect } from "vitest";
import { getPreset, detectProject, PRESET_NAMES } from "./index.js";
import { ManifestSchema } from "../schema/manifest.js";

describe("Presets", () => {
  it("すべてのプリセットが ManifestSchema のバリデーションに合格する", () => {
    for (const presetName of PRESET_NAMES) {
      const manifest = getPreset(presetName, "test-project", "src");
      expect(() => ManifestSchema.parse(manifest)).not.toThrow();
      expect(manifest.version).toBe("1.0");
      expect(manifest.project.name).toBe("test-project");
      expect(manifest.structure.length).toBeGreaterThan(0);
    }
  });

  it("detectProject がデフォルト値を適切に返す", async () => {
    const result = await detectProject();
    expect(result.suggestedName).toBeDefined();
    expect(result.suggestedArchitecture).toBeDefined();
    expect(result.suggestedRoot).toBeDefined();
  });
});
