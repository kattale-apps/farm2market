/**
 * Goods QR codes, the platform-issued side: every lot listing, processing
 * batch and export lot gets a permanent short code when it is created. A
 * seller can reuse their code for a new listing of the same good, so labels
 * already printed on bags and crates keep working; the code remembers how
 * many listings it served and how often it was scanned.
 *
 * Helpers only, with no imports of other modules, so listings.ts,
 * processorOperations.ts and exportLots.ts can all issue codes without
 * import cycles. The scan page and the owner's views are in goodsCodes.ts.
 */

import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O or 1/I to misread on a label

/** The good in plain lower case: "Maize ", "maize" and "MAIZE" are the same good. */
export function goodKeyOf(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "F2M-" and six characters, easy to read off a label. */
export function newGoodsCodeText(random: () => number = Math.random): string {
  let code = "F2M-";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export type GoodsTarget =
  | { kind: "listing"; id: Id<"listings"> }
  | { kind: "batch"; id: Id<"processingBatches"> }
  | { kind: "exportLot"; id: Id<"exportLots"> };

function targetFields(target: GoodsTarget) {
  return {
    targetKind: target.kind,
    listingId: target.kind === "listing" ? target.id : undefined,
    batchId: target.kind === "batch" ? target.id : undefined,
    exportLotId: target.kind === "exportLot" ? target.id : undefined,
  };
}

/** What a seller's list shows next to a listing, batch or export lot: its QR and how often it was scanned. */
export async function goodsCodeSummary(ctx: QueryCtx | MutationCtx, codeId: Id<"goodsCodes"> | undefined) {
  const code = codeId ? await ctx.db.get(codeId) : null;
  return code ? { codeId: code._id, code: code.code, scanCount: code.scanCount, uses: code.uses } : null;
}

/**
 * Gives a new listing, batch or export lot its goods QR: the seller's code for
 * the same good when they chose to reuse it, otherwise a new one.
 */
export async function issueGoodsCode(
  ctx: MutationCtx,
  args: { ownerId: Id<"users">; goodLabel: string; target: GoodsTarget; reuseCodeId?: Id<"goodsCodes"> }
): Promise<Id<"goodsCodes">> {
  const now = Date.now();
  const goodKey = goodKeyOf(args.goodLabel);
  if (args.reuseCodeId) {
    const existing = await ctx.db.get(args.reuseCodeId);
    if (!existing || existing.ownerId !== args.ownerId) throw new Error("Choose one of your own QR codes");
    if (existing.goodKey !== goodKey) throw new Error(`That QR is for ${existing.goodLabel}: reuse it only for the same good`);
    await ctx.db.patch(existing._id, { ...targetFields(args.target), uses: existing.uses + 1, updatedAt: now });
    return existing._id;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = newGoodsCodeText();
    const taken = await ctx.db.query("goodsCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (taken) continue;
    return await ctx.db.insert("goodsCodes", {
      code,
      ownerId: args.ownerId,
      goodKey,
      goodLabel: args.goodLabel.trim(),
      ...targetFields(args.target),
      uses: 1,
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  throw new Error("Could not make a QR code, please try again");
}
