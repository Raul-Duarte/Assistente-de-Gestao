const DEFAULT_PORT = 5000;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set.`);
  }
  return value;
}

function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function getEnvWithLegacy(primaryName: string, legacyName: string, defaultValue: string): string {
  return process.env[primaryName] ?? process.env[legacyName] ?? defaultValue;
}

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toPort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return DEFAULT_PORT;
}

export const appConfig = {
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: toPort(process.env.PORT),
  serveStatic: toBoolean(process.env.SERVE_STATIC, true),
  databaseUrl: requiredEnv("DATABASE_URL"),
  sessionSecret: getEnv("SESSION_SECRET", "local-dev-session-secret"),
  sessionCookieSecure: toBoolean(process.env.SESSION_COOKIE_SECURE, getEnv("NODE_ENV", "development") === "production"),
  sessionTtlDays: Number.parseInt(getEnv("AUTH_SESSION_TTL_DAYS", "7"), 10) || 7,
  openAiApiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
  openAiModel: getEnv("OPENAI_MODEL", "gpt-4o"),
  openAiDebugLogs: toBoolean(process.env.OPENAI_DEBUG_LOGS, false),
  authLocalEmail: getEnvWithLegacy("AUTH_LOCAL_EMAIL", "LOCAL_AUTH_EMAIL", "admin@local.dev")
    .trim()
    .toLowerCase(),
  authLocalPassword: getEnvWithLegacy("AUTH_LOCAL_PASSWORD", "LOCAL_AUTH_PASSWORD", "admin123"),
  authLocalFirstName: getEnvWithLegacy("AUTH_LOCAL_FIRST_NAME", "LOCAL_AUTH_FIRST_NAME", "Admin"),
  authLocalLastName: getEnvWithLegacy("AUTH_LOCAL_LAST_NAME", "LOCAL_AUTH_LAST_NAME", "Local"),
};
