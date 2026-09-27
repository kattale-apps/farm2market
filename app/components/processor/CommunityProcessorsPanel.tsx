"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { card, input, button, StatusPill, Notice, errorText } from "../exportMarkets/ui";

/**
 * Community admin: accept processors who joined (step 1 of 3). Accepting opens
 * their processor dashboard; a Storage and Transport Officer then checks the facility and a
 * super admin completes verification.
 */
export function CommunityProcessorsPanel({ adminId, communityId, today }: { adminId: Id<"users">; communityId: Id<"communities">; today: string }) {
  const rows = useQuery(api.processors.listCommunityProcessors, { adminId, communityId, today });
  const admit = useMutation(api.processors.admitProcessor);
  const revoke = useMutation(api.processors.revokeProcessor);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: "#6d4c00" }}>🏭 Processors in this community</h2>
      <p style={{ fontSize: "0.85rem", color: "#607d8b", marginTop: 0 }}>
        Step 1 of 3: accept processors who joined. This opens their processor dashboard. A Storage and Transport Officer then approves their facility, storage
        and documents, and a super admin completes verification.
      </p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {rows === undefined ? (
        <div>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: "0.9rem" }}>No processors have joined this community yet.</div>
      ) : (
        rows.map((r) => (
          <div key={r.userId} style={{ borderTop: "1px solid #eee", padding: "0.65rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <b>
                Processor {r.alias}
                {r.facilityName ? ` · ${r.facilityName}` : ""}
                {r.district ? ` · ${r.district}` : ""}
              </b>
              <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                {r.admitted ? <StatusPill state="verified" /> : <StatusPill state="pending" />}
                {r.platformVerified && <span style={{ fontSize: "0.75rem", color: "#1b5e20", fontWeight: 700 }}>✔ verified</span>}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#607d8b" }}>
              {r.phoneNumber ?? ""} · profile: {r.profileStatus ?? "not started"}
              {r.isActiveProcessor ? " · live" : ""}
            </div>
            {!r.admitted ? (
              <button style={{ ...button("primary", busy === r.userId), marginTop: "0.4rem" }} disabled={busy === r.userId} onClick={() => run(r.userId, () => admit({ adminId, communityId, processorId: r.userId }), `Processor ${r.alias} accepted.`)}>
                Accept as processor
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <input style={{ ...input, maxWidth: 260 }} placeholder="Reason (to remove access)" value={reason[r.userId] ?? ""} onChange={(e) => setReason({ ...reason, [r.userId]: e.target.value })} />
                <button
                  style={button("danger", busy === r.userId)}
                  disabled={busy === r.userId}
                  onClick={() => run(r.userId, () => revoke({ adminId, communityId, processorId: r.userId, reason: reason[r.userId] ?? "" }), "Processor access removed.")}
                >
                  Remove access
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
