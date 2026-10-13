import { describe, expect, it, vi } from "vitest";
import { bindShareFragment, type ShareFragmentState } from "../src/share/fragment-entry.js";

function browserFixture(hash = "") {
  type FragmentEvent = Pick<HashChangeEvent, "newURL">;
  const listeners = new Set<(event: FragmentEvent) => void>();
  const queued: FragmentEvent[] = [];
  const routerState = { router: "preserved" };
  const browser = {
    location: { hash, pathname: "/share", search: "?synthetic=1" },
    history: {
      state: routerState,
      replaceState: vi.fn((_state: unknown, _unused: string, _url?: string | URL | null) => {
        browser.location.hash = "";
      }),
    },
    addEventListener: (_type: "hashchange", listener: (event: FragmentEvent) => void) => { listeners.add(listener); },
    removeEventListener: (_type: "hashchange", listener: (event: FragmentEvent) => void) => { listeners.delete(listener); },
  };
  return { browser, navigate(fragment: string, queue = false) {
    browser.location.hash = fragment;
    const event = { newURL: `https://synthetic.invalid/share?synthetic=1${fragment}` };
    if (queue) queued.push(event);
    else for (const listener of listeners) listener(event);
  }, dispatchQueued() {
    for (const event of queued.splice(0)) for (const listener of listeners) listener(event);
  } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("Share fragment navigation boundary", () => {
  it("coalesces queued navigations to the newest link without invalidating it", async () => {
    const { browser, navigate, dispatchQueued } = browserFixture();
    const load = vi.fn(async (token: string) => token);
    const update = vi.fn();
    const stop = bindShareFragment(browser, { current: null }, load, update);
    navigate("#synthetic-first", true);
    navigate("#synthetic-newest", true);
    dispatchQueued();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("synthetic-newest");
    expect(browser.location.hash).toBe("");
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-newest", view: "synthetic-newest" });
    stop();
  });

  it("ignores a queued initial hash event after mounting already consumed the link", async () => {
    const { browser, navigate, dispatchQueued } = browserFixture();
    navigate("#synthetic-initial", true);
    const load = vi.fn(async () => "initial view");
    const update = vi.fn();
    const stop = bindShareFragment(browser, { current: null }, load, update);
    dispatchQueued();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-initial", view: "initial view" });
    stop();
  });

  it("consumes a link supplied after an empty page mount before calling the server", async () => {
    const { browser, navigate } = browserFixture();
    const update = vi.fn();
    const load = vi.fn(async (token: string) => {
      expect(browser.location.hash).toBe("");
      expect(browser.history.replaceState).toHaveBeenLastCalledWith(browser.history.state, "", "/share?synthetic=1");
      return { tokenTarget: token };
    });
    const stop = bindShareFragment(browser, { current: null }, load, update);
    expect(update).toHaveBeenLastCalledWith({ status: "unavailable" });
    expect(load).not.toHaveBeenCalled();
    navigate("#synthetic-first");
    await flush();
    expect(load).toHaveBeenCalledWith("synthetic-first");
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-first", view: { tokenTarget: "synthetic-first" } });
    stop();
  });

  it("retains a consumed initial token across effect replay without publishing the first request", async () => {
    const { browser } = browserFixture("#synthetic-replay");
    const ref = { current: null as string | null };
    const first = deferred<string | undefined>();
    const second = deferred<string | undefined>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const update = vi.fn();
    const stopFirst = bindShareFragment(browser, ref, load, update);
    stopFirst();
    const stopSecond = bindShareFragment(browser, ref, load, update);
    second.resolve("current");
    await flush();
    first.resolve("stale");
    await flush();
    expect(load.mock.calls.map(([token]) => token)).toEqual(["synthetic-replay", "synthetic-replay"]);
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-replay", view: "current" });
    stopSecond();
  });

  it.each(["success", "failure"])("ignores an older request's late %s after a new link arrives", async (outcome) => {
    const { browser, navigate } = browserFixture("#synthetic-old");
    const old = deferred<string | undefined>();
    const fresh = deferred<string | undefined>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const update = vi.fn<(state: ShareFragmentState<string>) => void>();
    const stop = bindShareFragment(browser, { current: null }, load, update);
    navigate("#synthetic-new");
    expect(update).toHaveBeenLastCalledWith({ status: "loading" });
    fresh.resolve("new view");
    await flush();
    if (outcome === "success") old.resolve("old view");
    else old.reject(new Error("old request failed"));
    await flush();
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-new", view: "new view" });
    stop();
  });

  it("ignores queued empty events preceding mount and fails closed for an unavailable capability", async () => {
    const { browser, navigate, dispatchQueued } = browserFixture("#synthetic-previous");
    navigate("", true);
    navigate("#synthetic-active", true);
    const pending = deferred<string | undefined>();
    const load = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined);
    const ref = { current: null as string | null };
    const update = vi.fn();
    const stop = bindShareFragment(browser, ref, load, update);
    dispatchQueued();
    pending.resolve("active view");
    await flush();
    expect(ref.current).toBe("synthetic-active");
    expect(update).toHaveBeenLastCalledWith({ status: "ready", token: "synthetic-active", view: "active view" });
    navigate("#synthetic-revoked");
    await flush();
    expect(update).toHaveBeenLastCalledWith({ status: "unavailable" });
    stop();
  });

  it("unsubscribes and discards an in-flight response on unmount", async () => {
    const { browser, navigate } = browserFixture("#synthetic-unmount");
    const pending = deferred<string | undefined>();
    const load = vi.fn(() => pending.promise);
    const update = vi.fn();
    const stop = bindShareFragment(browser, { current: null }, load, update);
    stop();
    pending.resolve("must not render");
    navigate("#synthetic-after-unmount");
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith({ status: "loading" });
  });
});
