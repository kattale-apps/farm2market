import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";

/**
 * Create a new community form
 */
export const createForm = mutation({
  args: {
    communityId: v.id("communities"),
    adminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin is authorized for this community
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const isDirectAdmin = (community as any).communityAdminId === args.adminId;
    let isAssignedAdmin = false;
    if (!isDirectAdmin) {
      const adminUser = await ctx.db.get(args.adminId);
      if (adminUser && adminUser.role === "admin") {
        const assigned: string[] = (adminUser as any).assignedCommunityIds || [];
        isAssignedAdmin = assigned.includes(String(args.communityId));
      }
    }
    if (!isDirectAdmin && !isAssignedAdmin) {
      throw new Error("Not authorized to create forms for this community");
    }

    const now = getUgandaTime();
    const formId = await ctx.db.insert("communityForms", {
      communityId: args.communityId,
      adminId: args.adminId,
      name: args.name,
      description: args.description,
      isActive: true,
      responseCount: 0,
      category: args.category,
      createdAt: now,
      updatedAt: now,
    });

    return { _id: formId, ...({
      communityId: args.communityId,
      adminId: args.adminId,
      name: args.name,
      description: args.description,
      isActive: true,
      responseCount: 0,
      createdAt: now,
      updatedAt: now,
    } as any) };
  },
});

/**
 * Update form metadata
 */
export const updateForm = mutation({
  args: {
    formId: v.id("communityForms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    const updates: any = { updatedAt: getUgandaTime() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.formId, updates);
    return { success: true };
  },
});

/**
 * Delete form and all related data
 */
export const deleteForm = mutation({
  args: {
    formId: v.id("communityForms"),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    // Delete all fields
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    for (const field of fields) {
      await ctx.db.delete(field._id);
    }

    // Delete all responses and values
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    for (const response of responses) {
      const values = await ctx.db
        .query("formResponseValues")
        .withIndex("by_response", (q) => q.eq("responseId", response._id))
        .collect();
      for (const value of values) {
        await ctx.db.delete(value._id);
      }
      await ctx.db.delete(response._id);
    }

    // Delete form
    await ctx.db.delete(args.formId);
    return { success: true };
  },
});

/**
 * Add a field to a form
 */
export const addFormField = mutation({
  args: {
    formId: v.id("communityForms"),
    fieldType: v.string(),
    label: v.string(),
    required: v.boolean(),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    isCalculated: v.optional(v.boolean()),
    formula: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    // Get next order
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    const nextOrder = fields.length + 1;

    const fieldId = await ctx.db.insert("formFields", {
      formId: args.formId,
      fieldType: args.fieldType,
      label: args.label,
      required: args.required,
      helpText: args.helpText,
      placeholder: args.placeholder,
      options: args.options,
      isCalculated: args.isCalculated,
      formula: args.formula,
      order: nextOrder,
      createdAt: getUgandaTime(),
    });

    return { _id: fieldId };
  },
});

/**
 * Update a form field
 */
export const updateFormField = mutation({
  args: {
    fieldId: v.id("formFields"),
    label: v.optional(v.string()),
    required: v.optional(v.boolean()),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    isCalculated: v.optional(v.boolean()),
    formula: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    const updates: any = {};
    if (args.label !== undefined) updates.label = args.label;
    if (args.required !== undefined) updates.required = args.required;
    if (args.helpText !== undefined) updates.helpText = args.helpText;
    if (args.placeholder !== undefined) updates.placeholder = args.placeholder;
    if (args.options !== undefined) updates.options = args.options;
    if (args.isCalculated !== undefined) updates.isCalculated = args.isCalculated;
    if (args.formula !== undefined) updates.formula = args.formula;

    await ctx.db.patch(args.fieldId, updates);
    return { success: true };
  },
});

/**
 * Remove a field from a form
 */
export const removeFormField = mutation({
  args: {
    fieldId: v.id("formFields"),
  },
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Delete all response values for this field
    const values = await ctx.db
      .query("formResponseValues")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .collect();
    for (const value of values) {
      await ctx.db.delete(value._id);
    }

    // Delete field
    await ctx.db.delete(args.fieldId);
    return { success: true };
  },
});

