import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// List transcripts by session
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    return await ctx.db
      .query("transcripts")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get latest transcripts for real-time display
export const getLatest = query({
  args: { sessionId: v.id("sessions"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const limit = args.limit ?? 50;
    return await ctx.db
      .query("transcripts")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

// Add a new transcript segment
export const add = mutation({
  args: {
    sessionId: v.id("sessions"),
    originalText: v.string(),
    translatedText: v.optional(v.string()),
    timestamp: v.number(),
    windowIndex: v.number(),
    isFinal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    return await ctx.db.insert("transcripts", {
      sessionId: args.sessionId,
      originalText: args.originalText,
      translatedText: args.translatedText,
      timestamp: args.timestamp,
      windowIndex: args.windowIndex,
      isFinal: args.isFinal,
    });
  },
});

// Update transcript (e.g., add translation)
export const update = mutation({
  args: {
    id: v.id("transcripts"),
    translatedText: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transcript = await ctx.db.get(args.id);
    if (!transcript) {
      throw new Error("Transcript not found");
    }

    // Verify session ownership
    const session = await ctx.db.get(transcript.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Not authorized");
    }

    const updates: Record<string, unknown> = {};
    if (args.translatedText !== undefined)
      updates.translatedText = args.translatedText;
    if (args.isFinal !== undefined) updates.isFinal = args.isFinal;

    await ctx.db.patch(args.id, updates);
  },
});

// Get full transcript text for note generation
export const getFullText = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isFinal"), true))
      .collect();

    const originalText = transcripts.map((t) => t.originalText).join(" ");
    const translatedText = transcripts
      .map((t) => t.translatedText || t.originalText)
      .join(" ");

    return { originalText, translatedText };
  },
});

// ============================================================================
// INTERNAL MUTATIONS/QUERIES - For backend (FastAPI) to call via HTTP
// ============================================================================

// Add transcript from backend (no auth check - backend handles auth)
export const addFromBackend = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    originalText: v.string(),
    translatedText: v.optional(v.string()),
    timestamp: v.number(),
    windowIndex: v.number(),
    isFinal: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Verify session exists (but don't check user - backend is trusted)
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return await ctx.db.insert("transcripts", {
      sessionId: args.sessionId,
      originalText: args.originalText,
      translatedText: args.translatedText,
      timestamp: args.timestamp,
      windowIndex: args.windowIndex,
      isFinal: args.isFinal,
    });
  },
});

// Get full transcript text for backend (no auth - backend is trusted)
export const getFullTextInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isFinal"), true))
      .collect();

    const originalText = transcripts.map((t) => t.originalText).join(" ");
    const translatedText = transcripts
      .map((t) => t.translatedText || t.originalText)
      .join(" ");

    return { originalText, translatedText };
  },
});

// List transcripts for backend (no auth)
export const listBySessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
