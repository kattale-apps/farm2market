"use client";

export const dynamic = "force-dynamic";

/**
 * Crop check (Diagnostics phase 1, free option).
 *
 * Picture-first for low-literacy use: tap the crop, optionally take a photo,
 * tap what you see. Matching runs on the phone against the approved library
 * (cached for offline use), so the scorecard appears with no network. The
 * check is saved to the server when online, or kept on the phone - photo
 * included - and sent automatically when the network returns.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { useNetwork } from "@/app/context/NetworkContext";
import { offlineDb, type DiagnosticDraftEntry } from "@/app/lib/offlineDb";
import { compressImage, uploadToConvex } from "@/app/utils/imageCompress";
import { formatUgandaDateTime, getUgandaTime } from "@/app/utils/timeUtils";
import {
  DIAGNOSTIC_HOSTS,
  SYMPTOMS,
  healthLevel as scoreHealth,
  rankMatches,
  type HealthLevel,
} from "@/convex/diagnosticsRules";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

type Step = "crop" | "photo" | "symptoms" | "result";

const HEALTH: Record<HealthLevel, { emoji: string; title: string; hint: string; bg: string; color: string }> = {
  healthy: { emoji: "✅", title: "Looks healthy", hint: "Keep checking your crop every week.", bg: "#dcfce7", color: "#166534" },
  likely: { emoji: "🔴", title: "Likely problem", hint: "Look at the photos below. If they match, follow the advice.", bg: "#fee2e2", color: "#991b1b" },
  possible: { emoji: "🟠", title: "Possible problem", hint: "Compare the photos below with your crop.", bg: "#ffedd5", color: "#9a3412" },
  unsure: { emoji: "❔", title: "Not sure", hint: "Show your crop to your agent or extension officer.", bg: "#fef9c3", color: "#854d0e" },
};

const TREATMENT_GROUPS = [
  { kind: "cultural", emoji: "🌱", label: "On the farm" },
  { kind: "organic", emoji: "🍃", label: "Natural" },
  { kind: "chemical", emoji: "🧪", label: "Chemical" },
] as const;

function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Reading aloud is a convenience; never let it break the page.
  }
}

const bigTile = (selected: boolean): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 96,
  padding: "0.75rem 0.5rem",
  borderRadius: 14,
  border: selected ? `3px solid ${BRAND}` : "2px solid #e5e7eb",
  background: selected ? "#f0fdf4" : "#fff",
  fontFamily: FONT,
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#111827",
  cursor: "pointer",
  textAlign: "center",
});

const primaryButton: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  borderRadius: 14,
  border: "none",
  background: BRAND,
  color: "#fff",
  fontFamily: FONT,
  fontSize: "1.05rem",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#fff",
  color: "#111827",
  border: "2px solid #d1d5db",
};

type LibraryCondition = {
  id: string;
  name: string;
  underReview: boolean;
  sourceName: string;
  treatments: { kind: string; text: string; sourceName: string; sourceUrl?: string }[];
  photos: { thumbUrl: string; sourceName: string; licence: string }[];
};

function MatchCard({
  condition,
  percent,
  highlight,
  caption,
}: {
  condition: LibraryCondition;
  percent: number;
  highlight: boolean;
  caption: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "0.9rem", marginBottom: 10, border: highlight ? `2px solid ${BRAND}` : "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: "1.05rem" }}>{condition.name}</strong>
        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: BRAND }}>{percent}%</span>
      </div>
      <div style={{ height: 10, background: "#e5e7eb", borderRadius: 999, margin: "6px 0 2px", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: BRAND }} />
      </div>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 8 }}>{caption}</div>
      {condition.underReview && (
        <div style={{ fontSize: "0.8rem", color: "#9a3412", marginBottom: 6 }}>⚠ This entry is being reviewed</div>
      )}

      {condition.photos.length > 0 && (
        <>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Does it look like this?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 8 }}>
            {condition.photos.map((p) => (
              <figure key={p.thumbUrl} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt={condition.name} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10 }} />
                <figcaption style={{ fontSize: "0.65rem", color: "#6b7280" }}>
                  {p.sourceName} · {p.licence}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {TREATMENT_GROUPS.map((g) => {
        const items = condition.treatments.filter((t) => t.kind === g.kind);
        if (items.length === 0) return null;
        return (
          <div key={g.kind} style={{ marginTop: 6 }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
              {g.emoji} {g.label}
            </div>
            {items.map((t, idx) => (
              <div key={idx} style={{ fontSize: "0.9rem", margin: "2px 0 4px" }}>
                {t.text}
                <div style={{ fontSize: "0.68rem", color: "#6b7280" }}>
                  Source:{" "}
                  {t.sourceUrl ? (
                    <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
                      {t.sourceName}
                    </a>
                  ) : (
                    t.sourceName
                  )}
                </div>
              </div>
            ))}
            {g.kind === "chemical" && (
              <div style={{ fontSize: "0.8rem", background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "4px 8px" }}>
                ⚠️ Ask your agent or agro-dealer before buying. Wear protection and follow the label.
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: "0.68rem", color: "#6b7280", marginTop: 6 }}>
        About this: {condition.sourceName}
      </div>
    </div>
  );
}

/**
 * The community's paid AI photo check. It runs on the server after the check
 * is saved; the result appears here when ready. Matches are library entries,
 * so the advice shown is the library's.
 */
