import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_URL: z.string().url().default("http://localhost:3001"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(3).optional(),
  PLATFORM_ADMIN_EMAIL: z.string().email().default("admin@crmkaro.com"),
  PLATFORM_ADMIN_PASSWORD: z.string().min(6).default("CRMKaro@Admin2026!"),
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(configuration: Record<string, unknown>): Environment {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(configuration)) {
    cleaned[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return environmentSchema.parse(cleaned);
}
