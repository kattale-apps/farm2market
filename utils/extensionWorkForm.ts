export type ExtensionWorkFormConfig = {
  paymentEnabled?: boolean;
  paymentAmount?: number;
  paymentAmountEditable?: boolean;
  formPurpose?: string;
};

export function getEffectivePaymentAmount(
  form: ExtensionWorkFormConfig | null | undefined,
  enteredAmount?: string | number | null,
): number | null {
  const isExtensionWorkPaymentGate = Boolean(
    form?.formPurpose === "extension_work" && form?.paymentAmountEditable,
  );

  if (!form?.paymentEnabled && !isExtensionWorkPaymentGate) return null;

  if (typeof enteredAmount === "number") {
    return enteredAmount;
  }

  if (typeof enteredAmount === "string") {
    const parsed = Number(enteredAmount);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof form?.paymentAmount === "number") {
    return form.paymentAmount;
  }

  return null;
}

export function getPaymentEntryConfig(form: ExtensionWorkFormConfig | null | undefined) {
  const isExtensionWorkPaymentGate = Boolean(
    form?.formPurpose === "extension_work" && form?.paymentAmountEditable,
  );
  const requiresPayment = Boolean(
    form?.formPurpose === "extension_work" && (form?.paymentEnabled || isExtensionWorkPaymentGate),
  );
  const canEditAmount = requiresPayment && Boolean(form?.paymentAmountEditable);
  const showAmountInput = requiresPayment && (canEditAmount || typeof form?.paymentAmount === "number");

  return {
    requiresPayment,
    canEditAmount,
    showAmountInput,
  };
}

export function getPaymentStatusLabel(status?: string | null): string {
  if (!status) return "Pending";

  const normalized = status.toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "failed") return "Failed";
  if (normalized === "cancelled") return "Cancelled";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
