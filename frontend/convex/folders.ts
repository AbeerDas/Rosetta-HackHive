import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List all active folders for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .order("desc")
      .collect();
  },
});

// List all folders including archived
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Get a single folder
export const get = query({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    return folder;
  },
});

// Create a new folder
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("folders", {
      userId,
      name: args.name,
    });
  },
});

// Update folder name
export const update = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    await ctx.db.patch(args.id, { name: args.name });
  },
});

// Archive folder (soft delete)
export const archive = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

// Unarchive folder
export const unarchive = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    await ctx.db.patch(args.id, { archivedAt: undefined });
  },
});

// Permanently delete folder and all contents
export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    // Delete all sessions in folder (cascades to documents, transcripts, etc.)
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();

    for (const session of sessions) {
      // Delete documents and their files
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const doc of documents) {
        await ctx.storage.delete(doc.storageId);
        await ctx.db.delete(doc._id);
      }

      // Delete transcripts
      const transcripts = await ctx.db
        .query("transcripts")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const t of transcripts) await ctx.db.delete(t._id);

      // Delete citations
      const citations = await ctx.db
        .query("citations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const c of citations) await ctx.db.delete(c._id);

      // Delete notes
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const n of notes) await ctx.db.delete(n._id);

      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(args.id);
  },
});
