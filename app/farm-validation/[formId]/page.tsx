"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AgroFreshUGValidationForm } from "../../components/AgroFreshUGValidationForm";

interface PageProps {
  params: {
    formId: Id<"agroFreshUGFarmValidations">;
  };
}

export default function FarmValidationPage({ params }: PageProps) {
  const { formId } = params;

  const form = useQuery(api.farmValidation.getFormById, { formId });

  if (form === undefined) {
    return <div>Loading form...</div>;
  }

  if (form === null) {
    return <div>Form not found or you do not have access.</div>;
  }

  return <AgroFreshUGValidationForm initialData={form} />;
}