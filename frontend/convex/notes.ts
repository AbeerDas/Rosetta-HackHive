import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Get notes for a session
export const getBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    return await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// List all user notes
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Enrich with session info
    return Promise.all(
      notes.map(async (note) => {
        const session = await ctx.db.get(note.sessionId);
        return {
          ...note,
          sessionName: session?.name ?? "Unknown",
        };
      })
    );
  },
});

// Create notes for a session
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    contentMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    // Check if notes already exist
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      throw new Error("Notes already exist for this session. Use update instead.");
    }

    const now = Date.now();
    return await ctx.db.insert("notes", {
      sessionId: args.sessionId,
      userId,
      contentMarkdown: args.contentMarkdown,
      generatedAt: now,
      lastEditedAt: now,
      version: 1,
    });
  },
});

// Update notes
export const update = mutation({
  args: {
    id: v.id("notes"),
    contentMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notes = await ctx.db.get(args.id);
    if (!notes || notes.userId !== userId) {
      throw new Error("Notes not found");
    }

    await ctx.db.patch(args.id, {
      contentMarkdown: args.contentMarkdown,
      lastEditedAt: Date.now(),
      version: notes.version + 1,
    });
  },
});

// Create or update notes (upsert)
export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    contentMarkdown: v.string(),
    contentMarkdownTranslated: v.optional(v.string()),
    targetLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const existing = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentMarkdown: args.contentMarkdown,
        contentMarkdownTranslated: args.contentMarkdownTranslated,
        targetLanguage: args.targetLanguage,
        lastEditedAt: now,
        version: existing.version + 1,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("notes", {
        sessionId: args.sessionId,
        userId,
        contentMarkdown: args.contentMarkdown,
        contentMarkdownTranslated: args.contentMarkdownTranslated,
        targetLanguage: args.targetLanguage,
        generatedAt: now,
        lastEditedAt: now,
        version: 1,
      });
    }
  },
});

// Delete notes
export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notes = await ctx.db.get(args.id);
    if (!notes || notes.userId !== userId) {
      throw new Error("Notes not found");
    }

    await ctx.db.delete(args.id);
  },
});

// ============================================================================
// INTERNAL MUTATIONS/QUERIES - For backend (FastAPI) to call via HTTP
// ============================================================================

// Upsert notes from backend (no auth check - backend handles auth)
export const upsertFromBackend = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    contentMarkdown: v.string(),
    contentMarkdownTranslated: v.optional(v.string()),
    targetLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get session to get userId (backend is trusted)
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const existing = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentMarkdown: args.contentMarkdown,
        contentMarkdownTranslated: args.contentMarkdownTranslated,
        targetLanguage: args.targetLanguage,
        lastEditedAt: now,
        version: existing.version + 1,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("notes", {
        sessionId: args.sessionId,
        userId: session.userId,
        contentMarkdown: args.contentMarkdown,
        contentMarkdownTranslated: args.contentMarkdownTranslated,
        targetLanguage: args.targetLanguage,
        generatedAt: now,
        lastEditedAt: now,
        version: 1,
      });
    }
  },
});

// Get notes for backend (no auth)
export const getBySessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});
