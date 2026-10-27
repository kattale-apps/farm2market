/**
 * MarketSpace questions and answers (rules in convex/enquiriesShared.ts).
 *
 * Buyers ask from the super admin's question pool; the poster answers with
 * typed inputs; answers are shared with every viewer allowed to see the post.
 * Suppliers respond to wanted ads the same way. There is no free text between
 * buyer and seller: anything missing goes to Farm2Market ("Message
 * Farm2Market"), and the super admin adds the question to the pool.
 *
 * Who is asking always comes from the session token, never from an argument.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  ADMIN_NOTE_MAX,
  MAX_ASKS_PER_POST,
  MAX_QUESTIONS_PER_ASK,
  STARTER_QUESTIONS,
  answerText,
  answerTypeValidator,
  answerValidator,
  audienceValidator,
  audiencesOf,
  checkAnswer,
  questionFits,
  questionMode,
  questionProblem,
  type Answer,
} from "./enquiriesShared";
import { cardIsLive, isLiteFor, liteReason, produceVisible } from "./marketspaceShared";
import { notifyOwner, requireSuperAdmin, requireUser, viewerOf } from "./marketspace";
import { lotBuyingAccess } from "./lotOrders";
import { todayUganda } from "./exportMarkets";
import { roleLabel } from "./roleLabels";

type Ctx = QueryCtx | MutationCtx;
type Question = Doc<"enquiryQuestions">;

const answersArg = v.array(v.object({ questionId: v.id("enquiryQuestions"), answer: answerValidator }));

async function activeQuestions(ctx: Ctx): Promise<Question[]> {
  return await ctx.db
    .query("enquiryQuestions")
    .withIndex("by_active_and_sortOrder", (q) => q.eq("active", true))
    .take(100);
}

async function cardEnquiries(ctx: Ctx, cardId: Id<"marketCards">) {
  return await ctx.db
    .query("enquiries")
    .withIndex("by_card_and_question", (q) => q.eq("cardId", cardId))
    .take(100);
}

/** The post's own UTID, so notifications link to it. */
async function sourceUtid(ctx: Ctx, card: Doc<"marketCards">): Promise<string | undefined> {
  if (card.listingId) return (await ctx.db.get(card.listingId))?.utid;
  if (card.adId) return (await ctx.db.get(card.adId))?.utid;
  return undefined;
}

async function liveCard(ctx: MutationCtx, cardId: Id<"marketCards">): Promise<Doc<"marketCards">> {
  const card = await ctx.db.get(cardId);
  if (!card || !cardIsLive(card, getUgandaTime())) throw new Error("This post is no longer on MarketSpace.");
  return card;
}

/** A question for an answer form: its rule and wording. */
function formOf(q: Question) {
  return { questionId: q._id, text: q.text, answerType: q.answerType, unit: q.unit ?? null, choices: q.choices ?? [] };
}

// ------------------------------------------------------------------
// The post's questions, for whoever is viewing
// ------------------------------------------------------------------

/**
 * Everything the questions panel of a post shows. Viewers with the full card
 * see the answers; lite viewers see only how many there are. The poster gets
 * every question that fits the post, to answer or pre-answer, and the
 * responses to a wanted ad.
 */
