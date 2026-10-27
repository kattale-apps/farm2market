"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDate } from "../../utils/timeUtils";
import { GoodsLabel } from "./GoodsLabel";

export type GoodsCodeSummary = { codeId: Id<"goodsCodes">; code: string; scanCount: number; uses: number };

const chip: React.CSSProperties = {
  minHeight: 40,
  padding: "0.35rem 0.8rem",
  borderRadius: 999,
  border: "1px solid #c8e6c9",
  background: "#f1f8e9",
  color: "#1b5e20",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
};

/**
 * The goods QR of a listing, batch or export lot, in the seller's own list:
 * the code and how often it was scanned. Opening it shows the QR to download
 * and print, and every listing the code has been on with its scans.
 */
export function GoodsQr({
  goodsCode,
  userId,
  sessionToken,
}: {
  goodsCode: GoodsCodeSummary | null | undefined;
  userId?: Id<"users">;
  sessionToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const view = useQuery(
    api.goodsCodes.ownerView,
    open && goodsCode && (userId || sessionToken) ? { codeId: goodsCode.codeId, userId, sessionToken: sessionToken ?? undefined } : "skip"
  );
  if (!goodsCode) return null;
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={chip}>
        ▦ QR {goodsCode.code} · {goodsCode.scanCount} scan{goodsCode.scanCount === 1 ? "" : "s"}
      </button>
      {open && (
        <div style={{ marginTop: "0.5rem", padding: "0.75rem", border: "1px solid #e0e0e0", borderRadius: 12, background: "#fff" }}>
          {view === undefined ? (
            <p style={{ fontSize: "0.85rem", color: "#777" }}>Loading…</p>
          ) : view === null ? null : (
            <>
              <GoodsLabel code={view.code} name={view.goodLabel} photoUrl={view.photoUrl} place={view.place} />
              <p style={{ fontSize: "0.85rem", color: "#444", margin: "0.5rem 0" }}>
                Print it on bags, crates or your stall. Anyone who scans it sees what this is and where it comes from. Use it again when you list the same good, so your printed labels keep working.
              </p>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                Scanned {view.scanCount} time{view.scanCount === 1 ? "" : "s"} · used {view.uses} time{view.uses === 1 ? "" : "s"}
                {view.lastScannedAt ? ` · last scan ${formatUgandaDate(view.lastScannedAt)}` : ""}
              </div>
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem", color: "#333" }}>
                {view.items.map((i) => (
                  <li key={i.targetId}>
                    {i.label} · {formatUgandaDate(i.createdAt)} · {i.scans > view.maxCounted ? `${view.maxCounted}+` : i.scans} scan{i.scans === 1 ? "" : "s"}
                    {i.current ? " (the QR opens this now)" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * On a new listing, batch or export lot: reuse the seller's QR for the same
 * good (printed labels keep working) or make a new one. Shows nothing until
 * the seller has a code for that good. Picks the latest code by itself when
 * it is free (its listing has ended); a code still on something selling is
 * offered but not picked.
 */
export function GoodsQrChooser({
  userId,
  goodLabel,
  value,
  onChange,
}: {
  userId: Id<"users"> | null | undefined;
  goodLabel: string;
  value: Id<"goodsCodes"> | "new" | undefined;
  onChange: (value: Id<"goodsCodes"> | "new" | undefined) => void;
}) {
  const label = goodLabel.trim();
  const codes = useQuery(api.goodsCodes.myCodesFor, userId && label ? { userId, goodLabel: label } : "skip");
  useEffect(() => {
    if (!codes) return;
    if (value === "new" || (value && codes.some((c) => c.codeId === value))) return;
    const latest = codes[0];
    const pick = latest && !latest.stillSelling ? latest.codeId : codes.length > 0 ? "new" : undefined;
    if (pick !== value) onChange(pick);
  }, [codes, value, onChange]);
  if (!codes || codes.length === 0) return null;
  const option = (selected: boolean): React.CSSProperties => ({
    ...chip,
    textAlign: "left",
    borderRadius: 12,
    border: `2px solid ${selected ? "#2e7d32" : "#ddd"}`,
    background: selected ? "#e8f5e9" : "#fff",
    color: "#222",
  });
  return (
    <div>
      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#333" }}>QR Code for Your Labels</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {codes.slice(0, 2).map((c) => (
          <button key={c.codeId} type="button" onClick={() => onChange(c.codeId)} style={option(value === c.codeId)}>
            Use {c.code} again
            <span style={{ display: "block", fontWeight: 400, fontSize: "0.8rem", color: "#555" }}>
              {c.scanCount} scan{c.scanCount === 1 ? "" : "s"} so far
              {c.stillSelling ? " · it is on a listing still selling: its labels will open this one" : ""}
            </span>
          </button>
        ))}
        <button type="button" onClick={() => onChange("new")} style={option(value === "new")}>
          New QR code
        </button>
      </div>
    </div>
  );
}

/** What to send for the chooser's value: the code to reuse, or nothing for a new code. */
export function reuseCodeOf(value: Id<"goodsCodes"> | "new" | undefined): Id<"goodsCodes"> | undefined {
  return value && value !== "new" ? value : undefined;
}
