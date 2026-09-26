export type CreatorAuthMode = "disabled" | "dev";

const MIN_SESSION_SECRET_LENGTH = 32;

export type CreatorAuthConfig =
  | { mode: "disabled" }
  | {
      mode: "dev";
      devCreatorId: string;
      devCreatorIdSecondary?: string;
      sessionSecret: string;
      sessionTtlMs: number;
    };

export function readCreatorAuthConfig(): CreatorAuthConfig {
  const mode = (process.env.CREATOR_AUTH_MODE ?? "disabled") as CreatorAuthMode;
  if (mode === "disabled") {
    return { mode: "disabled" };
  }
  if (mode !== "dev") {
    throw new Error(`Unsupported CREATOR_AUTH_MODE: ${mode}`);
  }
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

export function resolveDevCreatorId(config: Extract<CreatorAuthConfig, { mode: "dev" }>, slot: "primary" | "secondary"): string | undefined {
  if (slot === "primary") return config.devCreatorId;
  return config.devCreatorIdSecondary;
}

export function isDevCreatorAuthAllowedInRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}
