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
    unit?: "ft" | "m";
    length?: number;
    width?: number;
    omwigo?: number;
    emiigo?: number;
  }>({});

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
          if (parsed && parsed.userId && parsed.role === "farmer") {
            setUserId(parsed.userId);
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

  // Get location options
  const districts = useQuery(api.locations.getActiveDistricts, {});
  const subcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    selectedDistrictId ? { districtId: selectedDistrictId as Id<"districts"> } : "skip"
  );
  const parishes = useQuery(
    api.locations.getParishesBySubcounty,
    selectedSubcountyId ? { subcountyId: selectedSubcountyId as Id<"subcounties"> } : "skip"
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

  const updateProfile = useMutation(api.farmerProfile.updateFarmerProfile);

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
        farmSizeInput: Object.keys(farmSizeInput).length > 0 ? farmSizeInput : undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        sex: sex || undefined,
      });

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
          My Profile 👩🏾‍🌾
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
            🌾 Communities
          </Link>
          <Link
            href="/"
            style={{
              padding: "0.5rem 1rem",
              background: "#4CAF50",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.9rem",
            }}
          >
            ← Back to Dashboard
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
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#2c2c2c" }}>Farm Information</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {profile.farmSizeAcres ? (
                <div>
                  <strong>Farm Size:</strong> {profile.farmSizeAcres.toFixed(4)} acres
                </div>
              ) : (
                <div style={{ color: "#666", fontStyle: "italic" }}>Farm size not set</div>
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
                    Parish *
                  </label>
                  <select
                    value={selectedParishId}
                    onChange={(e) => setSelectedParishId(e.target.value)}
                    required
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

          {/* Farm Size */}
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
                  <option value="emiigo">Emiigo</option>
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
              ) : farmSizeInput.unit === "emiigo" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Number of Emiigo
                  </label>
                  <input
                    type="number"
                    value={farmSizeInput.emiigo || ""}
                    onChange={(e) =>
                      setFarmSizeInput({ ...farmSizeInput, emiigo: parseFloat(e.target.value) })
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
            </div>
          </div>

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
