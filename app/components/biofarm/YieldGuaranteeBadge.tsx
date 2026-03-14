"use client";

export function YieldGuaranteeBadge({
  guarantee,
  projectedYieldTons,
}: {
  guarantee?: {
    eligible: boolean;
    doseCompliant: boolean;
    scheduleCompliant: boolean;
    photosComplete: boolean;
    recordsComplete: boolean;
  } | null;
  projectedYieldTons?: number;
}) {
  if (!guarantee) {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: "0.75rem", background: "#fff" }}>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#666" }}>Yield guarantee will update after spray records are submitted.</p>
      </div>
    );
  }

  if (guarantee.eligible) {
    return (
      <div style={{ border: "1px solid #c8e6c9", borderRadius: 10, padding: "0.75rem", background: "#e8f5e9" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#1b5e20", fontSize: "0.9rem" }}>
          🌿 Bio Farm Yield Guarantee Active
        </p>
        {typeof projectedYieldTons === "number" && (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#2e7d32" }}>
            Projected harvest: {projectedYieldTons.toFixed(2)} tons
          </p>
        )}
      </div>
    );
  }

  const checklist = [
    { label: "Correct fertilizer dose", done: guarantee.doseCompliant },
    { label: "Schedule compliance", done: guarantee.scheduleCompliant },
    { label: "Required photos uploaded", done: guarantee.photosComplete },
    { label: "All spray records completed", done: guarantee.recordsComplete },
  ];

  return (
    <div style={{ border: "1px solid #ffe0b2", borderRadius: 10, padding: "0.75rem", background: "#fff8e1" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "#ef6c00", fontSize: "0.9rem" }}>
        Yield Guarantee In Progress
      </p>
      <div style={{ marginTop: "0.45rem", display: "grid", gap: "0.2rem" }}>
        {checklist.map((item) => (
          <div key={item.label} style={{ fontSize: "0.8rem", color: item.done ? "#2e7d32" : "#666" }}>
            {item.done ? "✅" : "❌"} {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
