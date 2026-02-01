import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List sessions by folder
export const listByFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify folder ownership
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    return await ctx.db
      .query("sessions")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .order("desc")
      .collect();
  },
});

// List all user sessions
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// List active sessions
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

// Get a single session
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    return session;
  },
});

// Get session with folder info
export const getWithFolder = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const folder = await ctx.db.get(session.folderId);
    return { ...session, folder };
  },
});

// Create a new session
export const create = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify folder ownership
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    return await ctx.db.insert("sessions", {
      folderId: args.folderId,
      userId,
      name: args.name,
      status: "active",
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      startedAt: Date.now(),
    });
  },
});

// Update session
export const update = mutation({
  args: {
    id: v.id("sessions"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("archived")
      )
    ),
    sourceLanguage: v.optional(v.string()),
    targetLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.sourceLanguage !== undefined)
      updates.sourceLanguage = args.sourceLanguage;
    if (args.targetLanguage !== undefined)
      updates.targetLanguage = args.targetLanguage;

    await ctx.db.patch(args.id, updates);
  },
});

// End session
export const end = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      endedAt: Date.now(),
    });
  },
});

// Delete session and all contents
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    // Delete documents and their files
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    for (const doc of documents) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // Delete transcripts
    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const t of transcripts) await ctx.db.delete(t._id);

    // Delete citations
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const c of citations) await ctx.db.delete(c._id);

    // Delete notes
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const n of notes) await ctx.db.delete(n._id);

    await ctx.db.delete(args.id);
  },
});
