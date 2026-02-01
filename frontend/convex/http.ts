import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// Add auth routes (OAuth callbacks, etc.)
auth.addHttpRoutes(http);

// ============================================================================
// BACKEND API ROUTES - For FastAPI to call
// ============================================================================

// Add transcript segment
http.route({
  path: "/api/transcripts/add",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, originalText, translatedText, timestamp, windowIndex, isFinal } = body;

      if (!sessionId || !originalText || timestamp === undefined || windowIndex === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const transcriptId = await ctx.runMutation(internal.transcripts.addFromBackend, {
        sessionId: sessionId as Id<"sessions">,
        originalText,
        translatedText,
        timestamp,
        windowIndex,
        isFinal: isFinal ?? true,
      });

      return new Response(
        JSON.stringify({ success: true, transcriptId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error adding transcript:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Get full transcript text for note generation
http.route({
  path: "/api/transcripts/full-text",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runQuery(internal.transcripts.getFullTextInternal, {
        sessionId: sessionId as Id<"sessions">,
      });

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error getting full text:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Add batch of citations
http.route({
  path: "/api/citations/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, citations } = body;

      if (!sessionId || !citations || !Array.isArray(citations)) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId or citations array" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Transform citations to use proper Convex IDs
      const transformedCitations = citations.map((c: {
        transcriptId?: string;
        documentId: string;
        pageNumber: number;
        chunkText: string;
        relevanceScore: number;
        rank: number;
        windowIndex: number;
        sectionHeading?: string;
      }) => ({
        transcriptId: c.transcriptId ? (c.transcriptId as Id<"transcripts">) : undefined,
        documentId: c.documentId as Id<"documents">,
        pageNumber: c.pageNumber,
        chunkText: c.chunkText,
        relevanceScore: c.relevanceScore,
        rank: c.rank,
        windowIndex: c.windowIndex,
        sectionHeading: c.sectionHeading,
      }));

      const ids = await ctx.runMutation(internal.citations.addBatchFromBackend, {
        sessionId: sessionId as Id<"sessions">,
        citations: transformedCitations,
      });

      return new Response(
        JSON.stringify({ success: true, citationIds: ids }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error adding citations:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Get citations for session (for note generation)
http.route({
  path: "/api/citations/session",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const citations = await ctx.runQuery(internal.citations.listBySessionInternal, {
        sessionId: sessionId as Id<"sessions">,
      });

      return new Response(
        JSON.stringify({ citations }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error getting citations:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Upsert notes
http.route({
  path: "/api/notes/upsert",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, contentMarkdown, contentMarkdownTranslated, targetLanguage } = body;

      if (!sessionId || !contentMarkdown) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId or contentMarkdown" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const noteId = await ctx.runMutation(internal.notes.upsertFromBackend, {
        sessionId: sessionId as Id<"sessions">,
        contentMarkdown,
        contentMarkdownTranslated,
        targetLanguage,
      });

      return new Response(
        JSON.stringify({ success: true, noteId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error upserting notes:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Get notes for session
http.route({
  path: "/api/notes/session",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const notes = await ctx.runQuery(internal.notes.getBySessionInternal, {
        sessionId: sessionId as Id<"sessions">,
      });

      return new Response(
        JSON.stringify({ notes }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error getting notes:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
