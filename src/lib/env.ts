/**
 * PRISM -- Environment Validation
 *
 * Zod-validated environment schema. Imported at module load time
 * so missing or invalid config causes a clear startup error rather
 * than a cryptic runtime failure during the first pipeline run.
 */

import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string({ message: "ANTHROPIC_API_KEY is required. Set it in your .env file." })
    .min(1, "ANTHROPIC_API_KEY cannot be empty"),
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validated environment variables.
 * Throws a descriptive Zod error at import time if validation fails.
 */
export const env = (() => {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      console.error(
        `\n❌ PRISM Environment Validation Failed:\n${issues}\n\nPlease check your .env file.\n`,
      );
    }
    throw error;
  }
})();