function AiPhotoCheck({
  userId,
  reportId,
  conditions,
}: {
  userId: Id<"users">;
  reportId: Id<"diagnosticReports">;
  conditions: LibraryCondition[];
}) {
  const ai = useQuery(api.diagnosticsAi.getReportAi, { userId, reportId });
  if (!ai || !ai.aiStatus || ai.aiStatus === "failed") return null;

  return (
    <div style={{ background: "#eef2ff", borderRadius: 16, padding: "0.9rem", margin: "12px 0" }}>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#3730a3", marginBottom: 6 }}>🤖 Photo check</div>
      {ai.aiStatus === "queued" ? (
        <div style={{ fontSize: "0.95rem", color: "#3730a3" }}>Checking your photo…</div>
      ) : ai.aiPhotoUsable === false ? (
        <div style={{ fontSize: "0.95rem" }}>📷 The photo is not clear. Take a closer photo of the sick part, in daylight.</div>
      ) : (
        <>
          {ai.aiHealthLevel && (
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: HEALTH[ai.aiHealthLevel].color, marginBottom: 8 }}>
              {HEALTH[ai.aiHealthLevel].emoji} {HEALTH[ai.aiHealthLevel].title}
            </div>
          )}
          {ai.aiResults.map((r, i) => {
            const condition = conditions.find((c) => c.id === r.id);
            if (!condition) return null;
            return <MatchCard key={r.id} condition={condition} percent={r.percent} highlight={i === 0} caption="match with your photo" />;
          })}
        </>
      )}
    </div>
  );
}

