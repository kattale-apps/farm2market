"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const REGION_GROUPS = [
  { key: "central_buganda", label: "Central (Buganda)", districts: ["Kampala","Wakiso","Mukono","Buikwe","Kayunga","Luweero","Nakaseke","Nakasongola","Mityana","Kiboga","Mpigi","Butambala","Gomba","Masaka","Lwengo","Kalungu","Bukomansimbi","Sembabule","Lyantonde","Rakai","Kyotera","Mubende","Kassanda"] },
  { key: "eastern_busoga", label: "Eastern (Busoga)", districts: ["Jinja","Mayuge","Iganga","Bugiri","Namayingo","Buyende","Kaliro","Kamuli","Luuka","Namutumba"] },
  { key: "eastern_teso", label: "Eastern (Teso)", districts: ["Soroti","Kaberamaido","Serere","Kalaki","Amuria","Katakwi","Kumi","Bukedea","Ngora","Kapelebyong"] },
  { key: "eastern_elgon", label: "Eastern (Elgon)", districts: ["Mbale","Manafwa","Bududa","Sironko","Bulambuli","Bungokho"] },
  { key: "eastern_other", label: "Eastern (Other)", districts: ["Tororo","Busia","Butaleja","Budaka","Pallisa","Kibuku","Butebo"] },
  { key: "northern_acholi", label: "Northern (Acholi)", districts: ["Gulu","Nwoya","Amuru","Pader","Kitgum","Lamwo","Agago","Omoro"] },
  { key: "northern_lango", label: "Northern (Lango)", districts: ["Lira","Dokolo","Alebtong","Oyam","Apac","Kole","Amolatar","Kwania"] },
  { key: "northern_westnile", label: "Northern (West Nile)", districts: ["Arua","Moyo","Adjumani","Yumbe","Koboko","Maracha","Terego","Zombo","Nebbi","Pakwach"] },
  { key: "northern_karamoja", label: "Northern (Karamoja)", districts: ["Moroto","Kotido","Kaabong","Abim","Nakapiripirit","Napak","Amudat","Nabilatuk","Karenga"] },
  { key: "western_tooro", label: "Western (Tooro)", districts: ["Fort Portal","Kabarole","Kamwenge","Kyenjojo","Kyegegwa","Bunyangabu"] },
  { key: "western_bunyoro", label: "Western (Bunyoro)", districts: ["Hoima","Kikuube","Masindi","Kiryandongo","Buliisa","Kagadi","Kakumiro","Kyankwanzi"] },
  { key: "western_ankole", label: "Western (Ankole)", districts: ["Mbarara","Isingiro","Ntungamo","Bushenyi","Sheema","Mitooma","Rubirizi","Buhweju","Rukungiri","Kanungu"] },
  { key: "western_kigezi", label: "Western (Kigezi)", districts: ["Kabale","Kisoro","Rukiga"] },
];

const VEHICLE_TYPES = [
  { value: "cold_storage", label: "Cold Storage / Refrigerated" },
  { value: "open_pickup", label: "Open Pickup Truck" },
  { value: "box_body", label: "Box Body / Covered Truck" },
];

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  fontSize: "1rem",
  border: "1px solid #ddd",
  borderRadius: "8px",
  background: "#fff",
  color: "#2c2c2c",
};

const labelStyle = {
  display: "block" as const,
  marginBottom: "0.5rem",
  fontWeight: "600" as const,
  color: "#2c2c2c",
  fontSize: "0.95rem",
};

