/**
 * Unit tests for Structured Logger (src/lib/logger.ts)
 *
 * Tests validate:
 * - createLogger returns logger with info, warn, error, debug methods
 * - Each method routes to the correct console method
 * - Production: formats as JSON with level/runId/phase/message fields
 * - Development: formats as human-readable with [LEVEL], runId prefix, phase
 * - Error details: includes error message and stack when Error is passed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger, type Logger } from "@/lib/logger";

describe("createLogger", () => {
  const TEST_RUN_ID = "run-12345678-abcd-1234-5678-abcdefabcdef";

  let logger: Logger;

  beforeEach(() => {
    logger = createLogger(TEST_RUN_ID);
  });

  it("returns a logger with info, warn, error, debug methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  describe("console method routing", () => {
    it("info logs to console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info("THINK", "test message");
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("warn logs to console.warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.warn("DEPLOY", "warning message");
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("error logs to console.error", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      logger.error("PRESENT", "error message");
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("debug logs to console.debug", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      logger.debug("PLAN", "debug message");
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe("production JSON format", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("formats as JSON in production", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      // Re-create logger after stubbing env
      const prodLogger = createLogger(TEST_RUN_ID);
      prodLogger.info("THINK", "decomposing query");

      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("level", "info");
      expect(parsed).toHaveProperty("runId", TEST_RUN_ID);
      expect(parsed).toHaveProperty("phase", "THINK");
      expect(parsed).toHaveProperty("message", "decomposing query");
      expect(parsed).toHaveProperty("timestamp");

      spy.mockRestore();
    });

    it("includes data field when data is provided", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const prodLogger = createLogger(TEST_RUN_ID);
      prodLogger.info("DEPLOY", "agent started", { agentName: "researcher-1" });

      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.data).toEqual({ agentName: "researcher-1" });

      spy.mockRestore();
    });

    it("includes error details when Error is passed", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const prodLogger = createLogger(TEST_RUN_ID);
      const testError = new Error("something went wrong");
      prodLogger.error("PRESENT", "HTML generation failed", testError);

      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("error", "something went wrong");
      expect(parsed).toHaveProperty("stack");
      expect(parsed.stack).toContain("Error: something went wrong");

      spy.mockRestore();
    });

    it("handles non-Error objects passed to error method", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const prodLogger = createLogger(TEST_RUN_ID);
      prodLogger.error("PRESENT", "non-error failure", "string error" as unknown as Error);

      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("error", "string error");
      expect(parsed).not.toHaveProperty("stack");

      spy.mockRestore();
    });
  });

  describe("development human-readable format", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("contains [INFO] level indicator", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.info("THINK", "decomposing query");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("[INFO]");

      spy.mockRestore();
    });

    it("contains runId prefix (first 8 chars)", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.info("THINK", "decomposing query");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain(TEST_RUN_ID.slice(0, 8));

      spy.mockRestore();
    });

    it("contains phase name", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.info("DEPLOY", "deploying agents");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("DEPLOY");

      spy.mockRestore();
    });

    it("contains the message text", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.info("THINK", "query decomposition started");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("query decomposition started");

      spy.mockRestore();
    });

    it("[WARN] level indicator for warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.warn("DEPLOY", "agent timeout");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("[WARN]");

      spy.mockRestore();
    });

    it("[ERROR] level indicator for error", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.error("PRESENT", "render failed");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("[ERROR]");

      spy.mockRestore();
    });

    it("[DEBUG] level indicator for debug", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.debug("PLAN", "trace data");

      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain("[DEBUG]");

      spy.mockRestore();
    });

    it("is NOT valid JSON (human-readable format)", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const devLogger = createLogger(TEST_RUN_ID);
      devLogger.info("THINK", "test message");

      const output = spy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).toThrow();

      spy.mockRestore();
    });
  });
});
