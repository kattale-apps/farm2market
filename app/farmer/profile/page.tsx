 "use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FarmerProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string>("farmer");
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Location selection state
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedSubcountyId, setSelectedSubcountyId] = useState<string>("");
  const [selectedParishId, setSelectedParishId] = useState<string>("");
  const [selectedRegionKey, setSelectedRegionKey] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [sex, setSex] = useState<"M" | "F" | "">("");
  const [farmSizeInput, setFarmSizeInput] = useState<{
    unit?: "ft" | "m" | "acres" | "omwigo";
    length?: number;
    width?: number;
    omwigo?: number;
    acres?: number;
  }>({});

  // Vendor fields
  const [marketName, setMarketName] = useState("");
  const [marketType, setMarketType] = useState("");
  const [stallNumber, setStallNumber] = useState("");
  // Store fields
  const [buildingName, setBuildingName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [storeType, setStoreType] = useState("");

  const regionGroups = useMemo(() => [
    {
      key: "central_buganda",
      label: "Central (Buganda)",
      districts: [
        "Kampala", "Wakiso", "Mukono", "Buikwe", "Kayunga",
        "Luweero", "Nakaseke", "Nakasongola", "Mityana", "Kiboga",
        "Mpigi", "Butambala", "Gomba", "Masaka",
        "Lwengo", "Kalungu", "Bukomansimbi", "Sembabule", "Lyantonde",
        "Rakai", "Kyotera", "Mubende", "Kassanda"
      ],
    },
    {
      key: "eastern_busoga",
      label: "Eastern (Busoga)",
      districts: [
        "Jinja", "Mayuge", "Iganga", "Bugiri", "Namayingo", "Buyende",
        "Kaliro", "Kamuli", "Luuka", "Namutumba"
      ],
    },
    {
      key: "eastern_teso",
      label: "Eastern (Teso)",
      districts: ["Soroti", "Kaberamaido", "Serere", "Kalaki", "Amuria", "Katakwi", "Kumi", "Bukedea", "Ngora", "Kapelebyong"],
    },
    {
      key: "eastern_elgon",
      label: "Eastern (Elgon)",
      districts: ["Mbale", "Manafwa", "Bududa", "Sironko", "Bulambuli", "Bungokho"],
    },
    {
      key: "eastern_other",
      label: "Eastern (Other)",
      districts: ["Tororo", "Busia", "Butaleja", "Budaka", "Pallisa", "Kibuku", "Butebo"],
    },
    {
      key: "northern_acholi",
      label: "Northern (Acholi)",
      districts: ["Gulu", "Nwoya", "Amuru", "Pader", "Kitgum", "Lamwo", "Agago", "Omoro"],
    },
    {
      key: "northern_lango",
      label: "Northern (Lango)",
      districts: ["Lira", "Dokolo", "Alebtong", "Oyam", "Apac", "Kole", "Amolatar", "Kwania"],
    },
    {
      key: "northern_westnile",
      label: "Northern (West Nile)",
      districts: ["Arua", "Moyo", "Adjumani", "Yumbe", "Koboko", "Maracha", "Terego", "Zombo", "Nebbi", "Pakwach"],
    },
    {
      key: "northern_karamoja",
      label: "Northern (Karamoja)",
      districts: ["Moroto", "Kotido", "Kaabong", "Abim", "Nakapiripirit", "Napak", "Amudat", "Nabilatuk", "Karenga"],
    },
    {
      key: "northern_other",
      label: "Northern (Other)",
      districts: ["Gomba"], // placeholder to keep structure; removed in filter by name.
    },
    {
      key: "western_tooro",
      label: "Western (Tooro)",
      districts: ["Fort Portal", "Kabarole", "Kamwenge", "Kyenjojo", "Kyegegwa", "Bunyangabu"],
    },
    {
      key: "western_bunyoro",
      label: "Western (Bunyoro)",
      districts: ["Hoima", "Kikuube", "Masindi", "Kiryandongo", "Buliisa", "Kagadi", "Kakumiro", "Kyankwanzi"],
    },
    {
      key: "western_ankole",
      label: "Western (Ankole)",
      districts: ["Mbarara", "Isingiro", "Ntungamo", "Bushenyi", "Sheema", "Mitooma", "Rubirizi", "Buhweju", "Rukungiri", "Kanungu"],
    },
    {
      key: "western_kigezi",
      label: "Western (Kigezi)",
      districts: ["Kabale", "Kisoro", "Rukiga"],
    },
  ], []);

  const normalizeName = (name: string) => name.trim().toLowerCase();

  const regionForDistrictName = useCallback((districtName?: string) => {
    if (!districtName) return "";
    const name = normalizeName(districtName);
    const match = regionGroups.find((group) =>
      group.districts.some((d) => normalizeName(d) === name)
    );
    return match?.key || "";
  }, [regionGroups]);

  // Get user from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.userId && ["farmer", "vendor", "store"].includes(parsed.role)) {
            setUserId(parsed.userId);
            setUserRole(parsed.role);
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    }
  }, [router]);

  // Get profile data
  const profile = useQuery(
    api.farmerProfile.getFarmerProfile,
    userId ? { farmerId: userId } : "skip"
  );

  // Vendor/Store profile queries
  const vendorProfile = useQuery(
    api.farmerProfile.getVendorProfile,
    userId && userRole === "vendor" ? { userId } : "skip"
  );
  const storeProfile = useQuery(
    api.farmerProfile.getStoreProfile,
    userId && userRole === "store" ? { userId } : "skip"
  );

  // Convex IDs are never human-readable text — reject plain words
  const isConvexId = (v: unknown): v is string =>
    typeof v === "string" && v.length > 0 && !/\s/.test(v) && !/^[A-Za-z]+$/.test(v);

  // Get location options
  const districts = useQuery(api.locations.getActiveDistricts, {});
  const subcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    isConvexId(selectedDistrictId) ? { districtId: selectedDistrictId as Id<"districts"> } : "skip"
  );
  const parishes = useQuery(
    api.locations.getParishesBySubcounty,
    isConvexId(selectedSubcountyId) ? { subcountyId: selectedSubcountyId as Id<"subcounties"> } : "skip"
  );

  // Initialize form when profile loads
  useEffect(() => {
    if (profile && !isEditing) {
      setSelectedDistrictId(profile.districtId || "");
      setSelectedSubcountyId(profile.subcountyId || "");
      setSelectedParishId(profile.parishId || "");
      setSelectedRegionKey(regionForDistrictName(profile.districtName));
      setPhoneNumber(profile.phoneNumber || "");
      setSex(profile.sex || "");
      if (profile.farmSizeRaw) {
        setFarmSizeInput(profile.farmSizeRaw as any);
      }
    }
  }, [profile, isEditing, regionForDistrictName]);

  // Initialize vendor/store fields
  useEffect(() => {
    if (vendorProfile && !isEditing) {
      setMarketName(vendorProfile.marketName || "");
      setMarketType(vendorProfile.marketType || "");
      setStallNumber(vendorProfile.stallNumber || "");
    }
  }, [vendorProfile, isEditing]);

  useEffect(() => {
    if (storeProfile && !isEditing) {
      setBuildingName(storeProfile.buildingName || "");
      setStreetAddress(storeProfile.streetAddress || "");
      setStoreNumber(storeProfile.storeNumber || "");
      setStoreType(storeProfile.storeType || "");
    }
  }, [storeProfile, isEditing]);

  const updateProfile = useMutation(api.farmerProfile.updateFarmerProfile);
  const updateVendorProfile = useMutation(api.farmerProfile.updateVendorProfile);
  const updateStoreProfile = useMutation(api.farmerProfile.updateStoreProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setMessage(null);

    try {
      await updateProfile({
        farmerId: userId,
        districtId: selectedDistrictId ? (selectedDistrictId as Id<"districts">) : undefined,
        subcountyId: selectedSubcountyId ? (selectedSubcountyId as Id<"subcounties">) : undefined,
        parishId: selectedParishId ? (selectedParishId as Id<"parishes">) : undefined,
        farmSizeInput: userRole === "farmer" && Object.keys(farmSizeInput).length > 0 ? farmSizeInput : undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        sex: sex || undefined,
      });

      // Save vendor/store specific data
      if (userRole === "vendor") {
        await updateVendorProfile({
          userId,
          marketType: (marketType || undefined) as any,
          marketName: marketName || undefined,
          stallNumber: stallNumber || undefined,
        });
      } else if (userRole === "store") {
        await updateStoreProfile({
          userId,
          storeType: (storeType || undefined) as any,
          buildingName: buildingName || undefined,
          streetAddress: streetAddress || undefined,
          storeNumber: storeNumber || undefined,
        });
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setLoading(false);
    }
  };

  if (!userId || !profile) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", margin: 0, color: "#2c2c2c" }}>
          My Profile {userRole === "vendor" ? "🏪" : userRole === "store" ? "🏬" : "👩🏾‍🌾"}
        </h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link
            href="/farmer/communities"
            style={{
              padding: "0.5rem 1rem",
              background: "#1976d2",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.9rem",
            }}
          >
            🌍 Communities
          </Link>
          <Link
            href="/"
            style={{
              padding: "8px 16px",
              background: "#2e7d32",
              color: "white",
              textDecoration: "none",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            🏠 Back to Home
          </Link>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
            border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {!isEditing ? (
        // View Mode
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#2c2c2c" }}>Account Information</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <strong>Alias:</strong> {profile.alias}
              </div>
              {profile.email && (
                <div>
                  <strong>Email:</strong> {profile.email}
                </div>
              )}
              {profile.phoneNumber && (
                <div>
                  <strong>Phone:</strong> {profile.phoneNumber}
                </div>
              )}
              {profile.sex && (
                <div>
                  <strong>Sex:</strong> {profile.sex === "M" ? "Male" : "Female"}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#2c2c2c" }}>Location</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {profile.districtName ? (
                <>
                  {regionForDistrictName(profile.districtName) && (
                    <div>
                      <strong>Region:</strong>{" "}
                      {regionGroups.find((g) => g.key === regionForDistrictName(profile.districtName))?.label}
                    </div>
                  )}
                  <div>
                    <strong>District:</strong> {profile.districtName}
                  </div>
                  {profile.subcountyName && (
                    <div>
                      <strong>Subcounty:</strong> {profile.subcountyName}
                    </div>
                  )}
                  {profile.parishName && (
                    <div>
                      <strong>Parish:</strong> {profile.parishName}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "#666", fontStyle: "italic" }}>Location not set</div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#2c2c2c" }}>
              {userRole === "vendor" ? "Market Information" : userRole === "store" ? "Store Information" : "Farm Information"}
            </h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {userRole === "vendor" ? (
                <>
                  {vendorProfile?.marketType && (
                    <div><strong>Market Type:</strong> {vendorProfile.marketType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  )}
                  {vendorProfile?.marketName && (
                    <div><strong>Market Name:</strong> {vendorProfile.marketName}</div>
                  )}
                  {vendorProfile?.stallNumber && (
                    <div><strong>Stall Number:</strong> {vendorProfile.stallNumber}</div>
                  )}
                  {!vendorProfile && <div style={{ color: "#666", fontStyle: "italic" }}>Market info not set — edit your profile to add it</div>}
                </>
              ) : userRole === "store" ? (
                <>
                  {storeProfile?.storeType && (
                    <div><strong>Store Type:</strong> {storeProfile.storeType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  )}
                  {storeProfile?.buildingName && (
                    <div><strong>Building Name:</strong> {storeProfile.buildingName}</div>
                  )}
                  {storeProfile?.streetAddress && (
                    <div><strong>Street Address:</strong> {storeProfile.streetAddress}</div>
                  )}
                  {storeProfile?.storeNumber && (
                    <div><strong>Store Number:</strong> {storeProfile.storeNumber}</div>
                  )}
                  {!storeProfile && <div style={{ color: "#666", fontStyle: "italic" }}>Store info not set — edit your profile to add it</div>}
                </>
              ) : (
                <>
                  {profile.farmSizeAcres ? (
                    <div><strong>Farm Size:</strong> {profile.farmSizeAcres.toFixed(4)} acres</div>
                  ) : (
                    <div style={{ color: "#666", fontStyle: "italic" }}>Farm size not set</div>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Edit Profile
          </button>
        </div>
      ) : (
        // Edit Mode
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "#2c2c2c" }}>Edit Profile</h2>

          {/* Location Selection */}
          <div
            style={{
              marginBottom: "2rem",
              background: "#e8f5e9",
              padding: "1.25rem",
              borderRadius: "10px",
              border: "1px solid #c8e6c9",
            }}
          >
            <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Location</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                  Region *
                </label>
                <select
                  value={selectedRegionKey}
                  onChange={(e) => {
                    setSelectedRegionKey(e.target.value);
                    setSelectedDistrictId("");
                    setSelectedSubcountyId("");
                    setSelectedParishId("");
                  }}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">Select Region</option>
                  {regionGroups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                  If your district appears in the wrong region, contact SuperAdmin to update the mapping.
                </p>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                  District *
                </label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => {
                    setSelectedDistrictId(e.target.value);
                    setSelectedSubcountyId("");
                    setSelectedParishId("");
                  }}
                  required
                  disabled={!selectedRegionKey}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">
                    {selectedRegionKey ? "Select District" : "Select Region first"}
                  </option>
                  {districts
                    ?.filter((d) => {
                      if (!selectedRegionKey) return false;
                      const region = regionForDistrictName(d.name);
                      return region === selectedRegionKey;
                    })
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {selectedDistrictId && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Subcounty *
                  </label>
                  <select
                    value={selectedSubcountyId}
                    onChange={(e) => {
                      setSelectedSubcountyId(e.target.value);
                      setSelectedParishId("");
                    }}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="">Select Subcounty</option>
                    {subcounties?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedSubcountyId && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Parish (optional)
                  </label>
                  <select
                    value={selectedParishId}
                    onChange={(e) => setSelectedParishId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="">Select Parish</option>
                    {parishes?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Contact Details</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., 0700000000"
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                  Sex (M/F) *
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "M" | "F" | "")}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">Select Sex</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
          </div>

          {/* Role-specific edit section */}
          {userRole === "vendor" ? (
            <div style={{ marginBottom: "2rem", background: "#fff3e0", padding: "1.25rem", borderRadius: "10px", border: "1px solid #ffe0b2" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Market Information</h3>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Market Type</label>
                  <select value={marketType} onChange={(e) => setMarketType(e.target.value)} style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }}>
                    <option value="">Select Market Type</option>
                    <option value="city_market">City Market</option>
                    <option value="supermarket">Supermarket</option>
                    <option value="roadside_market">Roadside Market</option>
                    <option value="town_market">Town Market</option>
                    <option value="village_market">Village Market</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Market Name</label>
                  <input type="text" value={marketName} onChange={(e) => setMarketName(e.target.value)} placeholder="e.g., Owino Market" style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Stall Number (optional)</label>
                  <input type="text" value={stallNumber} onChange={(e) => setStallNumber(e.target.value)} placeholder="e.g., A-12" style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }} />
                </div>
              </div>
            </div>
          ) : userRole === "store" ? (
            <div style={{ marginBottom: "2rem", background: "#e3f2fd", padding: "1.25rem", borderRadius: "10px", border: "1px solid #bbdefb" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Store Information</h3>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Store Type</label>
                  <select value={storeType} onChange={(e) => setStoreType(e.target.value)} style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }}>
                    <option value="">Select Store Type</option>
                    <option value="cold_storage">Cold Storage</option>
                    <option value="dry_storage">Dry Storage</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Building Name</label>
                  <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="e.g., Farmers House" style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Street Address</label>
                  <input type="text" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="e.g., Plot 5, Market Street" style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Store Number</label>
                  <input type="text" value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} placeholder="e.g., S-04" style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }} />
                </div>
              </div>
            </div>
          ) : (
          /* Farm Size — farmer only */
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Farm Size</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                  Measurement Method
                </label>
                <select
                  value={farmSizeInput.unit || ""}
                  onChange={(e) =>
                    setFarmSizeInput({ ...farmSizeInput, unit: e.target.value as "ft" | "m" })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">Select Method</option>
                  <option value="ft">Feet (ft × ft)</option>
                  <option value="m">Meters (m × m)</option>
                  <option value="omwigo">Omwigo</option>
                  <option value="acres">Acres</option>
                </select>
              </div>

              {farmSizeInput.unit === "ft" || farmSizeInput.unit === "m" ? (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                      Length ({farmSizeInput.unit})
                    </label>
                    <input
                      type="number"
                      value={farmSizeInput.length || ""}
                      onChange={(e) =>
                        setFarmSizeInput({ ...farmSizeInput, length: parseFloat(e.target.value) })
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                      Width ({farmSizeInput.unit})
                    </label>
                    <input
                      type="number"
                      value={farmSizeInput.width || ""}
                      onChange={(e) =>
                        setFarmSizeInput({ ...farmSizeInput, width: parseFloat(e.target.value) })
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                </>
              ) : farmSizeInput.unit === "omwigo" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Number of Omwigo
                  </label>
                  <input
                    type="number"
                    value={farmSizeInput.omwigo || ""}
                    onChange={(e) =>
                      setFarmSizeInput({ ...farmSizeInput, omwigo: parseFloat(e.target.value) })
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              ) : farmSizeInput.unit === "acres" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Acres
                  </label>
                  <input
                    type="number"
                    value={farmSizeInput.acres || ""}
                    onChange={(e) =>
                      setFarmSizeInput({ ...farmSizeInput, acres: parseFloat(e.target.value) })
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              ) : null}
                        {/* Live conversion preview to acres */}
                        <div style={{ marginTop: "1rem", background: "#f1f8e9", padding: "0.75rem 1rem", borderRadius: 8, color: "#33691e", fontWeight: 500 }}>
                          {(() => {
                            let acres = 0;
                            if (farmSizeInput.unit === "acres" && farmSizeInput.acres) {
                              acres = farmSizeInput.acres;
                            } else if (farmSizeInput.unit === "ft" && farmSizeInput.length && farmSizeInput.width) {
                              acres = (farmSizeInput.length * farmSizeInput.width) / 43560;
                            } else if (farmSizeInput.unit === "m" && farmSizeInput.length && farmSizeInput.width) {
                              acres = (farmSizeInput.length * farmSizeInput.width) / 4046.86;
                            } else if (farmSizeInput.unit === "omwigo" && farmSizeInput.omwigo) {
                              acres = farmSizeInput.omwigo * 0.25; // Example: 1 omwigo = 0.25 acres (adjust as needed)
                            }
                            return `Farm size in acres: ${acres ? acres.toFixed(4) : "-"}`;
                          })()}
                        </div>
            </div>
          </div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.75rem 1.5rem",
                background: loading ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setMessage(null);
                // Reset form
                if (profile) {
                  setSelectedDistrictId(profile.districtId || "");
                  setSelectedSubcountyId(profile.subcountyId || "");
                  setSelectedParishId(profile.parishId || "");
                  if (profile.farmSizeRaw) {
                    setFarmSizeInput(profile.farmSizeRaw as any);
                  }
                }
              }}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#f5f5f5",
                color: "#333",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "1rem",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
