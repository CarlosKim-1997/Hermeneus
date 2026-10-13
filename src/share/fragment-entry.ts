export type ShareFragmentState<View> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; token: string; view: View };

type FragmentBrowser = {
  location: Pick<Location, "hash" | "pathname" | "search">;
  history: Pick<History, "state" | "replaceState">;
  addEventListener(type: "hashchange", listener: (event: Pick<HashChangeEvent, "newURL">) => void): void;
  removeEventListener(type: "hashchange", listener: (event: Pick<HashChangeEvent, "newURL">) => void): void;
};

/** Consume initial and same-document Share links before requesting any data. */
export function bindShareFragment<View>(
  browser: FragmentBrowser,
  tokenRef: { current: string | null },
  load: (token: string) => Promise<View | undefined>,
  update: (entry: ShareFragmentState<View>) => void,
): () => void {
  let active = true;
  let requestVersion = 0;

  function consume(initial = false) {
    const fragment = browser.location.hash.slice(1);
    if (fragment) tokenRef.current = fragment;
    else if (!initial) tokenRef.current = null;
    // replaceState does not fire hashchange. Preserve router state, path and query.
    browser.history.replaceState(browser.history.state, "", browser.location.pathname + browser.location.search);
    const token = tokenRef.current;
    const version = ++requestVersion;
    if (!token) {
      update({ status: "unavailable" });
      return;
    }
    update({ status: "loading" });
    load(token)
      .then((view) => {
        if (active && version === requestVersion) {
          update(view ? { status: "ready", token, view } : { status: "unavailable" });
        }
      })
      .catch(() => {
        if (active && version === requestVersion) update({ status: "unavailable" });
      });
  }

  const onHashChange = (event: Pick<HashChangeEvent, "newURL">) => {
    let target: URL;
    try { target = new URL(event.newURL); } catch { return; }
    // Removing the fragment is URL sanitization, not capability revocation.
    // Empty events can predate mounting and match our sanitized URL; they
    // must not discard the capability already consumed into memory.
    if (!target.hash) return;
    // Hashchange events are queued. Ignore an obsolete event, including one
    // queued before initial loading already consumed and cleared its fragment.
    if (target.pathname !== browser.location.pathname || target.search !== browser.location.search || target.hash !== browser.location.hash) return;
    consume();
  };
  browser.addEventListener("hashchange", onHashChange);
  // Keep the consumed token only for React's development effect replay.
  consume(true);
  return () => {
    active = false;
    browser.removeEventListener("hashchange", onHashChange);
  };
}
