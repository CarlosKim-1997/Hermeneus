export type CreatorAuthMode = "disabled" | "dev" | "external";

const MIN_SESSION_SECRET_LENGTH = 32;

export type CreatorAuthConfig =
  | { mode: "disabled" }
  | {
      mode: "dev";
      devCreatorId: string;
      devCreatorIdSecondary?: string;
      sessionSecret: string;
      sessionTtlMs: number;
    }
  | {
      mode: "external";
      authSecret: string;
      googleClientId: string;
      googleClientSecret: string;
    };

function readAuthMode(): CreatorAuthMode {
  const raw = process.env.CREATOR_AUTH_MODE ?? "disabled";
  if (raw === "disabled" || raw === "dev" || raw === "external") return raw;
  throw new Error(`Unsupported CREATOR_AUTH_MODE: ${raw}`);
}

export function readCreatorAuthConfig(): CreatorAuthConfig {
  const mode = readAuthMode();
  if (mode === "disabled") {
    return { mode: "disabled" };
  }
  if (mode === "dev") {
    const devCreatorId = process.env.DEV_CREATOR_ID?.trim();
    const sessionSecret = process.env.CREATOR_SESSION_SECRET?.trim();
    if (!devCreatorId || !sessionSecret) {
      throw new Error("CREATOR_AUTH_MODE=dev requires DEV_CREATOR_ID and CREATOR_SESSION_SECRET");
    }
    if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(`CREATOR_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
    }
    const secondary = process.env.DEV_CREATOR_ID_B?.trim();
    return {
      mode: "dev",
      devCreatorId,
      devCreatorIdSecondary: secondary || undefined,
      sessionSecret,
      sessionTtlMs: 8 * 60 * 60 * 1000,
    };
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!authSecret || !googleClientId || !googleClientSecret) {
    throw new Error("CREATOR_AUTH_MODE=external requires AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET");
  }
  if (authSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return {
    mode: "external",
    authSecret,
    googleClientId,
    googleClientSecret,
  };
}

export function resolveDevCreatorId(
  config: Extract<CreatorAuthConfig, { mode: "dev" }>,
  slot: "primary" | "secondary",
): string | undefined {
  if (slot === "primary") return config.devCreatorId;
  return config.devCreatorIdSecondary;
}

export function isDevCreatorAuthAllowedInRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isExternalAuthModeSelected(): boolean {
  return readAuthMode() === "external";
}