export default function TransporterOnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  // Departure location (optional but encouraged)
  const districts = useQuery(api.locations.getActiveDistricts, {});
  const sortedDistricts = (districts ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const [selectedRegionKey, setSelectedRegionKey] = useState("");
  const selectedRegion = REGION_GROUPS.find((g) => g.key === selectedRegionKey);
  const filteredDistricts = selectedRegion
    ? sortedDistricts.filter((d) => selectedRegion.districts.includes(d.name))
    : [];
  const [selectedDistrictId, setSelectedDistrictId] = useState<Id<"districts"> | "">("");
  const subcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    selectedDistrictId ? { districtId: selectedDistrictId as Id<"districts"> } : "skip"
  );
  const [selectedSubcountyId, setSelectedSubcountyId] = useState<Id<"subcounties"> | "">("");

  // Vehicle info
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleTypeCustom, setVehicleTypeCustom] = useState("");
  const [weightCapacity, setWeightCapacity] = useState("");
  const [vehicleCount, setVehicleCount] = useState("1");

  const completeOnboarding = useMutation(api.transporterOnboarding.completeOnboarding);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) setUserId(parsed.userId as Id<"users">);
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  const onboardingStatus = useQuery(
    api.transporterOnboarding.checkOnboardingStatus,
    userId ? { userId } : "skip"
  );

  useEffect(() => {
    if (onboardingStatus?.completed) router.push("/");
  }, [onboardingStatus, router]);

  useEffect(() => { setSelectedDistrictId(""); setSelectedSubcountyId(""); }, [selectedRegionKey]);
  useEffect(() => { setSelectedSubcountyId(""); }, [selectedDistrictId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { setMessage({ type: "error", text: "Please log in first" }); return; }
    if (!vehicleType) { setMessage({ type: "error", text: "Please select a vehicle type" }); return; }
    if (!weightCapacity || parseFloat(weightCapacity) <= 0) {
      setMessage({ type: "error", text: "Please enter weight capacity" }); return;
    }
    if (!vehicleCount || parseInt(vehicleCount) <= 0) {
      setMessage({ type: "error", text: "Vehicle count must be at least 1" }); return;
    }

    setLoading(true); setMessage(null);
    try {
      const result = await completeOnboarding({
        userId,
        vehicleType: vehicleType as any,
        vehicleTypeCustom: vehicleTypeCustom || undefined,
        weightCapacityTonnes: parseFloat(weightCapacity),
        vehicleCount: parseInt(vehicleCount),
        departureRegion: selectedRegion?.label || undefined,
        departureDistrictId: selectedDistrictId ? (selectedDistrictId as Id<"districts">) : undefined,
        departureSubcountyId: selectedSubcountyId ? (selectedSubcountyId as Id<"subcounties">) : undefined,
      });
      setMessage({ type: "success", text: `Onboarding complete! UTID: ${result.utid}` });
      setTimeout(() => router.push("/"), 2000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to complete onboarding" });
    } finally { setLoading(false); }
  };

  if (!userId) return <div style={{ padding: "2rem", textAlign: "center" }}><p>Please log in to complete onboarding.</p></div>;

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{
        background: "#fff", padding: "clamp(1.5rem, 4vw, 2rem)", borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0"
      }}>
        <h1 style={{
          fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1rem", color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif', fontWeight: "700"
        }}>
          🚛 Transporter Onboarding
        </h1>
        <p style={{
          marginBottom: "2rem", color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
          lineHeight: "1.6", background: "#e3f2fd", padding: "1rem", borderRadius: "8px",
          border: "1px solid #bbdefb"
        }}>
          Please provide your vehicle details and optional departure location. This information helps connect you with farmers and traders who need transport.
        </p>

        {message && (
          <div style={{
            padding: "1rem", marginBottom: "1.5rem", borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
            border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Vehicle Details */}
          <div style={{ marginBottom: "2rem", background: "#e3f2fd", padding: "1.5rem", borderRadius: "8px", border: "1px solid #bbdefb" }}>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem", color: "#1565c0", fontFamily: '"Montserrat", sans-serif', fontWeight: "600" }}>
              🚚 Vehicle Details
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Vehicle Type *</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} required style={inputStyle}>
                <option value="">Select Vehicle Type</option>
                {VEHICLE_TYPES.map((vt) => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Other Vehicle Description (optional)</label>
              <input
                type="text"
                value={vehicleTypeCustom}
                onChange={(e) => setVehicleTypeCustom(e.target.value)}
                placeholder="e.g. Canter with tarpaulin"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Weight Capacity (tonnes) *</label>
                <input
                  type="number"
                  value={weightCapacity}
                  onChange={(e) => setWeightCapacity(e.target.value)}
                  placeholder="e.g. 5"
                  min="0.1"
                  step="0.1"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Number of Vehicles *</label>
                <input
                  type="number"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(e.target.value)}
                  placeholder="e.g. 1"
                  min="1"
                  step="1"
                  required
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Departure Location (optional) */}
          <div style={{ marginBottom: "2rem", background: "#f3e5f5", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e1bee7" }}>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "0.5rem", color: "#7b1fa2", fontFamily: '"Montserrat", sans-serif', fontWeight: "600" }}>
              📍 Departure Location <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#999" }}>(optional)</span>
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#777", marginBottom: "1rem" }}>Where do your trips usually start from?</p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Region</label>
              <select value={selectedRegionKey} onChange={(e) => setSelectedRegionKey(e.target.value)} style={inputStyle}>
                <option value="">Select Region</option>
                {REGION_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>District</label>
              <select value={selectedDistrictId} onChange={(e) => setSelectedDistrictId(e.target.value as any)} disabled={!selectedRegionKey}
                style={{ ...inputStyle, background: selectedRegionKey ? "#fff" : "#f5f5f5" }}>
                <option value="">{selectedRegionKey ? "Select District" : "Select Region first"}</option>
                {filteredDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Subcounty</label>
              <select value={selectedSubcountyId} onChange={(e) => setSelectedSubcountyId(e.target.value as any)} disabled={!selectedDistrictId}
                style={{ ...inputStyle, background: selectedDistrictId ? "#fff" : "#f5f5f5" }}>
                <option value="">{selectedDistrictId ? "Select Subcounty" : "Select District first"}</option>
                {(subcounties ?? []).map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "1rem", fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
              fontWeight: "700", background: loading ? "#bdbdbd" : "#1565c0", color: "#fff",
              border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: '"Montserrat", sans-serif', transition: "background 0.2s",
            }}
          >
            {loading ? "Saving..." : "Complete Onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}
