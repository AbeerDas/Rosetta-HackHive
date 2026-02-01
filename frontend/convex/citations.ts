import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// List citations by session
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

    const citations = await ctx.db
      .query("citations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Enrich with document info
    return Promise.all(
      citations.map(async (citation) => {
        const document = await ctx.db.get(citation.documentId);
        return {
          ...citation,
          documentName: document?.name ?? "Unknown",
        };
      })
    );
  },
});

// List citations by transcript
export const listByTranscript = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get transcript to verify ownership
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) {
      throw new Error("Transcript not found");
    }

    const session = await ctx.db.get(transcript.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Not authorized");
    }

    const citations = await ctx.db
      .query("citations")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();

    // Sort by rank and enrich with document info
    const enriched = await Promise.all(
      citations.map(async (citation) => {
        const document = await ctx.db.get(citation.documentId);
        return {
          ...citation,
          documentName: document?.name ?? "Unknown",
        };
      })
    );

    return enriched.sort((a, b) => a.rank - b.rank);
  },
});

// Get citations by window index (for real-time display)
export const getByWindowIndex = query({
  args: { sessionId: v.id("sessions"), windowIndex: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const citations = await ctx.db
      .query("citations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("windowIndex"), args.windowIndex))
      .collect();

    // Sort by rank and enrich with document info
    const enriched = await Promise.all(
      citations.map(async (citation) => {
        const document = await ctx.db.get(citation.documentId);
        return {
          ...citation,
          documentName: document?.name ?? "Unknown",
        };
      })
    );

    return enriched.sort((a, b) => a.rank - b.rank);
  },
});

// Add citations (typically called from FastAPI after RAG query)
export const addBatch = mutation({
  args: {
    sessionId: v.id("sessions"),
    citations: v.array(
      v.object({
        transcriptId: v.optional(v.id("transcripts")),
        documentId: v.id("documents"),
        pageNumber: v.number(),
        chunkText: v.string(),
        relevanceScore: v.number(),
        rank: v.number(),
        windowIndex: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const ids = [];
    for (const citation of args.citations) {
      const id = await ctx.db.insert("citations", {
        sessionId: args.sessionId,
        ...citation,
      });
      ids.push(id);
    }

    return ids;
  },
});

// Get unique citations for notes (deduplicated by document + page)
export const getUniqueForNotes = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const citations = await ctx.db
      .query("citations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Deduplicate by document + page, keeping best relevance score
    const unique = new Map<string, typeof citations[0]>();
    for (const citation of citations) {
      const key = `${citation.documentId}:${citation.pageNumber}`;
      const existing = unique.get(key);
      if (!existing || citation.relevanceScore > existing.relevanceScore) {
        unique.set(key, citation);
      }
    }

    // Sort by relevance and enrich with document info
    const sorted = Array.from(unique.values()).sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    return Promise.all(
      sorted.map(async (citation, index) => {
        const document = await ctx.db.get(citation.documentId);
        return {
          ...citation,
          documentName: document?.name ?? "Unknown",
          citationNumber: index + 1,
        };
      })
    );
  },
});

// ============================================================================
// INTERNAL MUTATIONS/QUERIES - For backend (FastAPI) to call via HTTP
// ============================================================================

// Add citations batch from backend (no auth check - backend handles auth)
export const addBatchFromBackend = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    citations: v.array(
      v.object({
        transcriptId: v.optional(v.id("transcripts")),
        documentId: v.id("documents"),
        pageNumber: v.number(),
        chunkText: v.string(),
        relevanceScore: v.number(),
        rank: v.number(),
        windowIndex: v.number(),
        sectionHeading: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify session exists (but don't check user - backend is trusted)
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const ids = [];
    for (const citation of args.citations) {
      const id = await ctx.db.insert("citations", {
        sessionId: args.sessionId,
        transcriptId: citation.transcriptId,
        documentId: citation.documentId,
        pageNumber: citation.pageNumber,
        chunkText: citation.chunkText,
        relevanceScore: citation.relevanceScore,
        rank: citation.rank,
        windowIndex: citation.windowIndex,
      });
      ids.push(id);
    }

    return ids;
  },
});

// List citations for backend (no auth - for note generation)
export const listBySessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Enrich with document info
    return Promise.all(
      citations.map(async (citation) => {
        const document = await ctx.db.get(citation.documentId);
        return {
          ...citation,
          documentName: document?.name ?? "Unknown",
        };
      })
    );
  },
});
