"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { formatUgandaDateTime } from "../utils/timeUtils";

interface TraderListingsProps {
  userId: Id<"users">;
}

export function TraderListings({ userId }: TraderListingsProps) {
  const [offering, setOffering] = useState<{ listingId: Id<"listings"> } | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<Id<"listingUnits">>>(new Set());
  const [numUnits, setNumUnits] = useState<string>("1");
  const [offerPrice, setOfferPrice] = useState<string>("");
  const [locking, setLocking] = useState<Id<"listingUnits"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [offeringListingMode, setOfferingListingMode] = useState<"unit" | "garden">("unit");
  const [showSelectedUnits, setShowSelectedUnits] = useState(false);
  const [listingsPage, setListingsPage] = useState(1);
  const [produceFilter, setProduceFilter] = useState("all");
  const [availableStartDate, setAvailableStartDate] = useState("");
  const [availableEndDate, setAvailableEndDate] = useState("");
  const [listingsPageSize, setListingsPageSize] = useState(10);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedListings, setExpandedListings] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<{ negotiationId: Id<"negotiations">; unitLabel: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [etaDrafts, setEtaDrafts] = useState<Record<string, { etaType: "duration" | "arrival_time"; etaValue: string; reason: string }>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, "departed" | "midway" | "delayed" | "arrived">>({});
  const [etaUpdating, setEtaUpdating] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  const listings = useQuery(api.listings.getActiveListings);
  const traderNegotiations = useQuery(api.negotiations.getTraderNegotiations, { traderId: userId });
  const acceptedNegotiations = useQuery(api.negotiations.getAcceptedNegotiations, { traderId: userId });
  const traderDeliveryListings = useQuery(api.listings.getTraderDeliveryListings, { traderId: userId });
  const makeOffer = useMutation(api.negotiations.makeOffer);
  const acceptCounterOffer = useMutation(api.negotiations.acceptCounterOffer);
  const cancelNegotiation = useMutation(api.negotiations.cancelNegotiation);
  const lockUnit = useMutation(api.payments.lockUnit);
  const updateTraderListingEta = useMutation(api.listings.updateTraderListingEta);
  const updateTraderDeliveryStatus = useMutation(api.listings.updateTraderDeliveryStatus);
  
  // Get available units for the listing being offered on
  const listingDetails = useQuery(
    api.listings.getListingDetails,
    offering ? { listingId: offering.listingId } : "skip"
  );
  const availableUnits = useMemo(
    () => listingDetails?.units?.filter((u: any) => u.status === "available") || [],
    [listingDetails?.units]
  );
  const listingsById = useMemo(() => {
    const map = new Map<string, any>();
    (listings || []).forEach((listing: any) => {
      map.set(listing.listingId, listing);
    });
    return map;
  }, [listings]);

  const openListings = useMemo(
    () => (listings || []).filter((listing: any) => !listing.isTraderListing),
    [listings]
  );

  const produceOptions = useMemo(
    () =>
      Array.from(new Set(openListings.map((listing: any) => listing.produceType).filter(Boolean))).sort(),
    [openListings]
  );

  const sortedOpenListings = useMemo(
    () => [...openListings].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)),
    [openListings]
  );

  const filteredOpenListings = useMemo(() => {
    const normalizedStart = availableStartDate ? new Date(`${availableStartDate}T00:00:00`).getTime() : null;
    const normalizedEnd = availableEndDate ? new Date(`${availableEndDate}T23:59:59.999`).getTime() : null;

    return sortedOpenListings.filter((listing: any) => {
      if (produceFilter !== "all" && listing.produceType !== produceFilter) return false;
      if (!normalizedStart && !normalizedEnd) return true;
      // Backward compatibility: use createdAt as availability date when no dedicated field exists.
      const listingDate = listing.createdAt || 0;
      if (normalizedStart && listingDate < normalizedStart) return false;
      if (normalizedEnd && listingDate > normalizedEnd) return false;
      return true;
    });
  }, [produceFilter, availableStartDate, availableEndDate, sortedOpenListings]);

  const listingsTotal = filteredOpenListings.length;
  const listingsTotalPages = Math.max(1, Math.ceil(listingsTotal / listingsPageSize));
  const listingsStart = listingsTotal === 0 ? 0 : (listingsPage - 1) * listingsPageSize + 1;
  const listingsEnd = Math.min(listingsPage * listingsPageSize, listingsTotal);
  const pagedListings = filteredOpenListings.slice(
    (listingsPage - 1) * listingsPageSize,
    listingsPage * listingsPageSize
  );

  useEffect(() => {
    if (listingsPage > listingsTotalPages) {
      setListingsPage(listingsTotalPages);
    }
  }, [listingsPage, listingsTotalPages]);

  useEffect(() => {
    if (!offering || availableUnits.length === 0) return;

    setShowSelectedUnits(false);

    if (offeringListingMode === "garden") {
      const newSelected = new Set(availableUnits.map((u: any) => u.unitId));
      setSelectedUnits(newSelected);
      setNumUnits("1");
      return;
    }

    const maxUnits = availableUnits.length;
    const newSelected = new Set(availableUnits.map((u: any) => u.unitId));
    setSelectedUnits(newSelected);
    setNumUnits(String(maxUnits));
  }, [offering, offeringListingMode, availableUnits]);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    // Timestamps are stored in Uganda time, convert for display
    return formatUgandaDateTime(timestamp);
  };

  const getEtaTimestamp = (listing: any) => {
    if (!listing?.etaType || listing?.etaValue == null) return null;
    const base = listing.etaLastUpdatedAt || listing.createdAt || Date.now();
    return listing.etaType === "duration"
      ? base + listing.etaValue * 60 * 60 * 1000
      : listing.etaValue;
  };

  const formatEtaValue = (etaType: "duration" | "arrival_time" | null | undefined, value: number | null | undefined) => {
    if (!etaType || value == null) return "N/A";
    return etaType === "arrival_time" ? formatDate(value) : `${value}h`;
  };

  const activeNegotiations = useMemo(
    () => traderNegotiations?.negotiations.filter((neg: any) => neg.status === "pending" || neg.status === "countered") || [],
    [traderNegotiations]
  );

  const batchedNegotiations = useMemo(() => {
    const batches = new Map<string, any>();

    activeNegotiations.forEach((neg: any) => {
      const listingForNeg = listingsById.get(neg.listingId);
      const isGardenNegotiation =
        listingForNeg?.listingMode === "garden" ||
        listingForNeg?.gardenSize != null ||
        listingForNeg?.gardenDimensions != null ||
        listingForNeg?.totalPrice != null;

      const key = [
        neg.listingId,
        neg.status,
        neg.traderOfferPricePerKilo,
        neg.currentPricePerKilo,
        isGardenNegotiation ? "garden" : "unit",
      ].join("|");

      if (!batches.has(key)) {
        batches.set(key, {
          key,
          produceType: neg.produceType,
          status: neg.status,
          isGardenNegotiation,
          listing: listingForNeg,
          traderOfferPricePerKilo: neg.traderOfferPricePerKilo,
          currentPricePerKilo: neg.currentPricePerKilo,
          unitNumbers: [],
          utids: [],
          items: [],
          count: 0,
          latestCreatedAt: 0,
        });
      }

      const batch = batches.get(key);
      batch.count += 1;
      batch.latestCreatedAt = Math.max(batch.latestCreatedAt, neg.createdAt || 0);
      if (neg.unitNumber) batch.unitNumbers.push(neg.unitNumber);
      if (neg.negotiationUtid) batch.utids.push(neg.negotiationUtid);
      batch.items.push({
        negotiationId: neg.negotiationId,
        unitNumber: neg.unitNumber,
        utid: neg.negotiationUtid,
        unitStatus: neg.unitStatus,
        status: neg.status,
      });
    });

    return Array.from(batches.values()).sort((a: any, b: any) => (b.latestCreatedAt || 0) - (a.latestCreatedAt || 0));
  }, [activeNegotiations, listingsById]);

  const handleMakeOffer = async (listingId: Id<"listings">) => {
    const price = parseFloat(offerPrice);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per kilo" });
      return;
    }

    // Get selected units
    let unitIdsToUse: Id<"listingUnits">[] = [];
    
    if (selectedUnits.size > 0) {
      // Use manually selected units
      unitIdsToUse = Array.from(selectedUnits);
    } else {
      // Use number input to select first N available units
      const num = parseInt(numUnits);
      if (isNaN(num) || num <= 0) {
        setMessage({ type: "error", text: "Please enter a valid number of units" });
        return;
      }
      if (num > availableUnits.length) {
        setMessage({ type: "error", text: `Only ${availableUnits.length} units available. Please select fewer units.` });
        return;
      }
      unitIdsToUse = availableUnits.slice(0, num).map((u: any) => u.unitId);
    }

    if (unitIdsToUse.length === 0) {
      setMessage({ type: "error", text: "Please select at least one unit" });
      return;
    }

    setMessage(null);
    
    try {
      const result = await makeOffer({
        traderId: userId,
        unitIds: unitIdsToUse,
        offerPricePerKilo: price,
      });
      
      const unitNumbers = result.negotiations.map((n: any) => `#${n.unitNumber}`).join(", ");
      setMessage({
        type: "success",
        text: `✅ Offer made successfully on ${result.totalUnits} unit(s) (Units: ${unitNumbers})! Each unit has been recorded in your incoming purchase ledger. View batch UTIDs in Active Negotiations.`,
      });
      
      setOfferPrice("");
      setNumUnits("1");
      setSelectedUnits(new Set());
      setOffering(null);
      
      setTimeout(() => {
        setMessage(null);
      }, 10000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to make offer: ${error.message}`,
      });
    }
  };

  const handleAcceptCounterOffer = async (negotiationId: Id<"negotiations">) => {
    setMessage(null);
    
    try {
      const result = await acceptCounterOffer({
        traderId: userId,
        negotiationId: negotiationId,
      });
      
      setMessage({
        type: "success",
        text: "Counter-offer accepted! You can now proceed to pay-to-lock.",
      });
      
      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to accept counter-offer: ${error.message}`,
      });
    }
  };

  const handleLockUnit = async (unitId: Id<"listingUnits">) => {
    setLocking(unitId);
    setMessage(null);
    
    try {
      const result = await lockUnit({
        traderId: userId,
        unitId: unitId,
      });
      
      setMessage({
        type: "success",
        text: `Unit locked successfully! Balance after: ${formatUGX(result.balanceAfter)}. Delivery deadline: 6 hours from now.`,
      });
      
      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to lock unit: ${error.message}`,
      });
    } finally {
      setLocking(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setMessage(null);
    try {
      await cancelNegotiation({
        traderId: userId,
        negotiationId: cancelTarget.negotiationId,
        reason: cancelReason.trim() || undefined,
      });
      setMessage({
        type: "success",
        text: `Negotiation cancelled for ${cancelTarget.unitLabel}.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to cancel negotiation",
      });
    } finally {
      setCancelTarget(null);
      setCancelReason("");
    }
  };

  const handleUpdateEta = async (listingId: Id<"listings">) => {
    const draft = etaDrafts[listingId] || { etaType: "duration", etaValue: "", reason: "" };
    const etaValueNum = Number(draft.etaValue);
    if (!draft.reason.trim()) {
      setMessage({ type: "error", text: "ETA update requires a reason." });
      return;
    }
    if (!draft.etaValue || Number.isNaN(etaValueNum) || etaValueNum <= 0) {
      setMessage({ type: "error", text: "Please enter a valid ETA value." });
      return;
    }

    setEtaUpdating((prev) => ({ ...prev, [listingId]: true }));
    setMessage(null);
    try {
      await updateTraderListingEta({
        traderId: userId,
        listingId,
        etaType: draft.etaType,
        etaValue: etaValueNum,
        reason: draft.reason.trim(),
      });

      setEtaDrafts((prev) => ({
        ...prev,
        [listingId]: { ...draft, reason: "" },
      }));
      setMessage({ type: "success", text: "ETA updated and buyers notified." });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to update ETA" });
    } finally {
      setEtaUpdating((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const handleUpdateStatus = async (listingId: Id<"listings">) => {
    const stage = statusDrafts[listingId] || "departed";
    setStatusUpdating((prev) => ({ ...prev, [listingId]: true }));
    setMessage(null);
    try {
      await updateTraderDeliveryStatus({
        traderId: userId,
        listingId,
        progressStage: stage,
      });
      setMessage({ type: "success", text: "Delivery status updated and buyers notified." });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to update delivery status" });
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [listingId]: false }));
    }
  };


  return (
    <div>
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        marginBottom: "1.5rem"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Delivery Status & ETA Updates
        </h3>
        <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Update delivery status (departed, midway, delayed, arrived) and ETA. ETA changes require a reason and notify buyers/watchers.
        </div>

        {traderDeliveryListings === undefined ? (
          <p style={{ color: "#999" }}>Loading delivery listings...</p>
        ) : !traderDeliveryListings?.listings?.length ? (
          <p style={{ color: "#666" }}>No trader listings available for delivery updates.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {traderDeliveryListings.listings.map((listing: any) => {
              const etaDraft = etaDrafts[listing.listingId] || {
                etaType: listing.etaType || "duration",
                etaValue: listing.etaValue != null ? String(listing.etaValue) : "",
                reason: "",
              };
              const statusDraft = statusDrafts[listing.listingId] || listing.progressStage || "departed";
              const etaTimestamp = getEtaTimestamp(listing);
              const now = Date.now();
              const etaIsPast = etaTimestamp != null ? now > etaTimestamp : false;
              const etaHoursRemaining = etaTimestamp != null
                ? Math.max(0, (etaTimestamp - now) / (1000 * 60 * 60))
                : null;
              const etaHoursOverdue = etaTimestamp != null && now > etaTimestamp
                ? (now - etaTimestamp) / (1000 * 60 * 60)
                : null;

              return (
                <div key={listing.listingId} style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "1rem",
                  background: listing.progressStage === "delayed" ? "#fff7ed" : "#f8fafc"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{listing.productName || listing.produceType}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>UTID: {listing.utid}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        Active Orders: {listing.activeOrders || 0} • Watchers: {listing.activeWatchers || 0}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                      <div>ETA: {formatEtaValue(listing.etaType, listing.etaValue)}</div>
                      {listing.etaLastUpdatedAt && (
                        <div>Updated: {formatDate(listing.etaLastUpdatedAt)}</div>
                      )}
                      {etaTimestamp && (
                        <div style={{ color: etaIsPast ? "#b91c1c" : "#0f766e" }}>
                          ETA Countdown: {etaIsPast
                            ? `${(etaHoursOverdue || 0).toFixed(1)}h overdue`
                            : `${(etaHoursRemaining || 0).toFixed(1)}h remaining`}
                        </div>
                      )}
                      {(listing.deliveryStatus || listing.progressStage) && (
                        <div>Status: {listing.deliveryStatus || "in_transit"}{listing.progressStage ? ` • ${listing.progressStage}` : ""}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "0.9rem" }}>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Update Delivery Status</div>
                      <select
                        value={statusDraft}
                        onChange={(e) =>
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [listing.listingId]: e.target.value as any,
                          }))
                        }
                        style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      >
                        <option value="departed">Departed</option>
                        <option value="midway">Midway</option>
                        <option value="delayed">Delayed</option>
                        <option value="arrived">Arrived</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(listing.listingId)}
                        disabled={statusUpdating[listing.listingId]}
                        style={{
                          padding: "0.55rem",
                          borderRadius: "6px",
                          border: "none",
                          background: statusUpdating[listing.listingId] ? "#cbd5f5" : "#2563eb",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: statusUpdating[listing.listingId] ? "not-allowed" : "pointer",
                        }}
                      >
                        {statusUpdating[listing.listingId] ? "Updating..." : "Update Status"}
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Update ETA</div>
                      <select
                        value={etaDraft.etaType}
                        onChange={(e) =>
                          setEtaDrafts((prev) => ({
                            ...prev,
                            [listing.listingId]: { ...etaDraft, etaType: e.target.value as any },
                          }))
                        }
                        style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      >
                        <option value="duration">Duration (hours)</option>
                        <option value="arrival_time">Arrival time</option>
                      </select>
                      <input
                        type={etaDraft.etaType === "arrival_time" ? "datetime-local" : "number"}
                        value={etaDraft.etaType === "arrival_time"
                          ? (etaDraft.etaValue ? new Date(Number(etaDraft.etaValue)).toISOString().slice(0, 16) : "")
                          : etaDraft.etaValue
                        }
                        onChange={(e) => {
                          const nextValue = etaDraft.etaType === "arrival_time"
                            ? String(new Date(e.target.value).getTime())
                            : e.target.value;
                          setEtaDrafts((prev) => ({
                            ...prev,
                            [listing.listingId]: { ...etaDraft, etaValue: nextValue },
                          }));
                        }}
                        min={etaDraft.etaType === "duration" ? "1" : undefined}
                        style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      />
                      <input
                        type="text"
                        placeholder="Reason for ETA change"
                        value={etaDraft.reason}
                        onChange={(e) =>
                          setEtaDrafts((prev) => ({
                            ...prev,
                            [listing.listingId]: { ...etaDraft, reason: e.target.value },
                          }))
                        }
                        style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateEta(listing.listingId)}
                        disabled={etaUpdating[listing.listingId]}
                        style={{
                          padding: "0.55rem",
                          borderRadius: "6px",
                          border: "none",
                          background: etaUpdating[listing.listingId] ? "#cbd5f5" : "#0f766e",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: etaUpdating[listing.listingId] ? "not-allowed" : "pointer",
                        }}
                      >
                        {etaUpdating[listing.listingId] ? "Updating..." : "Update ETA"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
        Available Listings (Make Offers)
      </h3>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: message.type === "success" ? "#2e7d32" : "#c62828",
          }}
        >
          {message.text}
        </div>
      )}

      {cancelTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setCancelTarget(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 520,
              width: "100%",
              padding: "1.25rem",
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ marginTop: 0 }}>Cancel Negotiation</h4>
            <p style={{ color: "#666" }}>
              Confirm cancellation for {cancelTarget.unitLabel}. This is allowed only before payment lock.
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional reason"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: 8,
                border: "1px solid #ddd",
                marginBottom: "0.9rem",
                fontSize: "0.9rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                style={{
                  padding: "0.5rem 0.9rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                style={{
                  padding: "0.5rem 0.9rem",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Negotiations */}
      {batchedNegotiations.length > 0 && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff3cd",
          borderRadius: "12px",
          border: "1px solid #ffc107"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#856404" }}>
            Your Active Negotiations
          </h4>
          <div style={{ fontSize: "0.85rem", color: "#856404", marginBottom: "0.75rem" }}>
            Tap a batch to view delivery details and offer history.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {batchedNegotiations.map((batch: any) => {
              const unitSize = batch.listing?.unitSize || 10;
              const totalKilos = batch.isGardenNegotiation
                ? (batch.listing?.totalKilos || unitSize)
                : unitSize * batch.count;
              const unitLabel = batch.isGardenNegotiation ? "🌿 Garden Sale" : "⚖️ Kilo Sale";
              const isExpanded = expandedBatches.has(batch.key);
              const unitLabelStyle = {
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: "700",
                background: batch.isGardenNegotiation ? "#1b5e20" : "#0d47a1",
                color: "#fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.1)"
              };

              return (
                <div key={batch.key} style={{
                  padding: "0.75rem",
                  background: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  cursor: "pointer"
                }}
                  onClick={() => {
                    setExpandedBatches((prev) => {
                      const next = new Set(prev);
                      if (next.has(batch.key)) {
                        next.delete(batch.key);
                      } else {
                        next.add(batch.key);
                      }
                      return next;
                    });
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    <strong>{batch.produceType}</strong>
                    <span style={unitLabelStyle}>{unitLabel}</span>
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>
                      {isExpanded ? "Hide details" : "View details"}
                    </span>
                  </div>
                  <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.5rem" }}>
                    {batch.isGardenNegotiation
                      ? `Garden total: ${totalKilos} kg | Status: `
                      : `Units: ${batch.unitNumbers.slice(0, 6).map((n: number) => `#${n}`).join(", ")}${batch.unitNumbers.length > 6 ? ` +${batch.unitNumbers.length - 6}` : ""} • ${totalKilos} kg | Status: `}
                    <strong>{batch.status}</strong>
                  </div>
                  <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", fontFamily: "monospace", wordBreak: "break-all" }}>
                    Batch UTIDs: {batch.utids.slice(0, 3).join(", ")}{batch.utids.length > 3 ? ` +${batch.utids.length - 3}` : ""}
                  </div>
                  {isExpanded && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      background: "#f5f5f5",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem", fontWeight: "600" }}>
                        Offer History
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
                        Your Offer: <strong>{formatUGX(batch.traderOfferPricePerKilo)}/kg</strong> | Current Price: <strong>{formatUGX(batch.currentPricePerKilo)}/kg</strong>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem", fontWeight: "600" }}>
                        Listing Details
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#666", display: "grid", gap: "0.35rem" }}>
                        <div>Farmer: <strong>{batch.listing?.farmerAlias || "Unknown"}</strong></div>
                        <div>Listed: <strong>{batch.listing?.createdAt ? formatDate(batch.listing.createdAt) : "N/A"}</strong></div>
                        <div>Mode: <strong>{batch.isGardenNegotiation ? "Garden Sale" : "Kilo Sale"}</strong></div>
                        <div>Total: <strong>{totalKilos} kg</strong></div>
                        {!batch.isGardenNegotiation && (
                          <div>Unit Size: <strong>{unitSize} kg</strong></div>
                        )}
                        <div>Delivery Location: <strong>{batch.listing?.storageLocation?.districtName ? `${batch.listing.storageLocation.districtName} (${batch.listing.storageLocation.code})` : "Not available"}</strong></div>
                      </div>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#999" }}>
                        Batch UTIDs are listed above for quick reference.
                      </div>
                    </div>
                  )}
                  {batch.status === "countered" && (
                    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {batch.items.slice(0, 3).map((item: any) => (
                        <div key={item.negotiationId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.8rem", color: "#666" }}>
                            {item.unitNumber ? `Unit #${item.unitNumber}` : "Unit"}
                          </span>
                          <button
                            onClick={() => handleAcceptCounterOffer(item.negotiationId)}
                            style={{
                              padding: "0.4rem 0.75rem",
                              background: "#1976d2",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                            }}
                          >
                            Accept Counter-Offer
                          </button>
                        </div>
                      ))}
                      {batch.items.length > 3 && (
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>
                          +{batch.items.length - 3} more countered unit(s). Use filters above to narrow.
                        </div>
                      )}
                    </div>
                  )}
                  {batch.items.some((item: any) => item.unitStatus !== "locked") && batch.status !== "cancelled" && (
                    <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "#666", fontWeight: "600" }}>
                        Cancel before payment lock
                      </div>
                      {batch.items.slice(0, 3).map((item: any) => {
                        const canCancel = item.unitStatus !== "locked" && item.status !== "cancelled" && item.status !== "rejected";
                        return (
                          <div key={`cancel-${item.negotiationId}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.8rem", color: "#666" }}>
                              {item.unitNumber ? `Unit #${item.unitNumber}` : "Unit"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canCancel) return;
                                setCancelTarget({
                                  negotiationId: item.negotiationId,
                                  unitLabel: item.unitNumber ? `Unit #${item.unitNumber}` : "Unit",
                                });
                                setCancelReason("");
                              }}
                              disabled={!canCancel}
                              style={{
                                padding: "0.35rem 0.6rem",
                                background: canCancel ? "#d32f2f" : "#ccc",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: canCancel ? "pointer" : "not-allowed",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        );
                      })}
                      {batch.items.length > 3 && (
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>
                          +{batch.items.length - 3} more active unit(s).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accepted Negotiations Ready for Pay-to-Lock */}
      {acceptedNegotiations && acceptedNegotiations.negotiations.length > 0 && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#d4edda",
          borderRadius: "12px",
          border: "1px solid #28a745"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#155724" }}>
            Accepted Offers - Ready to Lock
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {acceptedNegotiations.negotiations.map((neg: any) => {
              const listingForNeg = listingsById.get(neg.listingId);
              const isGardenNegotiation =
                listingForNeg?.listingMode === "garden" ||
                listingForNeg?.gardenSize != null ||
                listingForNeg?.gardenDimensions != null ||
                listingForNeg?.totalPrice != null;
              const gardenTotalKilos = listingForNeg?.totalKilos || listingForNeg?.unitSize || 1;
              const finalGardenTotal =
                listingForNeg?.totalPrice ?? (neg.finalPricePerKilo * gardenTotalKilos);

              return (
                <div key={neg.negotiationId} style={{
                  padding: "0.75rem",
                  background: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", marginBottom: "0.5rem" }}>
                    <strong>{neg.produceType}</strong>{" "}
                    {isGardenNegotiation ? "- 🌿 Garden Sale" : `- ⚖️ Unit #${neg.unitNumber} (${neg.unitSize}kg)`}
                  </div>
                  <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.5rem" }}>
                    {isGardenNegotiation
                      ? `Final Offer: ${formatUGX(finalGardenTotal)}`
                      : `Final Price: ${formatUGX(neg.finalPricePerKilo)}/kg | Total: ${formatUGX(neg.totalPrice)}`}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleLockUnit(neg.unitId)}
                      disabled={locking === neg.unitId}
                      style={{
                        padding: "0.5rem 1rem",
                        background: locking === neg.unitId ? "#ccc" : "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: locking === neg.unitId ? "not-allowed" : "pointer",
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        fontWeight: "600",
                      }}
                    >
                      {locking === neg.unitId
                        ? "Locking..."
                        : `Pay-to-Lock (${formatUGX(isGardenNegotiation ? finalGardenTotal : neg.totalPrice)})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCancelTarget({
                          negotiationId: neg.negotiationId,
                          unitLabel: neg.unitNumber ? `Unit #${neg.unitNumber}` : "Unit",
                        });
                        setCancelReason("");
                      }}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        fontWeight: "600",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#666" }}>
                    ⚠️ After payment, farmer must deliver within 6 hours. Delivery countdown starts from payment time.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Listings */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#1a1a1a" }}>
          Open & Available Listings
        </h4>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "#666" }}>Filter produce:</span>
          <select
            value={produceFilter}
            onChange={(e) => {
              setProduceFilter(e.target.value);
            }}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              background: "#fff"
            }}
          >
            <option value="all">All produce</option>
            {produceOptions.map((produce: string) => (
              <option key={produce} value={produce}>{produce}</option>
            ))}
          </select>
          <span style={{ fontSize: "0.85rem", color: "#666" }}>Available from:</span>
          <input
            type="date"
            value={availableStartDate}
            onChange={(e) => setAvailableStartDate(e.target.value)}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              background: "#fff"
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#666" }}>to</span>
          <input
            type="date"
            value={availableEndDate}
            onChange={(e) => setAvailableEndDate(e.target.value)}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              background: "#fff"
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
          <select
            value={listingsPageSize}
            onChange={(e) => setListingsPageSize(Number(e.target.value))}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              background: "#fff"
            }}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setProduceFilter("all");
              setAvailableStartDate("");
              setAvailableEndDate("");
            }}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #ddd",
              background: "#f5f5f5",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Reset
          </button>
        </div>

        {listings === undefined ? (
          <p style={{ color: "#999" }}>Loading listings...</p>
        ) : filteredOpenListings.length === 0 ? (
          <p style={{ color: "#666" }}>No active listings available. Farmers need to create listings first.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {pagedListings.map((listing: any) => {
              // Check if trader has an active negotiation for this listing
              const hasActiveNegotiation = activeNegotiations.some(
                (neg: any) => neg.listingId === listing.listingId
              );
              const isOffering = offering?.listingId === listing.listingId;

              const isGardenListing = listing.listingMode === "garden" || Boolean(listing.gardenSize || listing.gardenDimensions || listing.totalPrice);
              const isExpanded = expandedListings.has(listing.listingId);

              return (
                <div
                  key={listing.listingId}
                  style={{
                    padding: "clamp(1rem, 3vw, 1.5rem)",
                    background: isGardenListing ? "#f1f8e9" : "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    border: hasActiveNegotiation
                      ? "2px solid #ff9800"
                      : isGardenListing
                        ? "2px solid #7cb342"
                        : "1px solid #e0e0e0",
                    position: "relative",
                  }}
                >
                {hasActiveNegotiation && (
                  <div style={{
                    position: "absolute",
                    top: "0.75rem",
                    right: "0.75rem",
                    padding: "0.25rem 0.75rem",
                    background: "#ff9800",
                    color: "#fff",
                    borderRadius: "4px",
                    fontSize: "clamp(0.7rem, 2vw, 0.75rem)",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    PENDING
                  </div>
                )}
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0, fontSize: "clamp(1rem, 3.5vw, 1.2rem)", color: "#1a1a1a" }}>
                        {listing.produceType}
                      </h4>
                      <span
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          background: isGardenListing ? "#1b5e20" : "#0d47a1",
                          color: "#fff",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.1)"
                        }}
                      >
                        {isGardenListing ? "🌿 Garden Sale" : "⚖️ Kilo Sale"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666", marginBottom: "0.5rem" }}>
                      <div>
                        <strong>Total:</strong>{" "}
                        {isGardenListing
                          ? `Garden • ${listing.gardenSize || "N/A"} acres`
                          : `${listing.totalKilos} kg (${listing.totalUnits} ${listing.isTraderListing ? "lot" : "units"})`}
                      </div>
                      <div>
                        <strong>Price:</strong>{" "}
                        {isGardenListing
                          ? formatUGX(listing.totalPrice || 0)
                          : `${formatUGX(listing.pricePerKilo)}/kg`}
                      </div>
                      <div>
                        <strong>Available:</strong>{" "}
                        {isGardenListing
                          ? "1 garden"
                          : `${listing.availableUnits || listing.totalUnits} ${listing.isTraderListing ? "lot" : "units"}`}
                      </div>
                      <div>
                        <strong>Listed:</strong> {formatDate(listing.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedListings((prev) => {
                          const next = new Set(prev);
                          if (next.has(listing.listingId)) {
                            next.delete(listing.listingId);
                          } else {
                            next.add(listing.listingId);
                          }
                          return next;
                        });
                      }}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #ddd",
                        background: isExpanded ? "#e3f2fd" : "#f5f5f5",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      {isExpanded ? "Hide details" : "View details"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                    gap: "0.75rem",
                    fontSize: "0.85rem",
                    color: "#555",
                    marginBottom: "0.75rem",
                  }}>
                    <div>
                      <strong>Unit Size:</strong> {isGardenListing ? "Garden" : `${listing.unitSize}kg`}
                    </div>
                    <div>
                      <strong>Unit Price:</strong>{" "}
                      {isGardenListing
                        ? formatUGX(listing.totalPrice || 0)
                        : formatUGX(listing.pricePerKilo * listing.unitSize)}
                    </div>
                    <div>
                      <strong>Location:</strong> {listing.storageLocation?.districtName || "N/A"}
                    </div>
                  </div>
                  {hasActiveNegotiation ? (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>
                      <strong>You have an active negotiation for this listing.</strong> Check &quot;Your Active Negotiations&quot; above.
                    </p>
                  ) : isOffering ? (
                    <div>
                      <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>Make an offer:</strong>{" "}
                        {isGardenListing
                          ? "Garden sale (1 unit). Enter your offer for the garden."
                          : "Select how many units you want and enter your price per kilo."}
                      </p>

                      {!isGardenListing && (
                        <>
                          {/* Unit Selection */}
                          <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "#1a1a1a" }}>
                              Select Number of Units (max {availableUnits.length}):
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={availableUnits.length}
                              value={numUnits}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNumUnits(val);
                                // Auto-select first N units
                                const num = parseInt(val);
                                if (!isNaN(num) && num > 0 && num <= availableUnits.length) {
                                  const newSelected = new Set(availableUnits.slice(0, num).map((u: any) => u.unitId));
                                  setSelectedUnits(newSelected);
                                } else {
                                  setSelectedUnits(new Set());
                                }
                              }}
                              style={{
                                padding: "0.75rem",
                                width: "100%",
                                borderRadius: "6px",
                                border: "2px solid #1976d2",
                                fontSize: "1rem",
                                fontWeight: "600",
                                textAlign: "center"
                              }}
                            />
                            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666", textAlign: "center" }}>
                              {availableUnits.length} unit(s) available • Each unit = {listing.unitSize}kg • Defaulting to max, you can edit.
                            </div>

                        {/* Show selected units (minimal view) */}
                        {selectedUnits.size > 0 && (
                          <div style={{ 
                            marginTop: "1rem", 
                            padding: "0.75rem", 
                            background: "#e3f2fd", 
                            borderRadius: "8px",
                            border: "1px solid #90caf9"
                          }}>
                            <div style={{ 
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                              fontSize: "0.9rem",
                              color: "#1976d2",
                              fontWeight: "600"
                            }}>
                              <span>
                                ✓ {selectedUnits.size} Unit{selectedUnits.size !== 1 ? "s" : ""} Selected • {selectedUnits.size * listing.unitSize}kg total
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowSelectedUnits((prev) => !prev)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#1976d2",
                                  cursor: "pointer",
                                  fontSize: "0.85rem",
                                  textDecoration: "underline",
                                  padding: 0,
                                }}
                              >
                                {showSelectedUnits ? "Hide units" : "View units"}
                              </button>
                            </div>

                            {showSelectedUnits && (
                              <div style={{ marginTop: "0.75rem", maxHeight: "160px", overflowY: "auto" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  {Array.from(selectedUnits).slice(0, 5).map((unitId) => {
                                    const unit = availableUnits.find((u: any) => u.unitId === unitId);
                                    if (!unit) return null;
                                    return (
                                      <div key={unitId} style={{
                                        padding: "0.5rem 0.75rem",
                                        background: "#fff",
                                        borderRadius: "6px",
                                        border: "1px solid #cfe1ff",
                                        fontSize: "0.8rem",
                                        color: "#2c2c2c"
                                      }}>
                                        Unit #{unit.unitNumber} • {listing.unitSize}kg
                                      </div>
                                    );
                                  })}
                                  {selectedUnits.size > 5 && (
                                    <div style={{ fontSize: "0.8rem", color: "#666", textAlign: "center" }}>
                                      +{selectedUnits.size - 5} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        </>
                      )}

                      {/* Price Input */}
                      <div style={{ marginBottom: "1rem" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "#1a1a1a" }}>
                          {isGardenListing ? "Offer for Garden (UGX):" : "Your Offer Price per Kilo (UGX):"}
                        </label>
                        <input
                          type="number"
                          value={offerPrice}
                          onChange={(e) => setOfferPrice(e.target.value)}
                          placeholder={
                            isGardenListing
                              ? `Current garden price: ${formatUGX(listing.totalPrice || 0)}`
                              : `Current listing price: ${formatUGX(listing.pricePerKilo)}/kg`
                          }
                          style={{
                            padding: "0.5rem",
                            width: "100%",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                            fontSize: "0.9rem",
                          }}
                        />
                        {offerPrice && !isNaN(parseFloat(offerPrice)) && selectedUnits.size > 0 && (
                          <div style={{ 
                            marginTop: "0.75rem", 
                            padding: "0.75rem", 
                            background: "#f5f5f5", 
                            borderRadius: "6px",
                            border: "1px solid #e0e0e0"
                          }}>
                            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                              <strong>Offer Summary:</strong>
                            </div>
                            {isGardenListing ? (
                              <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                                <div style={{ color: "#999" }}>Price per unit (garden):</div>
                                <div style={{ fontWeight: "600", color: "#2c2c2c" }}>{formatUGX(parseFloat(offerPrice))}</div>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                                <div>
                                  <div style={{ color: "#999" }}>Price per kg:</div>
                                  <div style={{ fontWeight: "600", color: "#2c2c2c" }}>{formatUGX(parseFloat(offerPrice))}</div>
                                </div>
                                <div>
                                  <div style={{ color: "#999" }}>Price per unit:</div>
                                  <div style={{ fontWeight: "600", color: "#2c2c2c" }}>{formatUGX(parseFloat(offerPrice) * listing.unitSize)}</div>
                                </div>
                              </div>
                            )}
                            <div style={{ 
                              padding: "0.75rem", 
                              background: "#1976d2", 
                              color: "#fff", 
                              borderRadius: "6px",
                              textAlign: "center"
                            }}>
                              <div style={{ fontSize: "0.75rem", marginBottom: "0.25rem", opacity: 0.9 }}>
                                Total Offer Amount
                              </div>
                              <div style={{ fontSize: "1.2rem", fontWeight: "700" }}>
                                {isGardenListing
                                  ? formatUGX(parseFloat(offerPrice))
                                  : formatUGX(parseFloat(offerPrice) * listing.unitSize * selectedUnits.size)}
                              </div>
                              <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.9 }}>
                                {isGardenListing
                                  ? "for this garden unit"
                                  : `for ${selectedUnits.size} unit${selectedUnits.size !== 1 ? "s" : ""} (${selectedUnits.size * listing.unitSize}kg)`}
                              </div>
                            </div>
                            <div style={{ 
                              marginTop: "0.5rem", 
                              padding: "0.5rem", 
                              background: "#fff3cd", 
                              borderRadius: "4px",
                              fontSize: "0.75rem", 
                              color: "#856404",
                              textAlign: "center"
                            }}>
                              ⚠️ Offers are tracked under batch UTIDs in your incoming purchase ledger
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => handleMakeOffer(listing.listingId)}
                          disabled={!offerPrice || listingDetails === undefined || selectedUnits.size === 0 || isNaN(parseFloat(offerPrice)) || parseFloat(offerPrice) <= 0}
                          style={{
                            padding: "0.5rem 1rem",
                            background: (offerPrice && selectedUnits.size > 0 && !isNaN(parseFloat(offerPrice)) && parseFloat(offerPrice) > 0) ? "#1976d2" : "#ccc",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: (offerPrice && selectedUnits.size > 0 && !isNaN(parseFloat(offerPrice)) && parseFloat(offerPrice) > 0) ? "pointer" : "not-allowed",
                            fontSize: "0.9rem",
                            fontWeight: "600",
                            flex: 1,
                          }}
                        >
                          {listingDetails === undefined ? "Loading..." : `Submit Offer (${selectedUnits.size} unit${selectedUnits.size !== 1 ? "s" : ""})`}
                        </button>
                        <button
                          onClick={() => {
                            setOffering(null);
                            setOfferPrice("");
                            setNumUnits("1");
                            setSelectedUnits(new Set());
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#999",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>How to negotiate:</strong>{" "}
                        {isGardenListing
                          ? "Click \"Make Offer\" to propose a total price for the garden. Farmer can accept, reject, or counter-offer."
                          : "Click \"Make Offer\" to propose a price per kilo. Farmer can accept, reject, or counter-offer."}
                      </p>
                      <button
                        onClick={() => {
                          setOffering({ listingId: listing.listingId });
                          setOfferingListingMode(isGardenListing ? "garden" : "unit");
                          setOfferPrice(listing.pricePerKilo.toString());
                          setNumUnits("1");
                          setSelectedUnits(new Set());
                        }}
                        disabled={(listing.availableUnits || 0) === 0}
                        style={{
                          padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                          background: (listing.availableUnits || 0) === 0 ? "#ccc" : "#1976d2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: (listing.availableUnits || 0) === 0 ? "not-allowed" : "pointer",
                          fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                          fontWeight: "600",
                          marginTop: "0.5rem",
                          width: "100%",
                        }}
                      >
                        {(listing.availableUnits || 0) === 0
                          ? "All Units Locked"
                          : "Make Offer"}
                      </button>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#999" }}>
                        ⚠️ After farmer accepts your offer, you can pay-to-lock. Delivery deadline: 6 hours after payment.
                      </p>
                    </div>
                  )}
                </div>
                )}
              </div>
            );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#666" }}>
                Showing {listingsStart}-{listingsEnd} of {listingsTotal}
              </div>
              {listingsTotalPages > 1 && (
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setListingsPage((prev) => Math.max(1, prev - 1))}
                    disabled={listingsPage === 1}
                    style={{
                      padding: "0.3rem 0.6rem",
                      background: listingsPage === 1 ? "#e0e0e0" : "#f5f5f5",
                      color: "#333",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: listingsPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "0.8rem",
                      fontWeight: "600"
                    }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: listingsTotalPages }, (_, idx) => {
                    const page = idx + 1;
                    const isActive = page === listingsPage;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setListingsPage(page)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          background: isActive ? "#1976d2" : "#f5f5f5",
                          color: isActive ? "#fff" : "#333",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: "600"
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setListingsPage((prev) => Math.min(listingsTotalPages, prev + 1))}
                    disabled={listingsPage === listingsTotalPages}
                    style={{
                      padding: "0.3rem 0.6rem",
                      background: listingsPage === listingsTotalPages ? "#e0e0e0" : "#f5f5f5",
                      color: "#333",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: listingsPage === listingsTotalPages ? "not-allowed" : "pointer",
                      fontSize: "0.8rem",
                      fontWeight: "600"
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
