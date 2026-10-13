import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/application/readiness.js", () => ({ isApplicationReady: vi.fn() }));
import { isApplicationReady } from "../src/application/readiness.js";
import { GET } from "../src/app/api/ready/route.js";

describe("readiness HTTP contract", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns an uncached positive probe", async () => {
    vi.mocked(isApplicationReady).mockResolvedValue(true);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns generic 503 and retry guidance without infrastructure details", async () => {
    vi.mocked(isApplicationReady).mockResolvedValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("retry-after")).toBe("5");
  });
});