export const forCard = query({
  args: { cardId: v.string(), now: v.number(), today: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cardId = ctx.db.normalizeId("marketCards", args.cardId);
    const card = cardId ? await ctx.db.get(cardId) : null;
    if (!card) return null;
    const viewer = await viewerOf(ctx, args.sessionToken, args.today);
    const isMine = !!viewer.user && viewer.user._id === card.sellerId;
    if (!isMine && !cardIsLive(card, args.now)) return null;
    if (!produceVisible(card, { tier: viewer.tier, role: viewer.user?.role ?? null, isMine })) return null; // The commercial farmer rule
    const full = !isLiteFor(card.view, viewer.tier, isMine);
    const mode = questionMode(card);
    const pool = (await activeQuestions(ctx)).filter((q) => questionFits(q.appliesTo, audiencesOf(card)));
    const questions = new Map(pool.map((q) => [q._id, q]));
    const rows = await cardEnquiries(ctx, card._id);
    for (const row of rows) {
      if (!questions.has(row.questionId)) {
        const q = await ctx.db.get(row.questionId); // Answered before the admin retired the question
        if (q) questions.set(q._id, q);
      }
    }

    const answered = rows.filter((r) => r.answer);
    const waiting = rows.filter((r) => !r.answer && r.askCount > 0);
    const myAsks = viewer.user && !isMine
      ? await ctx.db
          .query("enquiryAsks")
          .withIndex("by_asker_and_card", (q) => q.eq("askerId", viewer.user!._id).eq("cardId", card._id))
          .take(MAX_ASKS_PER_POST + 1)
      : [];
    const askedByMe = new Set(myAsks.map((a) => a.enquiryId));
    const answeredIds = new Set(answered.map((r) => r.questionId));
    const mineAsked = new Set(rows.filter((r) => askedByMe.has(r._id)).map((r) => r.questionId));

    let reason: string | null = null;
    if (!isMine) {
      if (viewer.tier === "public") reason = mode === "ask" ? "Sign up as a buyer to ask questions." : "Log in to respond to this wanted ad.";
      else if (!full) reason = liteReason(viewer.tier);
    }
    const canAct = !isMine && reason === null;

    // Wanted ads: the supplier's own response, or every response for the poster
    let myResponse: { questionId: Id<"enquiryQuestions">; answer: Answer }[] | null = null;
    const responses: { responder: string; updatedAt: number; answers: { text: string; answer: string }[] }[] = [];
    if (mode === "respond" && viewer.user) {
      if (isMine) {
        const rowsIn = await ctx.db
          .query("wantedResponses")
          .withIndex("by_card_and_updatedAt", (q) => q.eq("cardId", card._id))
          .order("desc")
          .take(50);
        for (const r of rowsIn) {
          const who = await ctx.db.get(r.responderId);
          responses.push({
            responder: who ? `${roleLabel(who.role)} ${who.alias ?? ""}`.trim() : "Member",
            updatedAt: r.updatedAt,
            answers: r.answers.flatMap((a) => {
              const q = questions.get(a.questionId);
              return q ? [{ text: q.text, answer: answerText(q, a.answer) }] : [];
            }),
          });
        }
      } else {
        const mine = await ctx.db
          .query("wantedResponses")
          .withIndex("by_card_and_responder", (q) => q.eq("cardId", card._id).eq("responderId", viewer.user!._id))
          .unique();
        myResponse = mine?.answers ?? null;
      }
    }

    return {
      title: card.title,
      mode,
      isMine,
      full,
      reason,
      answeredCount: answered.length,
      answered: full
        ? answered.flatMap((r) => {
            const q = questions.get(r.questionId);
            return q ? [{ questionId: r.questionId, text: q.text, answer: answerText(q, r.answer!) }] : [];
          })
        : [],
      waiting: full
        ? waiting.flatMap((r) => {
            const q = questions.get(r.questionId);
            return q ? [{ questionId: r.questionId, text: q.text, askCount: r.askCount, askedByMe: askedByMe.has(r._id) }] : [];
          })
        : [],
      // Ask mode: what this buyer can still ask
      askable: canAct && mode === "ask" ? pool.filter((q) => !answeredIds.has(q._id) && !mineAsked.has(q._id)).map((q) => ({ questionId: q._id, text: q.text })) : [],
      asksLeft: Math.max(0, MAX_ASKS_PER_POST - myAsks.length),
      // Respond mode: the poster's questions for suppliers
      respondForm: canAct && mode === "respond" ? pool.map(formOf) : [],
      myResponse,
      responses,
      // The poster: every question that fits, with its current answer (to answer or pre-answer)
      toAnswer:
        isMine && mode === "ask"
          ? [...questions.values()]
              .filter((q) => q.active || answeredIds.has(q._id) || waiting.some((w) => w.questionId === q._id))
              .map((q) => {
                const row = rows.find((r) => r.questionId === q._id);
                return { ...formOf(q), askCount: row?.askCount ?? 0, answer: row?.answer ?? null };
              })
              .sort((a, b) => (b.askCount > 0 && !b.answer ? 1 : 0) - (a.askCount > 0 && !a.answer ? 1 : 0))
          : [],
    };
  },
});

