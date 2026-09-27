"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { useStoredUser } from "../../hooks/useStoredUser";
import { VEHICLE_LABEL } from "../../components/transport/TransportDirectory";

const FONT = '"Montserrat", sans-serif';
const RED = "#c62828";
const field: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid #ccc", padding: "0 0.5rem", fontFamily: FONT, width: "100%", boxSizing: "border-box" };
const box: React.CSSProperties = { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: 12 };
const btn = (bg: string, outline = false): React.CSSProperties => ({ minHeight: 40, padding: "0.4rem 0.9rem", borderRadius: 8, border: outline ? `1px solid ${bg}` : "none", background: outline ? "#fff" : bg, color: outline ? bg : "#fff", fontWeight: 700, cursor: "pointer" });
function errorText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return m.match(/Uncaught Error: (.*?)(\n|$| at )/)?.[1] ?? m;
}
async function upload(url: string, file: File): Promise<Id<"_storage">> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  return ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
}

/**
 * Transporter: availability and districts, vehicles and drivers for
 * verification, incoming trips, and FarmCoins earned from trip ratings.
 */
export default function TransporterServicesPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const ws = useQuery(api.transport.getMyTransportWorkspace, userId && user?.role === "transporter" ? { userId, today } : "skip");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!userId || user?.role !== "transporter") return <div style={{ padding: "2rem" }}>This page is for transporter accounts.</div>;
  const say = (ok: boolean, text: string) => setMsg({ ok, text });
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: FONT }}>
      <div style={{ background: RED, color: "#fff", padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)" }}>🚚 My transport services</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 760, margin: "0 auto" }}>
        {msg && <div style={{ background: msg.ok ? "#e8f5e9" : "#ffebee", color: msg.ok ? "#1b5e20" : RED, borderRadius: 8, padding: "0.5rem 0.7rem", marginBottom: 10, fontSize: "0.86rem" }}>{msg.text}</div>}
        {ws === undefined ? (
          <div style={box}>Loading...</div>
        ) : (
          <>
            <div style={{ ...box, background: ws.listed ? "#e8f5e9" : "#fff8e1" }}>
              <b>{ws.listed ? "✔ You are listed in the transport directory." : "Not listed yet."}</b>
              <div style={{ fontSize: "0.84rem", color: "#455a64", marginTop: 4 }}>
                To be listed you need at least one verified vehicle with valid insurance, one verified driver with a valid licence, and
                &quot;available&quot; switched on. A Storage Officer verifies vehicles and drivers.
              </div>
              <div style={{ fontSize: "0.84rem", marginTop: 6 }}>
                🪙 {ws.averageFarmcoins !== null ? `${ws.averageFarmcoins}/10 FarmCoins per trip from ${ws.ratings} rating(s)` : "No ratings yet"} · {ws.completedTrips} trips done
              </div>
            </div>
            <Availability userId={userId} profile={ws.profile} say={say} />
            <Fleet userId={userId} vehicles={ws.vehicles} drivers={ws.drivers} say={say} />
            <Trips userId={userId} trips={ws.trips} say={say} />
          </>
        )}
      </div>
    </div>
  );
}

type Say = (ok: boolean, text: string) => void;

function Availability({ userId, profile, say }: { userId: Id<"users">; profile: { available: boolean; availableFrom: string | null; districtsServed: string[]; priceGuide: string } | null; say: Say }) {
  const save = useMutation(api.transport.setAvailability);
  const [available, setAvailable] = useState(profile?.available ?? false);
  const [from, setFrom] = useState(profile?.availableFrom ?? "");
  const [districts, setDistricts] = useState((profile?.districtsServed ?? []).join(", "));
  const [priceGuide, setPriceGuide] = useState(profile?.priceGuide ?? "");
  if (!profile) return <div style={box}>Complete your transporter onboarding first.</div>;
  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Availability</h2>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44, fontWeight: 700 }}>
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> I am taking bookings
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <label style={{ fontSize: "0.8rem" }}>
          Available from (optional)
          <input style={field} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Price guide (optional; payment is agreed with the customer)
          <input style={field} value={priceGuide} onChange={(e) => setPriceGuide(e.target.value)} placeholder="e.g. UGX 2,500 per km" />
        </label>
      </div>
      <label style={{ fontSize: "0.8rem", display: "block", marginTop: 8 }}>
        Districts you serve (comma separated)
        <input style={field} value={districts} onChange={(e) => setDistricts(e.target.value)} placeholder="e.g. Masaka, Mukono, Kampala" />
      </label>
      <button
        style={{ ...btn(RED), marginTop: 8 }}
        onClick={async () => {
          try {
            await save({ userId, available, availableFrom: from || undefined, districtsServed: districts.split(",").map((d) => d.trim()).filter(Boolean), priceGuide: priceGuide || undefined });
            say(true, "Availability saved.");
          } catch (e) {
            say(false, errorText(e));
          }
        }}
      >
        Save availability
      </button>
    </div>
  );
}

