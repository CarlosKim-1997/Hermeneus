import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), release: vi.fn(), on: vi.fn(), config: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: class {
  constructor(config: unknown) { mocks.config(config); }
  connect = mocks.connect;
  on = mocks.on;
} } }));

describe("application readiness fail-closed probe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("CREATOR_AUTH_MODE", "dev");
    vi.stubEnv("DEV_CREATOR_ID", "synthetic");
    vi.stubEnv("CREATOR_SESSION_SECRET", "synthetic-session-secret-at-least-32-chars");
    vi.stubEnv("DATABASE_URL", "postgresql://synthetic:synthetic@localhost/test");
    vi.stubEnv("NODE_ENV", "test");
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
    mocks.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["disabled", "invalid", "external"])("fails without usable %s auth and never connects", async (mode) => {
    vi.stubEnv("CREATOR_AUTH_MODE", mode);
    vi.stubEnv("AUTH_SECRET", "");
    const { isApplicationReady } = await import("../src/application/readiness.js");
    expect(await isApplicationReady()).toBe(false);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("rejects development auth in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { isApplicationReady } = await import("../src/application/readiness.js");
    expect(await isApplicationReady()).toBe(false);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("reports a read-only complete schema and releases the clean connection", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("AS ready") ? [{ ready: true }] : [] }));
    const { isApplicationReady } = await import("../src/application/readiness.js");
    expect(await isApplicationReady()).toBe(true);
    expect(mocks.query.mock.calls[0][0]).toBe("BEGIN READ ONLY");
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(mocks.release).toHaveBeenCalledWith(false);
    expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ max: 1, connectionTimeoutMillis: 1500, query_timeout: 2500 }));
  });
  it("handles unreachable DB without exposing the connection error", async () => {
    mocks.connect.mockRejectedValue(new Error("private credentials and hostname"));
    const { isApplicationReady } = await import("../src/application/readiness.js");
    expect(await isApplicationReady()).toBe(false);
  });
  it("discards a failed/timed-out transaction instead of reusing it", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("AS ready")) throw new Error("timeout or private SQL error");
      return { rows: [] };
    });
    const { isApplicationReady } = await import("../src/application/readiness.js");
    expect(await isApplicationReady()).toBe(false);
    expect(mocks.release).toHaveBeenCalledWith(true);
    expect(mocks.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
  });
});
