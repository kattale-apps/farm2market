"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useDebouncedCallback } from "use-debounce";

// Import section components (to be created)
import { Section1FarmerParticulars } from "./Section1FarmerParticulars";
import { Section2_1_Dairy } from "./sections/Section2_1_Dairy";
import { Section2_2_Poultry } from "./sections/Section2_2_Poultry";
import { Section2_3_Piggery } from "./sections/Section2_3_Piggery";
import { Section2_4_Cuniculture } from "./sections/Section2_4_Cuniculture";
import { Section2_5_Apiary } from "./sections/Section2_5_Apiary";
import { Section2_6_Aquaculture } from "./sections/Section2_6_Aquaculture";
import { Section2_7_Banana } from "./sections/Section2_7_Banana";
import { Section2_8_Maize } from "./sections/Section2_8_Maize";
import { Section2_9_FruitTrees } from "./sections/Section2_9_FruitTrees";
import { Section2_10_WoodyForest } from "./sections/Section2_10_WoodyForest";

interface Props {
  initialData: Doc<"agroFreshUGFarmValidations">;
}

const SECTION_TITLES = [
  "Section 1: Farmer Registration Information",
  "Section 2.1: Dairy Farming",
  "Section 2.2: Poultry Farming",
  "Section 2.3: Piggery",
  "Section 2.4: Rabbitry",
  "Section 2.5: Apiary",
  "Section 2.6: Aquaculture",
  "Section 2.7: Banana Plantation",
  "Section 2.8: Maize",
  "Section 2.9: Fruit Trees",
  "Section 2.10: Planted Forest",
  "Review & Submit",
];

