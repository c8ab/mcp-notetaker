/**
 * Core type definitions for the note management system.
 */

/** A complete note record as stored in the database. */
export interface Note {
  note_id: string;
  session_id: string;
  user_id: string;
  agent: string;
  title: string | null;
  content: string;
  parent_note_id: string | null;
  context_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Input for creating a new note. */
export interface CreateNoteInput {
  title?: string;
  content: string;
  session_id: string;
  user_id: string;
  agent: string;
  tags?: string[];
  parent_note_id?: string;
  context_url?: string;
}

/** Input for updating an existing note. Only mutable fields. */
export interface UpdateNoteInput {
  note_id: string;
  title?: string;
  content?: string;
  tags?: string[];
  context_url?: string;
  parent_note_id?: string;
}

/** Input for listing notes with optional filters. */
export interface ListNotesInput {
  session_id?: string;
  user_id?: string;
  agent?: string;
  tags?: string[];
  parent_note_id?: string;
}

/** Input for searching notes by content. */
export interface SearchNotesInput {
  query: string;
}

/** Result of a successful soft-delete operation. */
export interface DeleteNoteResult {
  note_id: string;
  deleted_at: string;
}