// ------------------------------------------------------------------
// Buyers ask, posters answer, suppliers respond
// ------------------------------------------------------------------

/** A buyer ticks up to 5 questions. Questions already answered are on the post; ones already asked add the buyer to the waiting list. */
export const ask = mutation({
  args: { sessionToken: v.string(), cardId: v.id("marketCards"), questionIds: v.array(v.id("enquiryQuestions")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const card = await liveCard(ctx, args.cardId);
    if (card.sellerId === user._id) throw new Error("This is your own post.");
    if (questionMode(card) !== "ask") throw new Error("Wanted ads take responses, not questions.");
    const tier = (await lotBuyingAccess(ctx, user, todayUganda())).ok ? "verified" : "member";
    if (isLiteFor(card.view, tier)) throw new Error(liteReason(tier));
    if (!produceVisible(card, { tier, role: user.role, isMine: false })) throw new Error("This post is no longer on MarketSpace.");

    const ids = [...new Set(args.questionIds)];
    if (ids.length === 0) throw new Error("Choose at least one question.");
    if (ids.length > MAX_QUESTIONS_PER_ASK) throw new Error(`Ask up to ${MAX_QUESTIONS_PER_ASK} questions at a time.`);
    const myAsks = await ctx.db
      .query("enquiryAsks")
      .withIndex("by_asker_and_card", (q) => q.eq("askerId", user._id).eq("cardId", card._id))
      .take(MAX_ASKS_PER_POST + 1);
    if (myAsks.length + ids.length > MAX_ASKS_PER_POST) {
      throw new Error(`You can ask up to ${MAX_ASKS_PER_POST} questions on one post. You have ${Math.max(0, MAX_ASKS_PER_POST - myAsks.length)} left.`);
    }

    const now = getUgandaTime();
    const audiences = audiencesOf(card);
    const asked: string[] = [];
    for (const questionId of ids) {
      const q = await ctx.db.get(questionId);
      if (!q || !q.active || !questionFits(q.appliesTo, audiences)) throw new Error("That question is not available for this post.");
      const existing = await ctx.db
        .query("enquiries")
        .withIndex("by_card_and_question", (x) => x.eq("cardId", card._id).eq("questionId", questionId))
        .unique();
      if (existing?.answer) continue; // Already answered: the answer is on the post
      if (existing && myAsks.some((a) => a.enquiryId === existing._id)) continue; // Asked it before
      const enquiryId = existing?._id ?? (await ctx.db.insert("enquiries", { cardId: card._id, questionId, sellerId: card.sellerId, askCount: 0, createdAt: now }));
      await ctx.db.patch(enquiryId, { askCount: (existing?.askCount ?? 0) + 1, lastAskedAt: now });
      await ctx.db.insert("enquiryAsks", { enquiryId, cardId: card._id, askerId: user._id, createdAt: now });
      asked.push(q.text);
    }
    if (asked.length > 0) {
      await notifyOwner(
        ctx,
        card.sellerId,
        `${asked.length} question${asked.length === 1 ? "" : "s"} about ${card.title}`,
        `A buyer asked: ${asked.join(" · ")} Answer in MarketSpace, My posts. Answers help every buyer.`,
        await sourceUtid(ctx, card)
      );
    }
    return { asked: asked.length };
  },
});

/** The poster answers (or pre-answers) questions with typed answers. Buyers who asked hear about it. */
export const answer = mutation({
  args: { sessionToken: v.string(), cardId: v.id("marketCards"), answers: answersArg },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const card = await ctx.db.get(args.cardId);
    if (!card || card.sellerId !== user._id) throw new Error("Post not found.");
    if (questionMode(card) !== "ask") throw new Error("Wanted ads take responses, not questions.");
    if (args.answers.length === 0) throw new Error("Answer at least one question.");
    if (args.answers.length > 20) throw new Error("Answer up to 20 questions at a time.");

    const now = getUgandaTime();
    const audiences = audiencesOf(card);
    const answeredFor = new Map<Id<"users">, string[]>();
    for (const item of args.answers) {
      const q = await ctx.db.get(item.questionId);
      const existing = await ctx.db
        .query("enquiries")
        .withIndex("by_card_and_question", (x) => x.eq("cardId", card._id).eq("questionId", item.questionId))
        .unique();
      if (!q || (!existing && (!q.active || !questionFits(q.appliesTo, audiences)))) throw new Error("That question is not available for this post.");
      const checked = checkAnswer(q, item.answer);
      if ("problem" in checked) throw new Error(`${q.text} ${checked.problem}.`);
      if (existing) {
        await ctx.db.patch(existing._id, { answer: checked.answer, answeredAt: now });
        if (!existing.answer) {
          const asks = await ctx.db.query("enquiryAsks").withIndex("by_enquiry", (x) => x.eq("enquiryId", existing._id)).take(200);
          for (const a of asks) answeredFor.set(a.askerId, [...(answeredFor.get(a.askerId) ?? []), q.text]);
        }
      } else {
        await ctx.db.insert("enquiries", { cardId: card._id, questionId: q._id, sellerId: card.sellerId, askCount: 0, answer: checked.answer, answeredAt: now, createdAt: now });
      }
    }
    const utid = await sourceUtid(ctx, card);
    for (const [askerId, texts] of answeredFor) {
      await notifyOwner(ctx, askerId, `Answered: ${card.title}`, `The seller answered: ${texts.join(" · ")} See the answers on the post.`, utid);
    }
    return { saved: args.answers.length };
  },
});