export function AgroFreshUGValidationForm({ initialData }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    section1: true,
  });
  const [formData, setFormData] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const updateDraft = useMutation(api.farmValidation.updateDraft);
  const submitForm = useMutation(api.farmValidation.submitForm);
  const updateProfile = useMutation(api.farmerProfile.updateFarmerProfile);
  const createNewDraft = useMutation(api.farmValidation.createNewDraft) as (
    args: { farmerId: Id<"users"> }
  ) => Promise<Id<"agroFreshUGFarmValidations">>;
  const deleteDraft = useMutation(api.farmValidation.deleteDraft) as (
    args: { formId: Id<"agroFreshUGFarmValidations">; farmerId: Id<"users"> }
  ) => Promise<{ success: boolean }>;

  const profile = useQuery(api.farmerProfile.getFarmerProfile, { farmerId: initialData.farmerId });
  const applicationStatus = useQuery((api as any).communityApplications.getMyApplicationStatus, {
    farmerId: initialData.farmerId,
    formId: initialData._id,
  });

  // Debounced autosave function
  const debouncedSave = useDebouncedCallback(async (newData: Partial<Doc<"agroFreshUGFarmValidations">>) => {
    setIsSaving(true);
    try {
      await updateDraft({ formId: initialData._id, patch: newData });
    } catch (error) {
      console.error("Failed to save draft:", error);
      // Optionally show an error to the user
    } finally {
      setIsSaving(false);
    }
  }, 2000); // Autosave 2 seconds after the last change

  const debouncedSyncProfile = useDebouncedCallback(async (payload: {
    phoneNumber?: string;
    email?: string;
    county?: string;
    village?: string;
    waterSource?: string;
    districtText?: string;
    subCountyText?: string;
  }) => {
    try {
      await updateProfile({ farmerId: initialData.farmerId, ...payload });
    } catch (error) {
      console.error("Failed to sync profile:", error);
    }
  }, 1500);

  const handleUpdate = (section: keyof typeof formData, data: any) => {
    const newData = { ...formData, [section]: data };
    setFormData(newData);
    // Pass only the changed part to the backend
    debouncedSave({ [section]: data });

    if (section === "section1") {
      debouncedSyncProfile({
        phoneNumber: data?.phoneNumber,
        email: data?.emailAddress,
        county: data?.county,
        village: data?.village,
        waterSource: data?.waterSource,
        districtText: data?.districtSubCounty,
        subCountyText: data?.districtSubCounty,
      });
    }
  };

  const isReadOnly = applicationStatus?.status === "APPROVED";
  const preloadedWaterSource = formData.section1?.waterSource || profile?.waterSource;

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(180deg, #f6fbf2 0%, #e8f5e9 100%)",
        padding: "clamp(1rem, 4vw, 2.5rem)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          marginBottom: "1rem",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.6rem 1rem",
            borderRadius: "999px",
            background: "#ffffff",
            color: "#1b5e20",
            textDecoration: "none",
            fontWeight: 600,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
          }}
        >
          ← Back to Home
        </Link>
      </div>
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
          padding: "clamp(1rem, 3.5vw, 2rem)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 260 }}>
            <h1 style={{ marginTop: 0, fontSize: "clamp(1.4rem, 4.5vw, 2rem)", color: "#1b5e20" }}>
              AGROFRESH UG - Farmer Validation
            </h1>
            <div style={{ marginTop: "0.5rem", width: "min(260px, 80vw)" }}>
              <Image
                src="/agrofreshlogo.png"
                alt="AgroFresh UG"
                width={520}
                height={260}
                style={{ width: "100%", height: "auto", objectFit: "contain" }}
                priority
              />
            </div>
            <p style={{ color: "#2e7d32", fontWeight: 600, marginTop: "0.5rem" }}>
              Status: {isSaving ? "Saving..." : "Saved"}
            </p>
            {isReadOnly && (
              <p style={{ color: "#b45309", fontWeight: 600, marginTop: "0.25rem" }}>
                Editing locked — Membership approved. Create a new form to update.
              </p>
            )}
          </div>
          <button
            onClick={async () => {
              const confirmed = window.confirm("Delete this form and clear your saved data?");
              if (!confirmed) return;
              setIsDeleting(true);
              try {
                await deleteDraft({ formId: initialData._id, farmerId: initialData.farmerId });
                router.push("/farmer/communities");
              } catch (error: any) {
                console.error("Failed to delete draft:", error);
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #ef9a9a",
              background: isDeleting ? "#ffcdd2" : "#ffebee",
              color: "#c62828",
              fontWeight: 600,
              cursor: isDeleting ? "not-allowed" : "pointer",
              minWidth: "140px",
            }}
          >
            {isDeleting ? "Deleting..." : "Delete Form"}
          </button>
          <button
            onClick={async () => {
              try {
                const newFormId = await createNewDraft({ farmerId: initialData.farmerId });
                router.push(`/farm-validation/${newFormId}`);
              } catch (error) {
                console.error("Failed to create new form:", error);
              }
            }}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #c8e6c9",
              background: "#f1f8e9",
              color: "#2e7d32",
              fontWeight: 600,
              cursor: "pointer",
              minWidth: "160px",
            }}
          >
            Create New Form
          </button>
        </div>
      
        {message && (
          <div style={{ marginBottom: "1rem", color: message.type === "success" ? "#2e7d32" : "#c62828" }}>
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative", zIndex: 1 }}>
          {/* Section 1 */}
          <AccordionItem
            title={SECTION_TITLES[0]}
            icon="🧑🏾‍🌾"
            open={!!openSections.section1}
            onToggle={() => toggleSection("section1")}
          >
            <Section1FarmerParticulars
              data={formData.section1}
              onUpdate={(data) => handleUpdate("section1", data)}
              formId={initialData._id}
              prefill={{
                phoneNumber: profile?.phoneNumber || "",
                emailAddress: profile?.email || "",
                county: profile?.county || "",
                districtSubCounty: profile?.districtText || profile?.districtName || "",
                village: profile?.village || "",
                waterSource: profile?.waterSource || "",
              }}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[1]}
            icon="🐄"
            open={!!openSections.section2_1_dairy}
            onToggle={() => toggleSection("section2_1_dairy")}
          >
            <Section2_1_Dairy
              data={formData.section2_1_dairy}
              onUpdate={(data) => handleUpdate("section2_1_dairy", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[2]}
            icon="🐔"
            open={!!openSections.section2_2_poultry}
            onToggle={() => toggleSection("section2_2_poultry")}
          >
            <Section2_2_Poultry
              data={formData.section2_2_poultry}
              onUpdate={(data) => handleUpdate("section2_2_poultry", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[3]}
            icon="🐖"
            open={!!openSections.section2_3_piggery}
            onToggle={() => toggleSection("section2_3_piggery")}
          >
            <Section2_3_Piggery
              data={formData.section2_3_piggery}
              onUpdate={(data) => handleUpdate("section2_3_piggery", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[4]}
            icon="🐇"
            open={!!openSections.section2_4_rabbitry}
            onToggle={() => toggleSection("section2_4_rabbitry")}
          >
            <Section2_4_Cuniculture
              data={formData.section2_4_rabbitry}
              onUpdate={(data) => handleUpdate("section2_4_rabbitry", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[5]}
            icon="🐝"
            open={!!openSections.section2_5_apiary}
            onToggle={() => toggleSection("section2_5_apiary")}
          >
            <Section2_5_Apiary
              data={formData.section2_5_apiary}
              onUpdate={(data) => handleUpdate("section2_5_apiary", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[6]}
            icon="🐟"
            open={!!openSections.section2_6_aquaculture}
            onToggle={() => toggleSection("section2_6_aquaculture")}
          >
            <Section2_6_Aquaculture
              data={formData.section2_6_aquaculture}
              onUpdate={(data) => handleUpdate("section2_6_aquaculture", data)}
              readOnly={isReadOnly}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[7]}
            icon="🍌"
            open={!!openSections.section2_7_banana}
            onToggle={() => toggleSection("section2_7_banana")}
          >
            <Section2_7_Banana
              data={formData.section2_7_banana}
              onUpdate={(data) => handleUpdate("section2_7_banana", data)}
              readOnly={isReadOnly}
              preloadedWaterSource={preloadedWaterSource}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[8]}
            icon="🌽"
            open={!!openSections.section2_8_maize}
            onToggle={() => toggleSection("section2_8_maize")}
          >
            <Section2_8_Maize
              data={formData.section2_8_maize}
              onUpdate={(data) => handleUpdate("section2_8_maize", data)}
              readOnly={isReadOnly}
              preloadedWaterSource={preloadedWaterSource}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[9]}
            icon="🍋"
            open={!!openSections.section2_9_fruitTrees}
            onToggle={() => toggleSection("section2_9_fruitTrees")}
          >
            <Section2_9_FruitTrees
              data={formData.section2_9_fruitTrees}
              onUpdate={(data) => handleUpdate("section2_9_fruitTrees", data)}
              readOnly={isReadOnly}
              preloadedWaterSource={preloadedWaterSource}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[10]}
            icon="🌲"
            open={!!openSections.section2_10_plantedForest}
            onToggle={() => toggleSection("section2_10_plantedForest")}
          >
            <Section2_10_WoodyForest
              data={formData.section2_10_plantedForest}
              onUpdate={(data) => handleUpdate("section2_10_plantedForest", data)}
              readOnly={isReadOnly}
              preloadedWaterSource={preloadedWaterSource}
            />
          </AccordionItem>

          <AccordionItem
            title={SECTION_TITLES[11]}
            icon="✅"
            open={!!openSections.review}
            onToggle={() => toggleSection("review")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h2>Review</h2>
              <p>Review your entries, then submit using the button below.</p>
            </div>
          </AccordionItem>
        </div>

        <div
          style={{
            marginTop: "1.75rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            onClick={async () => {
              setIsSubmitting(true);
              setMessage(null);
              try {
                const missing = validateSection1(formData.section1);
                if (missing.length > 0) {
                  const first = missing[0];
                  setMessage({ type: "error", text: `Please complete: ${first.label}` });
                  scrollToField(first.fieldId);
                  return;
                }
                await submitForm({ formId: initialData._id });
                setMessage({
                  type: "success",
                  text: "Your form has been submitted. You can view status and update your form in the community profile view.",
                });
                setTimeout(() => {
                  router.push("/farmer/communities");
                }, 1000);
              } catch (error: any) {
                setMessage({ type: "error", text: error?.message || "Failed to submit" });
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting || isReadOnly}
            style={{
              padding: "0.85rem 1.5rem",
              background: isReadOnly ? "#cbd5e1" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: isSubmitting || isReadOnly ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.7rem 1.1rem",
              borderRadius: "999px",
              background: "#ffffff",
              color: "#1b5e20",
              textDecoration: "none",
              fontWeight: 600,
              border: "1px solid #e0e0e0",
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AccordionItem({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "0.9rem 1rem",
          background: "#f9fafb",
          border: "none",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {icon && <span aria-hidden="true">{icon}</span>}
          <span>{title}</span>
        </span>
        <span style={{ fontSize: "1.2rem" }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ padding: "1rem" }}>{children}</div>}
    </div>
  );
}

function validateSection1(section1?: Doc<"agroFreshUGFarmValidations">["section1"]) {
  const required: Array<{
    key: keyof NonNullable<Doc<"agroFreshUGFarmValidations">["section1"]>;
    label: string;
    fieldId: string;
  }> = [
    { key: "farmerFullName", label: "Full Name", fieldId: "section1-farmerFullName" },
    { key: "farmName", label: "Farm Name", fieldId: "section1-farmName" },
    { key: "phoneNumber", label: "Phone Number", fieldId: "section1-phoneNumber" },
    { key: "emailAddress", label: "Email Address", fieldId: "section1-emailAddress" },
    { key: "county", label: "County", fieldId: "section1-county" },
    { key: "districtSubCounty", label: "District/Sub-county", fieldId: "section1-districtSubCounty" },
    { key: "village", label: "Village", fieldId: "section1-village" },
    { key: "farmSizeAcres", label: "Farm Size (acres)", fieldId: "section1-farmSizeAcres" },
    { key: "totalAreaAgProductionAcres", label: "Total area under agricultural production", fieldId: "section1-totalAreaAgProductionAcres" },
    { key: "totalAreaPlantedForestAcres", label: "Total area under planted forest", fieldId: "section1-totalAreaPlantedForestAcres" },
    { key: "systemOfFarming", label: "System of farming", fieldId: "section1-systemOfFarming" },
    { key: "yearsOfExperience", label: "Years of experience", fieldId: "section1-yearsOfExperience" },
    { key: "waterSource", label: "Source of water", fieldId: "section1-waterSource" },
  ];
  const missing: Array<{ label: string; fieldId: string }> = [];
  required.forEach(({ key, label, fieldId }) => {
    if (!section1 || !section1[key]) {
      missing.push({ label, fieldId });
    }
  });
  return missing;
}

function scrollToField(fieldId: string) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(fieldId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement).focus?.();
  }
}