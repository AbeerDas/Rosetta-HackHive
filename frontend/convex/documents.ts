import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List documents by session
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

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Add download URLs
    return Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      }))
    );
  },
});

// Get a single document
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const document = await ctx.db.get(args.id);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found");
    }

    const url = await ctx.storage.getUrl(document.storageId);
    return { ...document, url };
  },
});

// Internal get for actions (no auth check)
export const getInternal = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Generate upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

// Save document after upload
export const saveDocument = mutation({
  args: {
    sessionId: v.id("sessions"),
    storageId: v.id("_storage"),
    name: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const documentId = await ctx.db.insert("documents", {
      sessionId: args.sessionId,
      userId,
      name: args.name,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      status: "pending",
      processingProgress: 0,
    });

    return documentId;
  },
});

// Update document status
export const updateStatus = mutation({
  args: {
    id: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    processingProgress: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.processingProgress !== undefined) {
      updates.processingProgress = args.processingProgress;
    }
    if (args.pageCount !== undefined) updates.pageCount = args.pageCount;
    if (args.chunkCount !== undefined) updates.chunkCount = args.chunkCount;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.status === "ready") updates.processedAt = Date.now();

    await ctx.db.patch(args.id, updates);
  },
});

// Internal status update (for actions)
export const updateStatusInternal = internalMutation({
  args: {
    id: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    processingProgress: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.processingProgress !== undefined) {
      updates.processingProgress = args.processingProgress;
    }
    if (args.pageCount !== undefined) updates.pageCount = args.pageCount;
    if (args.chunkCount !== undefined) updates.chunkCount = args.chunkCount;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.status === "ready") updates.processedAt = Date.now();

    await ctx.db.patch(args.id, updates);
  },
});

// Get storage URL for a file (used after upload for processing)
export const getStorageUrl = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.getUrl(args.storageId);
  },
});

// Delete document
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const document = await ctx.db.get(args.id);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found");
    }

    // Delete file from storage
    await ctx.storage.delete(document.storageId);

    // Delete associated citations
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const c of citations) await ctx.db.delete(c._id);

    await ctx.db.delete(args.id);
  },
});