/** A supplier answers a wanted ad's questions; only the poster sees it, by the supplier's alias. */
export const respond = mutation({
  args: { sessionToken: v.string(), cardId: v.id("marketCards"), answers: answersArg },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const card = await liveCard(ctx, args.cardId);
    if (card.sellerId === user._id) throw new Error("This is your own wanted ad.");
    if (questionMode(card) !== "respond") throw new Error("Only wanted ads take responses.");
    if (args.answers.length === 0) throw new Error("Answer at least one question.");
    if (args.answers.length > 10) throw new Error("Answer up to 10 questions.");

    const answers: { questionId: Id<"enquiryQuestions">; answer: Answer }[] = [];
    for (const item of args.answers) {
      const q = await ctx.db.get(item.questionId);
      if (!q || !q.active || !questionFits(q.appliesTo, audiencesOf(card))) throw new Error("That question is not available for this ad.");
      const checked = checkAnswer(q, item.answer);
      if ("problem" in checked) throw new Error(`${q.text} ${checked.problem}.`);
      answers.push({ questionId: q._id, answer: checked.answer });
    }
    const now = getUgandaTime();
    const existing = await ctx.db
      .query("wantedResponses")
      .withIndex("by_card_and_responder", (q) => q.eq("cardId", card._id).eq("responderId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { answers, updatedAt: now });
    } else {
      const count = (await ctx.db.query("wantedResponses").withIndex("by_card_and_updatedAt", (q) => q.eq("cardId", card._id)).take(200)).length;
      if (count >= 200) throw new Error("This wanted ad has all the responses it can take.");
      await ctx.db.insert("wantedResponses", { cardId: card._id, posterId: card.sellerId, responderId: user._id, answers, createdAt: now, updatedAt: now });
      await notifyOwner(
        ctx,
        card.sellerId,
        `A supplier responded: ${card.title}`,
        `${roleLabel(user.role)} ${user.alias ?? ""} answered your wanted ad. See responses in MarketSpace, My posts. To go ahead, message Farm2Market.`.replace(/\s+/g, " "),
        await sourceUtid(ctx, card)
      );
    }
    return { saved: true };
  },
});

