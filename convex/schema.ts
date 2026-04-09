import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users — one per parent account (or tutor account)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("parent"), v.literal("tutor")),
    digestTime: v.string(), // "morning" | "evening"
    digestEnabled: v.boolean(),
    onboardingComplete: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  // Children — a child belongs to one parent, can have multiple tutors
  children: defineTable({
    parentId: v.id("users"),
    name: v.string(),
    schoolName: v.string(),
    grade: v.optional(v.string()),
    tutorIds: v.array(v.id("users")),
    pendingTutorInvites: v.optional(v.array(v.string())),
    watchedFolderPath: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_parentId", ["parentId"]),

  // PDF ingestion records — one per PDF processed
  schoolEntries: defineTable({
    childId: v.id("children"),
    parentId: v.id("users"),
    fileStorageId: v.id("_storage"),
    fileName: v.string(),
    entryDate: v.string(), // "YYYY-MM-DD"
    processingStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
      v.literal("low_confidence")
    ),
    extractionConfidence: v.optional(v.number()),
    rawExtractedJson: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_childId", ["childId"])
    .index("by_parentId_and_date", ["parentId", "entryDate"])
    .index("by_status", ["processingStatus"]),

  // Homework items — extracted from school PDFs
  homeworkItems: defineTable({
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    subject: v.string(),
    description: v.string(),
    dueDate: v.string(), // "YYYY-MM-DD"
    assignedDate: v.string(), // "YYYY-MM-DD"
    isComplete: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_childId_and_dueDate", ["childId", "dueDate"])
    .index("by_schoolEntryId", ["schoolEntryId"]),

  // Classwork items — what was taught/covered in class
  classworkItems: defineTable({
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    subject: v.string(),
    topicsCovered: v.array(v.string()),
    notes: v.optional(v.string()),
    entryDate: v.string(), // "YYYY-MM-DD"
    createdAt: v.number(),
  })
    .index("by_childId_and_date", ["childId", "entryDate"])
    .index("by_schoolEntryId", ["schoolEntryId"]),

  // Exam / slip test items
  examItems: defineTable({
    schoolEntryId: v.id("schoolEntries"),
    childId: v.id("children"),
    parentId: v.id("users"),
    subject: v.string(),
    examType: v.union(
      v.literal("slip_test"),
      v.literal("unit_test"),
      v.literal("exam"),
      v.literal("quiz"),
      v.literal("other")
    ),
    examDate: v.string(), // "YYYY-MM-DD"
    portions: v.array(v.string()),
    notes: v.optional(v.string()),
    announcedDate: v.string(), // "YYYY-MM-DD"
    isAcknowledged: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_childId_and_examDate", ["childId", "examDate"])
    .index("by_childId_upcoming", ["childId", "examDate"]),

  // Digest log — record of sent digests
  digestLog: defineTable({
    parentId: v.id("users"),
    sentAt: v.number(),
    digestDate: v.string(), // "YYYY-MM-DD"
    emailStatus: v.union(v.literal("sent"), v.literal("failed")),
    childrenIncluded: v.array(v.id("children")),
    itemCount: v.number(),
  }).index("by_parentId", ["parentId"]),
});
