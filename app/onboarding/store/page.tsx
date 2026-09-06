"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoredUser } from "../../hooks/useStoredUser";

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

const STORE_TYPES = [
  { value: "cold_storage", label: "Cold Storage" },
  { value: "dry_storage", label: "Dry Storage / Warehouse" },
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

export default function StoreOnboardingPage() {
  const router = useRouter();
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  // Location
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
  const parishes = useQuery(
    api.locations.getParishesBySubcounty,
    selectedSubcountyId ? { subcountyId: selectedSubcountyId as Id<"subcounties"> } : "skip"
  );
  const [selectedParishId, setSelectedParishId] = useState<Id<"parishes"> | "">("");

  // Store info
  const [storeType, setStoreType] = useState("");
  const [storeTypeCustom, setStoreTypeCustom] = useState("");
  const [storageCapacity, setStorageCapacity] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [storeNumber, setStoreNumber] = useState("");

  const completeOnboarding = useMutation(api.storeOnboarding.completeOnboarding);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const onboardingStatus = useQuery(
    api.storeOnboarding.checkOnboardingStatus,
    userId ? { userId } : "skip"
  );

  useEffect(() => {
    if (onboardingStatus?.completed) router.push("/");
    // Pre-fill existing data for returning users missing new fields
    if (onboardingStatus && !onboardingStatus.completed && onboardingStatus.hasLocation) {
      if (onboardingStatus.storeType && !storeType) setStoreType(onboardingStatus.storeType);
      if (onboardingStatus.storeTypeCustom && !storeTypeCustom) setStoreTypeCustom(onboardingStatus.storeTypeCustom);
      if (onboardingStatus.storageCapacityTonnes && !storageCapacity) setStorageCapacity(String(onboardingStatus.storageCapacityTonnes));
      if (onboardingStatus.streetAddress && !streetAddress) setStreetAddress(onboardingStatus.streetAddress);
      if (onboardingStatus.buildingName && !buildingName) setBuildingName(onboardingStatus.buildingName);
      if (onboardingStatus.storeNumber && !storeNumber) setStoreNumber(onboardingStatus.storeNumber);
    }
  }, [onboardingStatus, router, storeType, storeTypeCustom, storageCapacity, streetAddress, buildingName, storeNumber]);

  useEffect(() => { setSelectedDistrictId(""); setSelectedSubcountyId(""); setSelectedParishId(""); }, [selectedRegionKey]);
  useEffect(() => { setSelectedSubcountyId(""); setSelectedParishId(""); }, [selectedDistrictId]);
  useEffect(() => { setSelectedParishId(""); }, [selectedSubcountyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { setMessage({ type: "error", text: "Please log in first" }); return; }
    if (!selectedRegionKey || !selectedDistrictId || !selectedSubcountyId) {
      setMessage({ type: "error", text: "Please select Region, District, and Subcounty" }); return;
    }
    if (!storeType) { setMessage({ type: "error", text: "Please select a store type" }); return; }
    if (!storageCapacity || parseFloat(storageCapacity) <= 0) {
      setMessage({ type: "error", text: "Please enter storage capacity" }); return;
    }
    if (!streetAddress.trim()) { setMessage({ type: "error", text: "Please enter the street address" }); return; }
    if (!buildingName.trim()) { setMessage({ type: "error", text: "Please enter the building name" }); return; }
    if (!storeNumber.trim()) { setMessage({ type: "error", text: "Please enter the store number" }); return; }

    setLoading(true); setMessage(null);
    try {
      const result = await completeOnboarding({
        userId,
        region: selectedRegion?.label || selectedRegionKey,
        districtId: selectedDistrictId as Id<"districts">,
        subcountyId: selectedSubcountyId as Id<"subcounties">,
        parishId: selectedParishId ? selectedParishId as Id<"parishes"> : undefined,
        storageCapacityTonnes: parseFloat(storageCapacity),
        storeType: storeType as any,
        storeTypeCustom: storeTypeCustom || undefined,
        streetAddress: streetAddress.trim(),
        buildingName: buildingName.trim(),
        storeNumber: storeNumber.trim(),
      });
      setMessage({ type: "success", text: `Onboarding complete! UTID: ${result.utid}` });
      setTimeout(() => router.push("/"), 2000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to complete onboarding" });
    } finally { setLoading(false); }
  };

  if (authStatus === "loading") return <div style={{ padding: "2rem", textAlign: "center" }}><p>Loading your session...</p></div>;

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
          🏬 Store Onboarding
        </h1>
        <p style={{
          marginBottom: "2rem", color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
          lineHeight: "1.6", background: "#fce4ec", padding: "1rem", borderRadius: "8px",
          border: "1px solid #f8bbd0"
        }}>
          {onboardingStatus && !onboardingStatus.completed && onboardingStatus.hasLocation
            ? "We've updated our onboarding — please confirm your details and fill in the new required fields (Street Address, Building Name, Store Number) to continue."
            : "Please provide your location, storage type, capacity, and store address. This information is required before you can create listings."}
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
          {/* Location */}
          <div style={{ marginBottom: "2rem", background: "#fce4ec", padding: "1.5rem", borderRadius: "8px", border: "1px solid #f8bbd0" }}>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem", color: "#c62828", fontFamily: '"Montserrat", sans-serif', fontWeight: "600" }}>
              📍 Location
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Region *</label>
              <select value={selectedRegionKey} onChange={(e) => setSelectedRegionKey(e.target.value)} required style={inputStyle}>
                <option value="">Select Region</option>
                {REGION_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>District *</label>
              <select value={selectedDistrictId} onChange={(e) => setSelectedDistrictId(e.target.value as any)} required disabled={!selectedRegionKey}
                style={{ ...inputStyle, background: selectedRegionKey ? "#fff" : "#f5f5f5", cursor: selectedRegionKey ? "pointer" : "not-allowed" }}>
                <option value="">{selectedRegionKey ? "Select District" : "Select Region first"}</option>
                {filteredDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Subcounty *</label>
              <select value={selectedSubcountyId} onChange={(e) => setSelectedSubcountyId(e.target.value as any)} required disabled={!selectedDistrictId}
                style={{ ...inputStyle, background: selectedDistrictId ? "#fff" : "#f5f5f5", cursor: selectedDistrictId ? "pointer" : "not-allowed" }}>
                <option value="">{selectedDistrictId ? "Select Subcounty" : "Select District first"}</option>
                {(subcounties ?? []).map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Parish (optional)</label>
              <select value={selectedParishId} onChange={(e) => setSelectedParishId(e.target.value as any)} disabled={!selectedSubcountyId}
                style={{ ...inputStyle, background: selectedSubcountyId ? "#fff" : "#f5f5f5", cursor: selectedSubcountyId ? "pointer" : "not-allowed" }}>
                <option value="">{selectedSubcountyId ? "Select Parish" : "Select Subcounty first"}</option>
                {(parishes ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Store Info */}
          <div style={{ marginBottom: "2rem", background: "#fce4ec", padding: "1.5rem", borderRadius: "8px", border: "1px solid #f8bbd0" }}>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem", color: "#c62828", fontFamily: '"Montserrat", sans-serif', fontWeight: "600" }}>
              🏪 Storage Details
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Store Type *</label>
              <select value={storeType} onChange={(e) => setStoreType(e.target.value)} required style={inputStyle}>
                <option value="">Select Store Type</option>
                {STORE_TYPES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Other Store Description (optional)</label>
              <input
                type="text"
                value={storeTypeCustom}
                onChange={(e) => setStoreTypeCustom(e.target.value)}
                placeholder="e.g. Underground bunker with ventilation"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Storage Capacity (tonnes) *</label>
              <input
                type="number"
                value={storageCapacity}
                onChange={(e) => setStorageCapacity(e.target.value)}
                placeholder="e.g. 10"
                min="0.1"
                step="0.1"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Store Address */}
          <div style={{ marginBottom: "2rem", background: "#fce4ec", padding: "1.5rem", borderRadius: "8px", border: "1px solid #f8bbd0" }}>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem", color: "#c62828", fontFamily: '"Montserrat", sans-serif', fontWeight: "600" }}>
              🏠 Store Address
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Street Address *</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. Plot 23, Kampala Road"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Building Name *</label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="e.g. City Mall, Farmer House"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Store Number *</label>
              <input
                type="text"
                value={storeNumber}
                onChange={(e) => setStoreNumber(e.target.value)}
                placeholder="e.g. Shop 5, Unit B-12"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "1rem", fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
              fontWeight: "700", background: loading ? "#bdbdbd" : "#c62828", color: "#fff",
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