export default function CropCheckPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId || null) as Id<"users"> | null;
  const { isOnline } = useNetwork();

  const library = useOfflineQuery(
    api.diagnosticsFarmer.getCheckLibrary,
    userId && communityId ? { userId, communityId } : "skip"
  );
  const history = useOfflineQuery(
    api.diagnosticsFarmer.listMyReports,
    userId && communityId ? { userId, communityId } : "skip"
  );

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveReport = useMutation(api.diagnosticsFarmer.saveReport);
  const setFeedback = useMutation(api.diagnosticsFarmer.setReportFeedback);
  const requestAiCheck = useMutation(api.diagnosticsAi.requestAiCheck);

  const [step, setStep] = useState<Step>("crop");
  const [host, setHost] = useState<string>("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<Id<"diagnosticReports"> | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const [unsentCount, setUnsentCount] = useState(0);

  // ── Sending checks (now, or later from the phone's queue) ────────────────
  const sendDraft = useCallback(
    async (draft: DiagnosticDraftEntry) => {
      let photoStorageId: Id<"_storage"> | undefined;
      if (draft.photo) {
        photoStorageId = (await uploadToConvex(await generateUploadUrl(), draft.photo)) as Id<"_storage">;
      }
      const saved = await saveReport({
        userId: draft.userId as Id<"users">,
        communityId: draft.communityId as Id<"communities">,
        clientId: draft.clientId,
        host: draft.host,
        symptomTags: draft.symptomTags,
        photoStorageId,
        checkedAt: draft.checkedAt,
      });
      if (photoStorageId) {
        // The server only queues it when the community switched AI on and is under its monthly limit.
        try {
          await requestAiCheck({ userId: draft.userId as Id<"users">, reportId: saved.reportId });
        } catch {
          // The symptom result stands on its own.
        }
      }
      return saved;
    },
    [generateUploadUrl, saveReport, requestAiCheck]
  );

  const refreshUnsent = useCallback(async () => {
    if (!userId) return;
    try {
      setUnsentCount(await offlineDb.diagnosticDrafts.where("userId").equals(String(userId)).count());
    } catch {
      setUnsentCount(0);
    }
  }, [userId]);

  useEffect(() => {
    if (!isOnline || !userId) {
      void refreshUnsent();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const drafts = await offlineDb.diagnosticDrafts.where("userId").equals(String(userId)).toArray();
        for (const draft of drafts) {
          if (cancelled) break;
          try {
            await sendDraft(draft);
            await offlineDb.diagnosticDrafts.delete(draft.clientId);
          } catch (err: any) {
            await offlineDb.diagnosticDrafts.update(draft.clientId, { status: "failed", errorMsg: String(err?.message || err) });
          }
        }
      } catch {
        // IndexedDB unavailable (private mode): nothing was queued.
      }
      if (!cancelled) void refreshUnsent();
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, userId, sendDraft, refreshUnsent]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // ── Matching on the phone ─────────────────────────────────────────────────
  const conditions = useMemo(() => (library && library.enabled ? library.conditions : []), [library]);
  const hostConditions = useMemo(() => conditions.filter((c) => c.hosts.includes(host)), [conditions, host]);
  const results = useMemo(() => {
    if (step !== "result") return [];
    return rankMatches(
      hostConditions.map((c) => ({ id: c.id, symptomTags: c.symptomTags })),
      symptoms
    ).map((r) => ({ ...r, condition: hostConditions.find((c) => c.id === r.id)! }));
  }, [step, hostConditions, symptoms]);
  const level = scoreHealth(symptoms, results);

  const reset = () => {
    setStep("crop");
    setHost("");
    setPhoto(null);
    setPhotoUrl(null);
    setSymptoms([]);
    setSaveState("idle");
    setSaveError(null);
    setReportId(null);
    setFeedbackGiven(null);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      // ~800px JPEG: small enough to send on a weak signal.
      const small = await compressImage(file, 800, 0.72);
      setPhoto(small);
      setPhotoUrl(URL.createObjectURL(small));
    } catch {
      setPhoto(null);
    }
    setStep("symptoms");
  };

  const runCheck = async () => {
    setStep("result");
    if (!userId || !communityId) return;
    const draft: DiagnosticDraftEntry = {
      clientId: newClientId(),
      userId: String(userId),
      communityId: String(communityId),
      host,
      symptomTags: symptoms,
      checkedAt: getUgandaTime(),
      photo: photo ?? undefined,
      status: "pending",
    };
    const queue = async () => {
      try {
        await offlineDb.diagnosticDrafts.put(draft);
        setSaveState("queued");
        void refreshUnsent();
      } catch {
        setSaveState("error");
        setSaveError("Could not keep this check on the phone.");
      }
    };
    if (!isOnline) {
      await queue();
      return;
    }
    setSaveState("saving");
    try {
      const saved = await sendDraft(draft);
      setReportId(saved.reportId);
      setSaveState("saved");
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/a day/.test(msg)) {
        setSaveState("error");
        setSaveError(msg.replace(/^.*Uncaught Error:\s*/, "").split("\n")[0]);
      } else {
        // Weak signal: keep it and send later.
        await queue();
      }
    }
  };

  const readAloud = () => {
    const h = HEALTH[level];
    const parts = [h.title + ".", h.hint];
    const top = results[0];
    if (top && level !== "unsure") {
      parts.push(`It may be ${top.condition.name}.`);
      for (const t of top.condition.treatments.slice(0, 3)) parts.push(t.text);
    }
    speak(parts.join(" "));
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!communityId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>No community selected.</p>
        <Link href="/my-communities" style={{ color: BRAND }}>Back to Communities</Link>
      </div>
    );
  }
  if (authStatus === "loading") {
    return <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>Loading…</div>;
  }
  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: BRAND }}>Go to Login</Link>
      </div>
    );
  }

  const back =
    searchParams.get("from") === "farm-needs"
      ? "/farmer/farm-needs"
      : `/community-only/trackers?communityId=${communityId}`;

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "6rem", background: "#f9fafb", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)", padding: "1rem", color: "#fff" }}>
        <Link href={back} style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem" }}>← Back</Link>
        <h1 style={{ margin: "0.4rem 0 0", fontSize: "1.35rem" }}>🔬 Check my crop</h1>
        {!isOnline && (
          <div style={{ marginTop: 6, fontSize: "0.85rem", background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 8px", display: "inline-block" }}>
            📴 No network - the check still works
          </div>
        )}
      </div>

      <div style={{ padding: "1rem", maxWidth: 560, margin: "0 auto" }}>
        {unsentCount > 0 && (
          <div style={{ background: "#e0f2fe", color: "#075985", borderRadius: 10, padding: "0.6rem 0.8rem", marginBottom: 12, fontSize: "0.9rem" }}>
            📤 {unsentCount} check{unsentCount > 1 ? "s" : ""} waiting to send. {isOnline ? "Sending…" : "Will send when you have network."}
          </div>
        )}

        {library === undefined ? (
          <p style={{ textAlign: "center", color: "#6b7280" }}>Loading…</p>
        ) : !library.enabled ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "1rem" }}>Crop check is not available in this community.</p>
            <Link href={back} style={{ color: BRAND, fontWeight: 700 }}>Go back</Link>
          </div>
        ) : step === "crop" ? (
          <>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.75rem" }}>1. Which crop?</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {DIAGNOSTIC_HOSTS.map((h) => (
                <button
                  key={h.key}
                  onClick={() => {
                    setHost(h.key);
                    setStep("photo");
                  }}
                  style={bigTile(host === h.key)}
                >
                  <span style={{ fontSize: "2.4rem" }}>{h.emoji}</span>
                  {h.label}
                </button>
              ))}
            </div>
          </>
        ) : step === "photo" ? (
          <>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.75rem" }}>2. Take a photo of the sick part</h2>
            <label style={{ ...bigTile(false), minHeight: 160, marginBottom: 10 }}>
              <span style={{ fontSize: "3rem" }}>📷</span>
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPhoto(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </label>
            <button onClick={() => setStep("symptoms")} style={secondaryButton}>
              Skip photo →
            </button>
          </>
        ) : step === "symptoms" ? (
          <>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.25rem" }}>3. What do you see?</h2>
            <p style={{ margin: "0 0 0.75rem", color: "#4b5563", fontSize: "0.9rem" }}>Tap all that you see.</p>
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your crop" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => setSymptoms(on ? symptoms.filter((k) => k !== s.key) : [...symptoms, s.key])}
                    style={{ ...bigTile(on), minHeight: 84 }}
                    aria-pressed={on}
                  >
                    <span style={{ fontSize: "1.8rem" }}>{s.emoji}</span>
                    <span style={{ fontSize: "0.82rem" }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={runCheck} style={primaryButton}>
              {symptoms.length === 0 ? "✅ Nothing wrong - finish" : `🔍 Check (${symptoms.length})`}
            </button>
          </>
        ) : (
          <>
            <div style={{ background: HEALTH[level].bg, color: HEALTH[level].color, borderRadius: 16, padding: "1rem", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "2.4rem" }}>{HEALTH[level].emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{HEALTH[level].title}</div>
                  <div style={{ fontSize: "0.9rem" }}>{HEALTH[level].hint}</div>
                </div>
                <button
                  onClick={readAloud}
                  aria-label="Read aloud"
                  style={{ width: 48, height: 48, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.7)", fontSize: "1.4rem", cursor: "pointer" }}
                >
                  🔊
                </button>
              </div>
            </div>

            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your crop" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
            )}

            {level !== "healthy" && results.length === 0 && (
              <p style={{ background: "#fff", borderRadius: 12, padding: "0.8rem", fontSize: "0.95rem" }}>
                Nothing in the library matches these signs yet.
              </p>
            )}

            {level !== "healthy" &&
              results.map((r, i) => (
                <MatchCard key={r.id} condition={r.condition} percent={r.percent} highlight={i === 0} caption="match with the signs you tapped" />
              ))}

            {reportId && photo && library.aiAvailable && (
              <AiPhotoCheck userId={userId} reportId={reportId} conditions={hostConditions} />
            )}

            <div style={{ fontSize: "0.85rem", color: "#4b5563", textAlign: "center", margin: "8px 0 12px" }}>
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "✓ Saved"}
              {saveState === "queued" && "📤 Kept on your phone. It will send when you have network."}
              {saveState === "error" && `⚠ ${saveError ?? "Not saved"}`}
            </div>

            {reportId && level !== "healthy" && results.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "0.8rem", marginBottom: 12, textAlign: "center" }}>
                {feedbackGiven ? (
                  <div style={{ fontSize: "0.95rem" }}>Thank you!</div>
                ) : (
                  <>
                    <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Was this right?</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      {([
                        ["right", "👍"],
                        ["wrong", "👎"],
                        ["unsure", "🤷"],
                      ] as const).map(([value, emoji]) => (
                        <button
                          key={value}
                          aria-label={value}
                          onClick={async () => {
                            setFeedbackGiven(value);
                            try {
                              await setFeedback({ userId, reportId, feedback: value });
                            } catch {
                              // Feedback is best-effort.
                            }
                          }}
                          style={{ width: 64, height: 56, borderRadius: 12, border: "2px solid #e5e7eb", background: "#fff", fontSize: "1.6rem", cursor: "pointer" }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <button onClick={reset} style={primaryButton}>
              🔁 Check another crop
            </button>
          </>
        )}

        {step === "crop" && Array.isArray(history) && history.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>My checks</h3>
            {history.map((h) => {
              const hostInfo = DIAGNOSTIC_HOSTS.find((x) => x.key === h.host);
              return (
                <div key={h._id} style={{ background: "#fff", borderRadius: 12, padding: "0.6rem 0.8rem", marginBottom: 6, display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: "1.6rem" }}>{HEALTH[h.healthLevel].emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {hostInfo?.emoji} {hostInfo?.label ?? h.host} · {h.topMatch && h.healthLevel !== "unsure" ? `${h.topMatch.name} (${h.topMatch.percent}%)` : HEALTH[h.healthLevel].title}
                    </div>
                    {h.aiTopMatch?.name && (
                      <div style={{ fontSize: "0.78rem", color: "#3730a3" }}>
                        🤖 {h.aiTopMatch.name} ({h.aiTopMatch.percent}%)
                      </div>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{formatUgandaDateTime(h.checkedAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityTabBar />
    </div>
  );
}
