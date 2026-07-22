import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    globals: false,
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/extension/test/**/*.test.ts",
      "apps/webview/test/**/*.test.tsx"
    ],
    restoreMocks: true
  }
});
