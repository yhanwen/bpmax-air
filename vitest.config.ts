import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@bpair/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@bpair/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@bpair/storage-sqlite": resolve(__dirname, "packages/storage-sqlite/src/index.ts"),
      "@bpair/sdk": resolve(__dirname, "packages/sdk/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
