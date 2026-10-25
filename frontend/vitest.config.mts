import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit and integration tests for the application layer.
 *
 * The contracts have their own Hardhat suite; this covers the parts that were
 * previously untested — credential hashing and signing, the issuance
 * pipeline, the recovery state machine, and the API route handlers, which are
 * exercised against a real file-backed store in a temporary directory rather
 * than against mocks.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each file gets its own process so a test that relocates the working
    // directory for storage isolation cannot affect another.
    isolate: true,
    pool: "forks",
    testTimeout: 20000,
  },
});
