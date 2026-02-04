"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
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

const STEPS = [
  "Section 1: Farmer & Farm Particulars",
  "2.1 Dairy Farming",
  "2.2 Poultry Farming",
  "2.3 Piggery Farming",
  "2.4 Cuniculture / Rabbitry",
  "2.5 Apiary (Beekeeping)",
  "2.6 Aquaculture (Fish Farming)",
  "2.7 Banana Plantation",
  "2.8 Maize",
  "2.9 Fruit Trees",
  "2.10 Planted Woody Forest",
  "Review & Submit",
];

export function AgroFreshUGValidationForm({ initialData }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const stepStorageKey = `agrofresh_step_${initialData._id}`;
  const router = useRouter();

  const updateDraft = useMutation(api.farmValidation.updateDraft);
  const submitForm = useMutation(api.farmValidation.submitForm);
  const deleteDraft = useMutation(api.farmValidation.deleteDraft) as (
    args: { formId: Id<"agroFreshUGFarmValidations">; farmerId: Id<"users"> }
  ) => Promise<{ success: boolean }>;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedStep = window.localStorage.getItem(stepStorageKey);
    if (savedStep) {
      const parsed = Number(savedStep);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < STEPS.length) {
        setCurrentStep(parsed);
      }
    }
  }, [stepStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(stepStorageKey, String(currentStep));
  }, [currentStep, stepStorageKey]);

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

  const handleUpdate = (section: keyof typeof formData, data: any) => {
    const newData = { ...formData, [section]: data };
    setFormData(newData);
    // Pass only the changed part to the backend
    debouncedSave({ [section]: data });
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Section1FarmerParticulars
            data={formData.section1}
            onUpdate={(data) => handleUpdate("section1", data)}
            formId={initialData._id}
          />
        );
      case 1:
        return (
          <Section2_1_Dairy
            data={formData.section2_1_dairy}
            onUpdate={(data) => handleUpdate("section2_1_dairy", data)}
          />
        );
      case 2:
        return (
          <Section2_2_Poultry
            data={formData.section2_2_poultry}
            onUpdate={(data) => handleUpdate("section2_2_poultry", data)}
          />
        );
      case 3:
        return (
          <Section2_3_Piggery
            data={formData.section2_3_piggery}
            onUpdate={(data) => handleUpdate("section2_3_piggery", data)}
          />
        );
      case 4:
        return (
          <Section2_4_Cuniculture
            data={formData.section2_4_cuniculture}
            onUpdate={(data) => handleUpdate("section2_4_cuniculture", data)}
          />
        );
      case 5:
        return (
          <Section2_5_Apiary
            data={formData.section2_5_apiary}
            onUpdate={(data) => handleUpdate("section2_5_apiary", data)}
          />
        );
      case 6:
        return (
          <Section2_6_Aquaculture
            data={formData.section2_6_aquaculture}
            onUpdate={(data) => handleUpdate("section2_6_aquaculture", data)}
          />
        );
      case 7:
        return (
          <Section2_7_Banana
            data={formData.section2_7_banana}
            onUpdate={(data) => handleUpdate("section2_7_banana", data)}
          />
        );
      case 8:
        return (
          <Section2_8_Maize
            data={formData.section2_8_maize}
            onUpdate={(data) => handleUpdate("section2_8_maize", data)}
          />
        );
      case 9:
        return (
          <Section2_9_FruitTrees
            data={formData.section2_9_fruitTrees}
            onUpdate={(data) => handleUpdate("section2_9_fruitTrees", data)}
          />
        );
      case 10:
        return (
          <Section2_10_WoodyForest
            data={formData.section2_10_woodyForest}
            onUpdate={(data) => handleUpdate("section2_10_woodyForest", data)}
          />
        );
      case 11:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h2>Review & Submit</h2>
            <p>Review your entries, then submit for verification.</p>
            <button
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await submitForm({ formId: initialData._id });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              style={{
                padding: "0.75rem 1.25rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
                width: "fit-content",
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </div>
        );
      default:
        return <div>Section not implemented yet.</div>;
    }
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
            <img
              src="/agrofreshlogo.png"
              alt="AgroFresh UG"
              style={{
                marginTop: "0.5rem",
                width: "min(320px, 90vw)",
                height: "auto",
                objectFit: "contain",
              }}
            />
            <p style={{ color: "#2e7d32", fontWeight: 600, marginTop: "0.5rem" }}>
              Status: {isSaving ? "Saving..." : "Saved"}
            </p>
          </div>
          <button
            onClick={async () => {
              const confirmed = window.confirm("Delete this draft and clear all saved data?");
              if (!confirmed) return;
              setIsDeleting(true);
              try {
                await deleteDraft({ formId: initialData._id, farmerId: initialData.farmerId });
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(stepStorageKey);
                }
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
            {isDeleting ? "Deleting..." : "Delete Draft"}
          </button>
        </div>
      
        {/* Simple Stepper UI */}
        <div style={{ marginBottom: "1.25rem", color: "#2c2c2c", position: "relative", zIndex: 1 }}>
          <strong>Step {currentStep + 1} of {STEPS.length}:</strong> {STEPS[currentStep]}
        </div>


        <div style={{ position: "relative", zIndex: 1 }}>
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            style={{
              padding: "0.7rem 1.2rem",
              borderRadius: "8px",
              border: "1px solid #c8e6c9",
              background: currentStep === 0 ? "#f1f8e9" : "#ffffff",
              color: "#2e7d32",
              fontWeight: 600,
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
              minWidth: "120px",
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={currentStep === STEPS.length - 1}
            style={{
              padding: "0.7rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: currentStep === STEPS.length - 1 ? "#a5d6a7" : "#2e7d32",
              color: "#ffffff",
              fontWeight: 600,
              cursor: currentStep === STEPS.length - 1 ? "not-allowed" : "pointer",
              minWidth: "120px",
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}