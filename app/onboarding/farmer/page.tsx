"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FarmerOnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  
  // Location data
  const districts = useQuery(api.locations.getActiveDistricts, {});
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

  // Farm size input
  const [farmSizeUnit, setFarmSizeUnit] = useState<"ft" | "m" | "omwigo" | "emiigo">("ft");
  const [farmSizeLength, setFarmSizeLength] = useState("");
  const [farmSizeWidth, setFarmSizeWidth] = useState("");
  const [farmSizeOmwigo, setFarmSizeOmwigo] = useState("");
  const [farmSizeEmiigo, setFarmSizeEmiigo] = useState("");

  const completeOnboarding = useMutation(api.farmerOnboarding.completeOnboarding);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Get current user from localStorage (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) {
            setUserId(parsed.userId as Id<"users">);
          }
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
      }
    }
  }, []);

  // Check onboarding status
  const onboardingStatus = useQuery(
    api.farmerOnboarding.checkOnboardingStatus,
    userId ? { farmerId: userId } : "skip"
  );

  // Redirect if already completed
  useEffect(() => {
    if (onboardingStatus?.completed) {
      router.push("/");
    }
  }, [onboardingStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      setMessage({ type: "error", text: "Please log in first" });
      return;
    }

    if (!selectedDistrictId || !selectedSubcountyId || !selectedParishId) {
      setMessage({ type: "error", text: "Please select District, Subcounty, and Parish" });
      return;
    }

    // Build farm size input
    let farmSizeInput: any = {};
    if (farmSizeUnit === "omwigo") {
      if (!farmSizeOmwigo || parseFloat(farmSizeOmwigo) <= 0) {
        setMessage({ type: "error", text: "Please enter a valid number of Omwigo" });
        return;
      }
      farmSizeInput.omwigo = parseFloat(farmSizeOmwigo);
    } else if (farmSizeUnit === "emiigo") {
      if (!farmSizeEmiigo || parseFloat(farmSizeEmiigo) <= 0) {
        setMessage({ type: "error", text: "Please enter a valid number of Emiigo" });
        return;
      }
      farmSizeInput.emiigo = parseFloat(farmSizeEmiigo);
    } else {
      if (!farmSizeLength || !farmSizeWidth || parseFloat(farmSizeLength) <= 0 || parseFloat(farmSizeWidth) <= 0) {
        setMessage({ type: "error", text: "Please enter valid length and width" });
        return;
      }
      farmSizeInput.unit = farmSizeUnit;
      farmSizeInput.length = parseFloat(farmSizeLength);
      farmSizeInput.width = parseFloat(farmSizeWidth);
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await completeOnboarding({
        farmerId: userId,
        districtId: selectedDistrictId as Id<"districts">,
        subcountyId: selectedSubcountyId as Id<"subcounties">,
        parishId: selectedParishId as Id<"parishes">,
        farmSizeInput,
      });

      setMessage({ type: "success", text: `Onboarding completed! UTID: ${result.utid}. Farm size: ${result.farmSizeAcres.toFixed(4)} acres.` });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to complete onboarding" });
    } finally {
      setLoading(false);
    }
  };

  // Reset subcounty/parish when district changes
  useEffect(() => {
    setSelectedSubcountyId("");
    setSelectedParishId("");
  }, [selectedDistrictId]);

  // Reset parish when subcounty changes
  useEffect(() => {
    setSelectedParishId("");
  }, [selectedSubcountyId]);

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to complete onboarding.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        Complete Your Profile
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Please provide your location and farm size to continue. This information is required before you can create listings.
      </p>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Location Selection */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem" }}>
            Location
          </h2>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
              District *
            </label>
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value as Id<"districts"> | "")}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">Select District</option>
              {districts?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {selectedDistrictId && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Subcounty *
              </label>
              <select
                value={selectedSubcountyId}
                onChange={(e) => setSelectedSubcountyId(e.target.value as Id<"subcounties"> | "")}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
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
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Parish *
              </label>
              <select
                value={selectedParishId}
                onChange={(e) => setSelectedParishId(e.target.value as Id<"parishes"> | "")}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
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

        {/* Farm Size */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.5rem)", marginBottom: "1rem" }}>
            Farm Size
          </h2>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
              Measurement Unit *
            </label>
            <select
              value={farmSizeUnit}
              onChange={(e) => setFarmSizeUnit(e.target.value as "ft" | "m" | "omwigo" | "emiigo")}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="ft">Feet × Feet</option>
              <option value="m">Meters × Meters</option>
              <option value="omwigo">Omwigo (10×100 ft)</option>
              <option value="emiigo">Emiigo (Multiple Omwigo)</option>
            </select>
          </div>

          {farmSizeUnit === "ft" || farmSizeUnit === "m" ? (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Length ({farmSizeUnit === "ft" ? "ft" : "m"}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={farmSizeLength}
                  onChange={(e) => setFarmSizeLength(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Width ({farmSizeUnit === "ft" ? "ft" : "m"}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={farmSizeWidth}
                  onChange={(e) => setFarmSizeWidth(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </>
          ) : farmSizeUnit === "omwigo" ? (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Number of Omwigo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={farmSizeOmwigo}
                onChange={(e) => setFarmSizeOmwigo(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
              <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.5rem" }}>
                1 Omwigo = 10 × 100 ft = 1000 sq ft
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Number of Emiigo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={farmSizeEmiigo}
                onChange={(e) => setFarmSizeEmiigo(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
              <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.5rem" }}>
                Emiigo = Multiple Omwigo (1 Omwigo = 10 × 100 ft)
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1.1rem",
            fontWeight: "600",
            background: loading ? "#ccc" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Completing..." : "Complete Onboarding"}
        </button>
      </form>
    </div>
  );
}
