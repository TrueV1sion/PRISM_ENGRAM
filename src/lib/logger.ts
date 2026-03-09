/**
 * PRISM -- Structured Logger
 *
 * Provides per-run structured logging with correlation IDs.
 * Outputs JSON lines in production, human-readable in development.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  runId: string;
  phase: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

function formatEntry(entry: LogEntry): string {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const color = {
      info: "\x1b[36m",  // cyan
      warn: "\x1b[33m",  // yellow
      error: "\x1b[31m", // red
      debug: "\x1b[90m", // gray
    }[entry.level];
    const reset = "\x1b[0m";
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    return `${color}[${entry.level.toUpperCase()}]${reset} [${entry.runId.slice(0, 8)}] ${entry.phase}: ${entry.message}${dataStr}`;
  }

  return JSON.stringify(entry);
}

export interface Logger {
  info: (phase: string, message: string, data?: Record<string, unknown>) => void;
  warn: (phase: string, message: string, data?: Record<string, unknown>) => void;
  error: (phase: string, message: string, err?: Error | unknown) => void;
  debug: (phase: string, message: string, data?: Record<string, unknown>) => void;
}

/**
 * Create a structured logger for a specific pipeline run.
 *
 * @example
 * ```ts
 * const log = createLogger(runId);
 * log.info("THINK", "Decomposing query", { query });
 * log.warn("DEPLOY", "Agent failed, using fallback", { agentName });
 * log.error("PRESENT", "HTML generation failed", error);
 * ```
 */
export function createLogger(runId: string): Logger {
  function log(
    level: LogLevel,
    phase: string,
    message: string,
    data?: Record<string, unknown>,
    err?: Error | unknown,
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      runId,
      phase,
      message,
    };

    if (data) entry.data = data;

    if (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      if (err instanceof Error && err.stack) {
        entry.stack = err.stack;
      }
    }

    const formatted = formatEntry(entry);

    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "debug":
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  return {
    info: (phase, message, data) => log("info", phase, message, data),
    warn: (phase, message, data) => log("warn", phase, message, data),
    error: (phase, message, err) =>
      log("error", phase, message, undefined, err),
    debug: (phase, message, data) => log("debug", phase, message, data),
  };
}