type Vehicle = { _id: Id<"transportVehicles">; plateNumber: string; vehicleType: string; capacityTonnes: number; insuranceExpiry: string; status: string; reviewNotes?: string };
type Driver = { _id: Id<"transportDrivers">; name: string; licenceNumber: string; licenceExpiry: string; status: string; reviewNotes?: string };

function Fleet({ userId, vehicles, drivers, say }: { userId: Id<"users">; vehicles: Vehicle[]; drivers: Driver[]; say: Say }) {
  const getUrl = useMutation(api.transport.generateTransportUploadUrl);
  const addVehicle = useMutation(api.transport.addVehicle);
  const addDriver = useMutation(api.transport.addDriver);
  const remove = useMutation(api.transport.removeVehicleOrDriver);
  const [v, setV] = useState({ plate: "", type: "open_pickup", capacity: "", insuranceExpiry: "" });
  const [vFiles, setVFiles] = useState<{ logbook?: File; insurance?: File; photo?: File }>({});
  const [d, setD] = useState({ name: "", licence: "", licenceClass: "", expiry: "" });
  const [dFile, setDFile] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const statusText = (s: string, notes?: string) => (s === "verified" ? "✔ verified" : s === "rejected" ? `✖ rejected${notes ? `: ${notes}` : ""}` : "⏳ waiting for verification");
  const fileInput = (onPick: (f?: File) => void, label: string) => (
    <label style={{ fontSize: "0.8rem" }}>
      {label}
      <input type="file" accept="image/*,application/pdf" onChange={(e) => onPick(e.target.files?.[0])} style={{ display: "block", maxWidth: "100%", marginTop: 4 }} />
    </label>
  );
  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Vehicles and drivers</h2>
      {vehicles.map((x) => (
        <div key={x._id} style={{ borderTop: "1px solid #eee", padding: "0.45rem 0", fontSize: "0.86rem", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span>
            🚚 <b>{x.plateNumber}</b> · {VEHICLE_LABEL[x.vehicleType] ?? x.vehicleType} {x.capacityTonnes} t · insured to {x.insuranceExpiry} · {statusText(x.status, x.reviewNotes)}
          </span>
          <button style={btn(RED, true)} onClick={() => remove({ userId, vehicleId: x._id }).catch((e) => say(false, errorText(e)))}>
            Remove
          </button>
        </div>
      ))}
      {drivers.map((x) => (
        <div key={x._id} style={{ borderTop: "1px solid #eee", padding: "0.45rem 0", fontSize: "0.86rem", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span>
            🧑‍✈️ <b>{x.name}</b> · licence {x.licenceNumber} to {x.licenceExpiry} · {statusText(x.status, x.reviewNotes)}
          </span>
          <button style={btn(RED, true)} onClick={() => remove({ userId, driverId: x._id }).catch((e) => say(false, errorText(e)))}>
            Remove
          </button>
        </div>
      ))}

      <h3 style={{ fontSize: "0.95rem", margin: "12px 0 6px" }}>Add a vehicle</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <input style={field} placeholder="Number plate" value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} />
        <select style={field} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
          {Object.entries(VEHICLE_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input style={field} placeholder="Capacity (tonnes)" inputMode="decimal" value={v.capacity} onChange={(e) => setV({ ...v, capacity: e.target.value })} />
        <label style={{ fontSize: "0.8rem" }}>
          Insurance expiry
          <input style={field} type="date" value={v.insuranceExpiry} onChange={(e) => setV({ ...v, insuranceExpiry: e.target.value })} />
        </label>
        {fileInput((f) => setVFiles({ ...vFiles, logbook: f }), "Logbook (photo or PDF) *")}
        {fileInput((f) => setVFiles({ ...vFiles, insurance: f }), "Insurance certificate *")}
        {fileInput((f) => setVFiles({ ...vFiles, photo: f }), "Vehicle photo")}
      </div>
      <button
        style={{ ...btn(RED), marginTop: 8 }}
        disabled={busy || !vFiles.logbook || !vFiles.insurance}
        onClick={async () => {
          setBusy(true);
          try {
            const logbookStorageId = await upload(await getUrl({ userId }), vFiles.logbook!);
            const insuranceStorageId = await upload(await getUrl({ userId }), vFiles.insurance!);
            const photoStorageId = vFiles.photo ? await upload(await getUrl({ userId }), vFiles.photo) : undefined;
            await addVehicle({ userId, plateNumber: v.plate, vehicleType: v.type, capacityTonnes: Number(v.capacity), insuranceExpiry: v.insuranceExpiry, logbookStorageId, insuranceStorageId, photoStorageId });
            setV({ plate: "", type: "open_pickup", capacity: "", insuranceExpiry: "" });
            setVFiles({});
            say(true, "Vehicle sent for verification.");
          } catch (e) {
            say(false, errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Send vehicle for verification
      </button>

      <h3 style={{ fontSize: "0.95rem", margin: "14px 0 6px" }}>Add a driver</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <input style={field} placeholder="Driver's full name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <input style={field} placeholder="Licence number" value={d.licence} onChange={(e) => setD({ ...d, licence: e.target.value })} />
        <input style={field} placeholder="Licence class (optional)" value={d.licenceClass} onChange={(e) => setD({ ...d, licenceClass: e.target.value })} />
        <label style={{ fontSize: "0.8rem" }}>
          Licence expiry
          <input style={field} type="date" value={d.expiry} onChange={(e) => setD({ ...d, expiry: e.target.value })} />
        </label>
        {fileInput(setDFile, "Licence (photo or PDF) *")}
      </div>
      <button
        style={{ ...btn(RED), marginTop: 8 }}
        disabled={busy || !dFile}
        onClick={async () => {
          setBusy(true);
          try {
            const licenceStorageId = await upload(await getUrl({ userId }), dFile!);
            await addDriver({ userId, name: d.name, licenceNumber: d.licence, licenceClass: d.licenceClass || undefined, licenceExpiry: d.expiry, licenceStorageId });
            setD({ name: "", licence: "", licenceClass: "", expiry: "" });
            setDFile(undefined);
            say(true, "Driver sent for verification.");
          } catch (e) {
            say(false, errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Send driver for verification
      </button>
    </div>
  );
}

type Trip = { _id: Id<"transportBookings">; requesterAlias: string; fromDistrict: string; toDistrict: string; pickupDate: string; load: string; weightKg?: number; status: string; requesterNote?: string; farmcoinRating?: number; feedback?: string };

function Trips({ userId, trips, say }: { userId: Id<"users">; trips: Trip[]; say: Say }) {
  const respond = useMutation(api.transport.respondToTransportBooking);
  const complete = useMutation(api.transport.completeTrip);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      say(true, ok);
    } catch (e) {
      say(false, errorText(e));
    }
  };
  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Trips</h2>
      {trips.length === 0 && <div style={{ fontSize: "0.86rem" }}>No bookings yet.</div>}
      {trips.map((t) => (
        <div key={t._id} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.86rem" }}>
          <b>
            {t.fromDistrict} → {t.toDistrict} · {t.pickupDate}
          </b>
          <div style={{ color: "#455a64" }}>
            {t.requesterAlias} · {t.load}
            {t.weightKg ? ` · ${t.weightKg} kg` : ""} · {t.status}
          </div>
          {t.requesterNote && <div style={{ color: "#607d8b" }}>Customer: {t.requesterNote}</div>}
          {t.farmcoinRating !== undefined && (
            <div style={{ color: "#6d4c00" }}>
              🪙 Earned {t.farmcoinRating} FarmCoins{t.feedback ? ` · "${t.feedback}"` : ""}
            </div>
          )}
          {t.status === "requested" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <input style={{ ...field, maxWidth: 260 }} placeholder="Message to the customer (optional)" value={notes[t._id] ?? ""} onChange={(e) => setNotes({ ...notes, [t._id]: e.target.value })} />
              <button style={btn("#2e7d32")} onClick={() => run(() => respond({ userId, bookingId: t._id, accept: true, note: notes[t._id] || undefined }), "Trip accepted.")}>
                Accept
              </button>
              <button style={btn(RED, true)} onClick={() => run(() => respond({ userId, bookingId: t._id, accept: false, note: notes[t._id] || undefined }), "Trip declined.")}>
                Decline
              </button>
            </div>
          )}
          {t.status === "accepted" && (
            <button style={{ ...btn("#2e7d32"), marginTop: 6 }} onClick={() => run(() => complete({ userId, bookingId: t._id }), "Trip marked done; the customer is asked to rate it.")}>
              Trip done
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
