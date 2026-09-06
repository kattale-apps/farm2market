import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireQrAdmin } from "./qrAuth";

const fieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("email"),
  v.literal("phone"),
  v.literal("number"),
  v.literal("textarea"),
  v.literal("select"),
  v.literal("radio"),
  v.literal("checkbox"),
  v.literal("date")
);

export const createQrForm = mutation({
  args: {
    adminId: v.id("users"),
    qrCodeId: v.id("qrCodes"),
    title: v.string(),
    fields: v.array(
      v.object({
        fieldType: fieldTypeValidator,
        label: v.string(),
        required: v.boolean(),
        helpText: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "forms.create");

    const qrCode = await ctx.db.get(args.qrCodeId);
    if (!qrCode || qrCode.isDeleted) throw new Error("QR code not found.");

    const now = Date.now();
    const formId = await ctx.db.insert("qrForms", {
      qrCodeId: args.qrCodeId,
      title: args.title,
      createdBy: args.adminId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    for (let i = 0; i < args.fields.length; i++) {
      const field = args.fields[i];
      await ctx.db.insert("qrFormFields", {
        formId,
        fieldType: field.fieldType,
        label: field.label,
        required: field.required,
        helpText: field.helpText,
        options: field.options,
        order: i,
      });
    }

    await ctx.db.patch(args.qrCodeId, { formId, updatedAt: now });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "qr_form_create",
      targetUtid: qrCode.code,
      details: `Created form "${args.title}" for QR code "${qrCode.code}"`,
      timestamp: now,
    });

    return { formId };
  },
});

export const getQrForm = query({
  args: { adminId: v.id("users"), formId: v.id("qrForms") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "forms.view");
    const form = await ctx.db.get(args.formId);
    if (!form) return null;
    const fields = await ctx.db
      .query("qrFormFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    fields.sort((a, b) => a.order - b.order);
    return { form, fields };
  },
});

export const listFormSubmissions = query({
  args: { adminId: v.id("users"), formId: v.id("qrForms") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "forms.view");

    const fields = await ctx.db
      .query("qrFormFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    fields.sort((a, b) => a.order - b.order);

    const submissions = await ctx.db
      .query("qrFormSubmissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .order("desc")
      .take(200);

    const rows = await Promise.all(
      submissions.map(async (submission) => {
        const values = await ctx.db
          .query("qrFormSubmissionValues")
          .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
          .collect();
        const valueByField = new Map(values.map((v) => [v.fieldId, v.value]));
        return {
          submissionId: submission._id,
          createdAt: submission.createdAt,
          values: fields.map((f) => ({
            fieldId: f._id,
            label: f.label,
            value: valueByField.get(f._id) ?? "",
          })),
        };
      })
    );

    return { fields, submissions: rows };
  },
});

/** Public — anonymous submission from a QR landing page. No adminId required. */
export const submitQrForm = mutation({
  args: {
    formId: v.id("qrForms"),
    qrCodeId: v.id("qrCodes"),
    values: v.array(v.object({ fieldId: v.id("qrFormFields"), value: v.string() })),
    deviceCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form || !form.isActive) throw new Error("Form could not be saved.");

    const fields = await ctx.db
      .query("qrFormFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    const submittedByField = new Map(args.values.map((v) => [v.fieldId, v.value]));
    for (const field of fields) {
      if (field.required) {
        const value = submittedByField.get(field._id);
        if (!value || !value.trim()) {
          throw new Error(`"${field.label}" is required.`);
        }
      }
    }

    const now = Date.now();
    const submissionId = await ctx.db.insert("qrFormSubmissions", {
      formId: args.formId,
      qrCodeId: args.qrCodeId,
      createdAt: now,
      deviceCategory: args.deviceCategory,
    });

    for (const field of fields) {
      const value = submittedByField.get(field._id);
      if (value === undefined) continue;
      await ctx.db.insert("qrFormSubmissionValues", {
        submissionId,
        fieldId: field._id,
        value,
      });
    }

    return { success: true };
  },
});