/** "Missing a question?": a short note to the super admin on the support thread, who can add it to the pool. */
export const messageFarm2Market = mutation({
  args: { sessionToken: v.string(), cardId: v.id("marketCards"), note: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Post not found.");
    const note = args.note.trim();
    if (note.length < 3 || note.length > ADMIN_NOTE_MAX) throw new Error(`Write 3 to ${ADMIN_NOTE_MAX} letters.`);
    const dayAgo = getUgandaTime() - 24 * 60 * 60 * 1000;
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_from_user", (q) => q.eq("fromUserId", user._id))
      .order("desc")
      .take(10);
    if (recent.filter((m) => m.createdAt > dayAgo).length >= 10) throw new Error("You have sent many messages today. Try again tomorrow.");
    const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(50);
    const superAdmin = admins.find((a) => a.adminLevel === "super" || a.adminLevel === undefined);
    if (!superAdmin) throw new Error("Farm2Market cannot be reached right now. Try again later.");
    await ctx.db.insert("messages", {
      fromUserId: user._id,
      toUserId: superAdmin._id,
      utid: "SUPPORT",
      message: `MarketSpace question for "${card.title}" (post ${card._id}): ${note}`,
      read: false,
      createdAt: getUgandaTime(),
    });
    return { sent: true };
  },
});

// ------------------------------------------------------------------
// The question pool (super admin)
// ------------------------------------------------------------------

/** The whole pool for the super admin (null for anyone else), live questions first. */
export const adminQuestions = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      await requireSuperAdmin(ctx, args.sessionToken);
    } catch {
      return null;
    }
    const all = await ctx.db.query("enquiryQuestions").take(200);
    return all.sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder);
  },
});

/** Adds or changes a question. A question's answer type is fixed once made, so old answers keep their meaning. */
export const saveQuestion = mutation({
  args: {
    sessionToken: v.string(),
    questionId: v.optional(v.id("enquiryQuestions")),
    text: v.string(),
    answerType: answerTypeValidator,
    unit: v.optional(v.string()),
    choices: v.optional(v.array(v.string())),
    appliesTo: v.array(audienceValidator),
    active: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.sessionToken);
    const problem = questionProblem(args);
    if (problem) throw new Error(problem);
    const fields = {
      text: args.text.trim(),
      answerType: args.answerType,
      unit: args.answerType === "number" ? args.unit?.trim() || undefined : undefined,
      choices: args.answerType === "choice" ? (args.choices ?? []).map((c) => c.trim()).filter(Boolean) : undefined,
      appliesTo: [...new Set(args.appliesTo)],
      active: args.active,
      sortOrder: args.sortOrder,
      updatedAt: getUgandaTime(),
    };
    if (args.questionId) {
      const existing = await ctx.db.get(args.questionId);
      if (!existing) throw new Error("Question not found.");
      if (existing.answerType !== args.answerType) throw new Error("A question's answer type cannot change. Retire it and add a new one.");
      await ctx.db.patch(args.questionId, fields);
      return args.questionId;
    }
    return await ctx.db.insert("enquiryQuestions", { ...fields, createdAt: getUgandaTime() });
  },
});

async function addStarters(ctx: MutationCtx): Promise<number> {
  const existing = await ctx.db.query("enquiryQuestions").take(200);
  const have = new Set(existing.map((q) => q.text.trim().toLowerCase()));
  let order = existing.reduce((max, q) => Math.max(max, q.sortOrder), 0);
  let added = 0;
  const now = getUgandaTime();
  for (const q of STARTER_QUESTIONS) {
    if (have.has(q.text.toLowerCase())) continue;
    order += 10;
    await ctx.db.insert("enquiryQuestions", { ...q, active: true, sortOrder: order, createdAt: now, updatedAt: now });
    added++;
  }
  return added;
}

export const addStarterQuestions = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.sessionToken);
    return { added: await addStarters(ctx) };
  },
});

/** One-off: the starter pool (run once after deploying questions). */
export const seedStarterQuestions = internalMutation({
  args: {},
  handler: async (ctx) => ({ added: await addStarters(ctx) }),
});
