"use client";

import { useState } from "react";
import type { ShareCapabilityMetadata } from "../../share/types.js";
import {
  issueShareCapabilityAction,
  listShareCapabilitiesAction,
  revokeShareCapabilityAction,
} from "../../application/share-actions.js";

type Props = {
  handoffId: string;
  version: number;
  initialCapabilities: ShareCapabilityMetadata[];
};

export function ShareCapabilityPanel({ handoffId, version, initialCapabilities }: Props) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [issuedNotice, setIssuedNotice] = useState<string | null>(null);

  async function refreshList() {
    const result = await listShareCapabilitiesAction({ handoffId, version });
    if (result.ok) setCapabilities(result.capabilities);
  }

  async function onCreate() {
    setPending(true);
    setError(null);
    setIssuedLink(null);
    setIssuedNotice(null);
    const result = await issueShareCapabilityAction({ handoffId, version });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const absolute =
      typeof window !== "undefined" ? `${window.location.origin}${result.sharePath}` : result.sharePath;
    setIssuedLink(absolute);
    setIssuedNotice(
      `Share link created for version ${version}. This link will always remain on version ${version}. The share secret is shown only once; if it is lost, create a new link and revoke the old one if needed.`,
    );
    setCapabilities((current) => [...current, result.capability]);
  }

  async function onRevoke(capabilityId: string) {
    setPending(true);
    setError(null);
    const result = await revokeShareCapabilityAction({ capabilityId });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await refreshList();
  }

  async function onCopy() {
    if (!issuedLink || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(issuedLink);
  }

  return (
    <section className="panel panel-share">
      <h3>Share capability (development)</h3>
      <p className="receiver-notice">
        This is not production-safe public sharing. Share controls are not protected by Creator login in this milestone.
      </p>
      <button type="button" onClick={onCreate} disabled={pending}>
        {pending ? "Working…" : "Create share link"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {issuedNotice ? <p>{issuedNotice}</p> : null}
      {issuedLink ? (
        <p>
          New share link: <code>{issuedLink}</code>{" "}
          <button type="button" onClick={onCopy}>
            Copy share link
          </button>
        </p>
      ) : null}
      <ul>
        {capabilities.map((capability) => (
          <li key={capability.id}>
            <code>{capability.id.slice(0, 12)}…</code> · v{capability.version} · created{" "}
            {new Date(capability.createdAt).toLocaleString()} ·{" "}
            {capability.revokedAt ? `revoked ${new Date(capability.revokedAt).toLocaleString()}` : "active"}
            {!capability.revokedAt ? (
              <>
                {" "}
                <button type="button" onClick={() => onRevoke(capability.id)} disabled={pending}>
                  Revoke
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
