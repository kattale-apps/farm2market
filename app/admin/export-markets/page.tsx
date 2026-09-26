"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { FONT, button, Notice, PageHeader } from "../../components/exportMarkets/ui";
import { AdminDealsPanel, AdminTracePanel, AdminPipelinePanel, AdminPricesPanel } from "../../components/exportMarkets/AdminExportPanels";
import { Applications, Documents, Members, DocumentTypes } from "../../components/exportMarkets/AdminExporterPanels";

type Tab = "applications" | "documents" | "members" | "deals" | "trace" | "types" | "pipeline" | "prices";
type Msg = { tone: "error" | "success" | "info"; text: string } | null;

export default function ExportMarketsAdminPage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [tab, setTab] = useState<Tab>("applications");
  const [msg, setMsg] = useState<Msg>(null);
  const mine = useQuery(api.exportMarkets.listMyExportCommunities, adminId ? { adminId } : "skip");

  if (authStatus === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!user || user.role !== "admin" || !adminId) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Admin access required.</div>;
  }

  const tabs: [Tab, string][] = [
    ["applications", "Exporter applications"],
    ["documents", "Documents to review"],
    ["deals", "Deals, KYC & samples"],
    ["trace", "Trace evidence"],
    ["members", "Community members"],
    ...(mine?.isSuperAdmin
      ? ([
          ["types", "Document types"],
          ["pipeline", "Order pipeline"],
          ["prices", "Reference prices"],
        ] as [Tab, string][])
      : []),
  ];

  return (
    <div style={{ padding: "1rem", maxWidth: 980, margin: "0 auto", fontFamily: FONT }}>
      <PageHeader
        title="Export Markets — Admin"
        backHref="/"
        subtitle="Add verified traders to exporter communities, verify documents, approve exporters, verify trace evidence, run the sample desk and follow deals. A super admin switches Export Markets on for a community in its dashboard settings. Export fees live in Finance."
      />

      {mine && mine.communities.length === 0 && (
        <Notice tone="info">
          No exporter community is set up yet. A super admin ticks &quot;Exporter community&quot; for a community in the community dashboard.
        </Notice>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {tabs.map(([key, text]) => (
          <button key={key} onClick={() => setTab(key)} style={button(tab === key ? "primary" : "secondary")}>
            {text}
          </button>
        ))}
      </div>

      {tab === "applications" && <Applications adminId={adminId} today={today} setMsg={setMsg} />}
      {tab === "documents" && <Documents adminId={adminId} today={today} setMsg={setMsg} />}
      {tab === "members" && mine && <Members adminId={adminId} today={today} communities={mine.communities} setMsg={setMsg} />}
      {tab === "types" && mine?.isSuperAdmin && <DocumentTypes adminId={adminId} setMsg={setMsg} />}
      {tab === "deals" && <AdminDealsPanel adminId={adminId} setMsg={setMsg} />}
      {tab === "trace" && <AdminTracePanel adminId={adminId} setMsg={setMsg} />}
      {tab === "pipeline" && mine?.isSuperAdmin && <AdminPipelinePanel adminId={adminId} setMsg={setMsg} />}
      {tab === "prices" && mine?.isSuperAdmin && <AdminPricesPanel adminId={adminId} setMsg={setMsg} />}
    </div>
  );
}
