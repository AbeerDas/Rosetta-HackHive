import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  // Auth tables (users, authSessions, authAccounts, etc.)
  ...authTables,

  // Override users table to add custom fields
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // Folders - Course/subject organization
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "archivedAt"]),

  // Sessions - Lecture sessions within folders
  sessions: defineTable({
    folderId: v.id("folders"),
    userId: v.id("users"),
    name: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_folder", ["folderId"])
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  // Documents - Uploaded PDF course materials
  documents: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    name: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    pageCount: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    processingProgress: v.number(),
    errorMessage: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  // Transcripts - Speech-to-text segments
  transcripts: defineTable({
    sessionId: v.id("sessions"),
    originalText: v.string(),
    translatedText: v.optional(v.string()),
    timestamp: v.number(),
    windowIndex: v.number(),
    isFinal: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_time", ["sessionId", "timestamp"]),

  // Citations - RAG-retrieved document references
  citations: defineTable({
    sessionId: v.id("sessions"),
    transcriptId: v.optional(v.id("transcripts")),
    documentId: v.id("documents"),
    pageNumber: v.number(),
    chunkText: v.string(),
    relevanceScore: v.number(),
    rank: v.number(), // 1 = most relevant
    windowIndex: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_transcript", ["transcriptId"])
    .index("by_document", ["documentId"]),

  // Notes - Generated lecture notes
  notes: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    contentMarkdown: v.string(), // English version
    contentMarkdownTranslated: v.optional(v.string()), // Target language version
    targetLanguage: v.optional(v.string()), // Language code for translated version
    generatedAt: v.number(),
    lastEditedAt: v.number(),
    version: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),
});

export default schema;