/**
 * Get all forms for a community
 */
export const getCommunityForms = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const forms = await ctx.db
      .query("communityForms")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .order("desc")
      .collect();

    return forms;
  },
});

/**
 * Get form details with all fields
 */
export const getFormDetails = query({
  args: {
    formId: v.id("communityForms"),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      return null;
    }

    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    // Sort by order
    const sortedFields = fields.sort((a, b) => a.order - b.order);

    return {
      ...form,
      fields: sortedFields,
    };
  },
});

/**
 * Submit a form response
 */
export const submitFormResponse = mutation({
  args: {
    formId: v.id("communityForms"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
    fieldValues: v.array(v.object({
      fieldId: v.id("formFields"),
      value: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    if (!(form as any).isActive) {
      throw new Error("This form is no longer accepting submissions");
    }

    // Create response
    const responseId = await ctx.db.insert("formResponses", {
      formId: args.formId,
      communityId: args.communityId,
      memberId: args.memberId,
      createdAt: getUgandaTime(),
      updatedAt: getUgandaTime(),
    });

    // Store field values
    for (const fv of args.fieldValues) {
      await ctx.db.insert("formResponseValues", {
        responseId,
        fieldId: fv.fieldId,
        value: fv.value,
        createdAt: getUgandaTime(),
      });
    }

    // Increment response count on form
    await ctx.db.patch(args.formId, {
      responseCount: ((form as any).responseCount || 0) + 1,
      updatedAt: getUgandaTime(),
    });

    return { _id: responseId };
  },
});

/**
 * Get all responses for a form (for export)
 */
export const getFormResponses = query({
  args: {
    formId: v.id("communityForms"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .order("desc")
      .collect();

    const form = await ctx.db.get(args.formId);
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    // Fetch all values for all responses
    const responseWithValues = await Promise.all(
      responses.map(async (response) => {
        const values = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", (q) => q.eq("responseId", response._id))
          .collect();

        const member = await ctx.db.get(response.memberId);

        return {
          _id: response._id,
          member: {
            alias: (member as any)?.alias || "Unknown",
            email: (member as any)?.email || "—",
            phoneNumber: (member as any)?.phoneNumber || "—",
          },
          values,
          createdAt: response.createdAt,
        };
      })
    );

    return {
      form,
      fields: fields.sort((a, b) => a.order - b.order),
      responses: responseWithValues,
    };
  },
});

/**
 * Get form export data (for billing calculation: rows × columns × price-per-cell)
 * Returns data in format suitable for Excel export and billing
 */
export const getFormExportData = query({
  args: {
    formId: v.id("communityForms"),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    const sortedFields = fields.sort((a, b) => a.order - b.order);

    // Build export rows
    const rows = await Promise.all(
      responses.map(async (response) => {
        const values = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", (q) => q.eq("responseId", response._id))
          .collect();

        const member = await ctx.db.get(response.memberId);
        const valueMap: Record<string, string> = {};
        values.forEach((v) => {
          valueMap[String(v.fieldId)] = v.value;
        });

        const row: any = {
          "Member Name": (member as any)?.alias || "Unknown",
          "Email": (member as any)?.email || "—",
          "Phone": (member as any)?.phoneNumber || "—",
          "Submitted": new Date(response.createdAt).toLocaleString(),
        };

        // Add form field values in order
        sortedFields.forEach((field) => {
          row[field.label] = valueMap[String(field._id)] || "";
        });

        return row;
      })
    );

    // Calculate billing: rows × columns × price-per-cell
    const rowCount = rows.length;
    const colCount = 4 + sortedFields.length; // Member Name, Email, Phone, Submitted + form fields
    const pricePerCell = 100; // UGX per cell (configurable)
    const totalCost = rowCount * colCount * pricePerCell;

    return {
      rows,
      rowCount,
      colCount,
      pricePerCell,
      totalCost,
      formName: (form as any).name,
    };
  },
});

// ─────────────── Business Tracker Extensions ───────────────

/**
 * Compute calculated field values based on formula.
 * Formula uses field labels (lowercased, spaces→underscores).
 * Only supports +, -, *, / with numeric values. No eval().
 */
function computeCalculatedFields(
  fields: any[],
  values: Record<string, string>
): Record<string, string> {
  const result = { ...values };
  // Build a label→value map
  const labelMap: Record<string, number> = {};
  for (const f of fields) {
    if (f.isCalculated) continue;
    const key = f.label.toLowerCase().replace(/\s+/g, "_");
    const num = parseFloat(result[String(f._id)] || "0");
    labelMap[key] = isNaN(num) ? 0 : num;
  }
  // Evaluate calculated fields
  for (const f of fields) {
    if (!f.isCalculated || !f.formula) continue;
    try {
      let expr = f.formula.toLowerCase().replace(/\s+/g, "_");
      // Replace label tokens with their numeric values
      for (const [label, val] of Object.entries(labelMap)) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expr = expr.replace(new RegExp(escaped, "g"), String(val));
      }
      // Simple arithmetic evaluation: only digits, +, -, *, /, ., (, )
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
      if (sanitized.length > 0) {
        const computed = Function('"use strict"; return (' + sanitized + ")")();
        result[String(f._id)] = String(Math.round(computed * 100) / 100);
      }
    } catch {
      result[String(f._id)] = "0";
    }
  }
  return result;
}

/**
 * Save or update a draft response (auto-save on keystroke, debounced on frontend)
 */
export const saveDraftResponse = mutation({
  args: {
    formId: v.id("communityForms"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
    fieldValues: v.array(v.object({
      fieldId: v.id("formFields"),
      value: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const now = getUgandaTime();
    // Find existing draft
    const existing = await ctx.db
      .query("formResponses")
      .withIndex("by_form_member", (q) =>
        q.eq("formId", args.formId).eq("memberId", args.memberId)
      )
      .collect();
    const draft = existing.find((r: any) => r.status === "DRAFT");

    let responseId: Id<"formResponses">;
    if (draft) {
      responseId = draft._id;
      await ctx.db.patch(responseId, { updatedAt: now });
      // Delete old values
      const oldValues = await ctx.db
        .query("formResponseValues")
        .withIndex("by_response", (q) => q.eq("responseId", responseId))
        .collect();
      for (const ov of oldValues) {
        await ctx.db.delete(ov._id);
      }
    } else {
      responseId = await ctx.db.insert("formResponses", {
        formId: args.formId,
        communityId: args.communityId,
        memberId: args.memberId,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Get fields for calculation
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    // Build value map and compute calculated fields
    const rawMap: Record<string, string> = {};
    for (const fv of args.fieldValues) {
      rawMap[String(fv.fieldId)] = fv.value;
    }
    const computed = computeCalculatedFields(fields, rawMap);

    // Insert all values
    for (const [fieldId, value] of Object.entries(computed)) {
      await ctx.db.insert("formResponseValues", {
        responseId,
        fieldId: fieldId as Id<"formFields">,
        value,
        createdAt: now,
      });
    }

    return { _id: responseId, status: "DRAFT" };
  },
});

/**
 * Get a member's draft response for a form
 */
export const getDraftResponse = query({
  args: {
    formId: v.id("communityForms"),
    memberId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_form_member", (q) =>
        q.eq("formId", args.formId).eq("memberId", args.memberId)
      )
      .collect();
    const draft = responses.find((r: any) => r.status === "DRAFT");
    if (!draft) return null;

    const values = await ctx.db
      .query("formResponseValues")
      .withIndex("by_response", (q) => q.eq("responseId", draft._id))
      .collect();

    return { ...draft, values };
  },
});

/**
 * Submit a draft (change DRAFT → SUBMITTED)
 */
export const submitDraft = mutation({
  args: {
    responseId: v.id("formResponses"),
    memberId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const response = await ctx.db.get(args.responseId);
    if (!response) throw new Error("Response not found");
    if (response.memberId !== args.memberId) throw new Error("Not authorized");

    await ctx.db.patch(args.responseId, {
      status: "SUBMITTED",
      updatedAt: getUgandaTime(),
    });

    // Increment response count on form
    const form = await ctx.db.get(response.formId);
    if (form) {
      await ctx.db.patch(response.formId, {
        responseCount: ((form as any).responseCount || 0) + 1,
        updatedAt: getUgandaTime(),
      });
    }

    return { success: true };
  },
});

/**
 * Get all submissions by a member for a community (My Transactions)
 */
export const getMySubmissions = query({
  args: {
    memberId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();

    const communityResponses = responses.filter(
      (r) => r.communityId === args.communityId && (r as any).status !== "DRAFT"
    );

    // Group by form
    const formIds = [...new Set(communityResponses.map((r) => r.formId))];
    const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));
    const formMap = new Map(forms.filter(Boolean).map((f: any) => [String(f._id), f]));

    const enriched = await Promise.all(
      communityResponses.map(async (r) => {
        const values = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", (q) => q.eq("responseId", r._id))
          .collect();
        return {
          ...r,
          formName: (formMap.get(String(r.formId)) as any)?.name || "Unknown Tracker",
          category: (formMap.get(String(r.formId)) as any)?.category || "custom",
          values,
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Seed tracker templates (idempotent — only inserts if table is empty)
 */
export const seedTrackerTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("trackerTemplates").first();
    if (existing) return { seeded: false, message: "Templates already exist" };

    const now = getUgandaTime();
    const templates = [
      {
        name: "Daily Revenue Tracker",
        description: "Track daily sales income by produce type",
        category: "revenue",
        fields: [
          { fieldType: "date", label: "Date", required: true },
          { fieldType: "text", label: "Produce Type", required: true, placeholder: "e.g. Maize, Coffee" },
          { fieldType: "number", label: "Quantity (kg)", required: true, placeholder: "0" },
          { fieldType: "number", label: "Price Per Kg", required: true, placeholder: "0" },
          { fieldType: "number", label: "Total Revenue", required: false, isCalculated: true, formula: "quantity_(kg) * price_per_kg" },
        ],
      },
      {
        name: "Expense Tracker",
        description: "Record farm and business expenses",
        category: "expense",
        fields: [
          { fieldType: "date", label: "Date", required: true },
          { fieldType: "select", label: "Category", required: true, options: ["Seeds", "Fertilizer", "Labour", "Transport", "Storage", "Equipment", "Other"] },
          { fieldType: "text", label: "Description", required: true, placeholder: "What was purchased?" },
          { fieldType: "number", label: "Amount", required: true, placeholder: "0" },
          { fieldType: "select", label: "Payment Method", required: false, options: ["Cash", "Mobile Money", "Bank Transfer", "Credit"] },
        ],
      },
      {
        name: "Inventory Tracker",
        description: "Track stock levels and produce in storage",
        category: "inventory",
        fields: [
          { fieldType: "date", label: "Date", required: true },
          { fieldType: "text", label: "Produce Type", required: true },
          { fieldType: "number", label: "Opening Stock (kg)", required: true, placeholder: "0" },
          { fieldType: "number", label: "Added (kg)", required: false, placeholder: "0" },
          { fieldType: "number", label: "Sold (kg)", required: false, placeholder: "0" },
          { fieldType: "number", label: "Closing Stock (kg)", required: false, isCalculated: true, formula: "opening_stock_(kg) + added_(kg) - sold_(kg)" },
        ],
      },
      {
        name: "Profit & Loss Summary",
        description: "Weekly or monthly profit/loss summary",
        category: "profit_loss",
        fields: [
          { fieldType: "text", label: "Period", required: true, placeholder: "e.g. Week 1 March 2026" },
          { fieldType: "number", label: "Total Revenue", required: true, placeholder: "0" },
          { fieldType: "number", label: "Total Expenses", required: true, placeholder: "0" },
          { fieldType: "number", label: "Net Profit", required: false, isCalculated: true, formula: "total_revenue - total_expenses" },
        ],
      },
      {
        name: "Cash Flow Tracker",
        description: "Track money in and money out",
        category: "cashflow",
        fields: [
          { fieldType: "date", label: "Date", required: true },
          { fieldType: "select", label: "Type", required: true, options: ["Inflow", "Outflow"] },
          { fieldType: "text", label: "Source / Destination", required: true },
          { fieldType: "number", label: "Amount", required: true, placeholder: "0" },
          { fieldType: "text", label: "Notes", required: false },
        ],
      },
      {
        name: "Harvest Record",
        description: "Track harvest quantities and quality",
        category: "revenue",
        fields: [
          { fieldType: "date", label: "Harvest Date", required: true },
          { fieldType: "text", label: "Crop", required: true },
          { fieldType: "number", label: "Quantity (kg)", required: true, placeholder: "0" },
          { fieldType: "select", label: "Quality Grade", required: true, options: ["Grade A", "Grade B", "Grade C", "Reject"] },
          { fieldType: "number", label: "Expected Price Per Kg", required: false, placeholder: "0" },
          { fieldType: "number", label: "Estimated Value", required: false, isCalculated: true, formula: "quantity_(kg) * expected_price_per_kg" },
        ],
      },
    ];

    for (const t of templates) {
      await ctx.db.insert("trackerTemplates", {
        name: t.name,
        description: t.description,
        category: t.category,
        fields: t.fields.map((f) => ({
          fieldType: f.fieldType,
          label: f.label,
          required: f.required,
          helpText: undefined,
          placeholder: f.placeholder,
          options: f.options,
          isCalculated: f.isCalculated,
          formula: f.formula,
        })),
        createdAt: now,
      });
    }

    return { seeded: true, message: `Seeded ${templates.length} templates` };
  },
});

/**
 * Get all tracker templates
 */
export const getTrackerTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trackerTemplates").collect();
  },
});

/**
 * Create a business tracker (communityForm + fields) from a template
 */
export const createTrackerFromTemplate = mutation({
  args: {
    templateId: v.id("trackerTemplates"),
    communityId: v.id("communities"),
    adminId: v.id("users"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    const now = getUgandaTime();
    const formId = await ctx.db.insert("communityForms", {
      communityId: args.communityId,
      adminId: args.adminId,
      name: args.name || template.name,
      description: template.description,
      isActive: true,
      responseCount: 0,
      category: template.category,
      createdAt: now,
      updatedAt: now,
    });

    // Create fields from template
    for (let i = 0; i < template.fields.length; i++) {
      const f = template.fields[i];
      await ctx.db.insert("formFields", {
        formId,
        fieldType: f.fieldType,
        label: f.label,
        required: f.required,
        helpText: f.helpText,
        placeholder: f.placeholder,
        options: f.options,
        isCalculated: f.isCalculated,
        formula: f.formula,
        order: i + 1,
        createdAt: now,
      });
    }

    return { _id: formId };
  },
});

/**
 * Performance Insights — Admin community-wide analytics
 * Returns aggregated numeric data from all submitted responses for a community
 */
export const getPerformanceInsights = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const forms = await ctx.db
      .query("communityForms")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    const insights: any[] = [];
    for (const form of forms) {
      const fields = await ctx.db
        .query("formFields")
        .withIndex("by_form", (q) => q.eq("formId", form._id))
        .collect();
      const numericFields = fields.filter((f) => f.fieldType === "number");
      if (numericFields.length === 0) continue;

      const responses = await ctx.db
        .query("formResponses")
        .withIndex("by_form", (q) => q.eq("formId", form._id))
        .collect();
      const submitted = responses.filter((r: any) => r.status !== "DRAFT");

      const totals: Record<string, number> = {};
      for (const nf of numericFields) {
        totals[nf.label] = 0;
      }

      for (const resp of submitted) {
        const vals = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", (q) => q.eq("responseId", resp._id))
          .collect();
        const valMap = new Map(vals.map((v) => [String(v.fieldId), v.value]));
        for (const nf of numericFields) {
          const num = parseFloat(valMap.get(String(nf._id)) || "0");
          if (!isNaN(num)) totals[nf.label] += num;
        }
      }

      insights.push({
        formId: form._id,
        formName: form.name,
        category: (form as any).category || "custom",
        submissionCount: submitted.length,
        totals,
      });
    }

    return insights;
  },
});

/**
 * Member Personal Insights — aggregated data for a single member
 */
export const getMemberInsights = query({
  args: {
    memberId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();
    const communityResponses = responses.filter(
      (r) => r.communityId === args.communityId && (r as any).status !== "DRAFT"
    );

    const formIds = [...new Set(communityResponses.map((r) => r.formId))];
    const insights: any[] = [];

    for (const formId of formIds) {
      const form = await ctx.db.get(formId);
      if (!form) continue;
      const fields = await ctx.db
        .query("formFields")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect();
      const numericFields = fields.filter((f) => f.fieldType === "number");
      if (numericFields.length === 0) continue;

      const myResponses = communityResponses.filter((r) => String(r.formId) === String(formId));
      const totals: Record<string, number> = {};
      for (const nf of numericFields) {
        totals[nf.label] = 0;
      }

      for (const resp of myResponses) {
        const vals = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", (q) => q.eq("responseId", resp._id))
          .collect();
        const valMap = new Map(vals.map((v) => [String(v.fieldId), v.value]));
        for (const nf of numericFields) {
          const num = parseFloat(valMap.get(String(nf._id)) || "0");
          if (!isNaN(num)) totals[nf.label] += num;
        }
      }

      insights.push({
        formId,
        formName: (form as any).name,
        category: (form as any).category || "custom",
        submissionCount: myResponses.length,
        totals,
      });
    }

    return insights;
  },
});

/**
 * Admin drill-down: per-member breakdown for a specific form
 */
export const getMemberBreakdown = query({
  args: {
    formId: v.id("communityForms"),
  },
  handler: async (ctx, args) => {
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    const numericFields = fields.filter((f) => f.fieldType === "number");

    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    const submitted = responses.filter((r: any) => r.status !== "DRAFT");

    // Group by member
    const memberMap = new Map<string, { totals: Record<string, number>; count: number }>();
    for (const resp of submitted) {
      const key = String(resp.memberId);
      if (!memberMap.has(key)) {
        const init: Record<string, number> = {};
        for (const nf of numericFields) init[nf.label] = 0;
        memberMap.set(key, { totals: init, count: 0 });
      }
      const entry = memberMap.get(key)!;
      entry.count++;

      const vals = await ctx.db
        .query("formResponseValues")
        .withIndex("by_response", (q) => q.eq("responseId", resp._id))
        .collect();
      const valMap = new Map(vals.map((v) => [String(v.fieldId), v.value]));
      for (const nf of numericFields) {
        const num = parseFloat(valMap.get(String(nf._id)) || "0");
        if (!isNaN(num)) entry.totals[nf.label] += num;
      }
    }

    // Resolve member names
    const results: any[] = [];
    for (const [memberId, data] of memberMap.entries()) {
      const member = await ctx.db.get(memberId as Id<"users">);
      results.push({
        memberId,
        memberName: (member as any)?.alias || (member as any)?.email || "Unknown",
        submissionCount: data.count,
        totals: data.totals,
      });
    }

    return results.sort((a, b) => b.submissionCount - a.submissionCount);
  },
});
