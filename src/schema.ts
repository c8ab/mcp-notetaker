/**
 * Zod schemas for MCP tool input validation.
 */

import { z } from "zod";

/** Schema for the create_note tool input. */
export const CreateNoteSchema = z.object({
  title: z.string().optional().describe("Short title for the note"),
  content: z.string().min(1).describe("Note body in AsciiDoc format"),
  session_id: z.string().min(1).describe("Session identifier"),
  user_id: z.string().min(1).describe("Who is taking the note"),
  agent: z.string().min(1).describe("Which agent is creating the note"),
  tags: z.array(z.string()).optional().describe("Array of tags for categorization"),
  parent_note_id: z.string().optional().describe("ID of a parent note for threading"),
  context_url: z.string().optional().describe("URL or file path the note relates to"),
  created_at: z.string().optional().describe("ISO 8601 timestamp; defaults to now if omitted"),
});

/** Schema for the get_note tool input. */
export const GetNoteSchema = z.object({
  note_id: z.string().min(1).describe("The note ID to retrieve"),
});

/** Schema for the list_notes tool input. */
export const ListNotesSchema = z.object({
  session_id: z.string().optional().describe("Filter by session"),
  user_id: z.string().optional().describe("Filter by note taker"),
  agent: z.string().optional().describe("Filter by agent"),
  tags: z.array(z.string()).optional().describe("Filter by tags (must contain all)"),
  parent_note_id: z.string().optional().describe("Filter by parent note (direct children)"),
  created_after: z.string().optional().describe("Only return notes created after this ISO 8601 timestamp"),
  updated_after: z.string().optional().describe("Only return notes updated after this ISO 8601 timestamp"),
});

/** Schema for the update_note tool input. */
export const UpdateNoteSchema = z.object({
  note_id: z.string().min(1).describe("The note ID to update"),
  title: z.string().optional().describe("New title"),
  content: z.string().min(1).optional().describe("New content (AsciiDoc)"),
  tags: z.array(z.string()).optional().describe("New tags (replaces existing)"),
  context_url: z.string().optional().describe("New context URL"),
  parent_note_id: z.string().optional().describe("New parent note ID"),
});

/** Schema for the delete_note tool input. */
export const DeleteNoteSchema = z.object({
  note_id: z.string().min(1).describe("The note ID to delete"),
});

/** Schema for the search_notes tool input. */
export const SearchNotesSchema = z.object({
  query: z.string().min(1).describe("Search query string"),
});

/** Schema for the list_deleted_notes tool input. */
export const ListDeletedSchema = z.object({
  since: z.string().min(1).describe("ISO 8601 timestamp -- only return notes deleted after this time"),
});
