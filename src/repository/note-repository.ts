/**
 * NoteRepository -- encapsulates all SQLite operations for note management.
 *
 * Uses better-sqlite3 for synchronous database access.
 * Manages schema initialization, FTS5 sync, and prepared statements.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType, Statement } from "better-sqlite3";
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesInput,
  DeleteNoteResult,
} from "../types.js";

/**
 * Generates a UUID v7 (RFC 9562) -- time-sortable unique identifier.
 *
 * Structure: 48-bit Unix timestamp (ms) | 4-bit version (7) | 12-bit random | 2-bit variant | 62-bit random
 */
function generateUUIDv7(): string {
  const now = Date.now();

  // 48-bit timestamp in milliseconds
  const timestampHex = now.toString(16).padStart(12, "0");

  // Random bytes for the rest
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // Build UUID v7:
  // Bytes 0-5: timestamp (48 bits)
  // Byte 6: version (4 bits = 0x7) + random (4 bits)
  // Byte 7: random (8 bits)
  // Byte 8: variant (2 bits = 0b10) + random (6 bits)
  // Bytes 9-15: random (56 bits)

  const hex = timestampHex
    + ((0x70 | (randomBytes[0]! & 0x0f)).toString(16).padStart(2, "0"))
    + (randomBytes[1]!.toString(16).padStart(2, "0"))
    + (((randomBytes[2]! & 0x3f) | 0x80).toString(16).padStart(2, "0"))
    + (randomBytes[3]!.toString(16).padStart(2, "0"))
    + (randomBytes[4]!.toString(16).padStart(2, "0"))
    + (randomBytes[5]!.toString(16).padStart(2, "0"))
    + (randomBytes[6]!.toString(16).padStart(2, "0"))
    + (randomBytes[7]!.toString(16).padStart(2, "0"))
    + (randomBytes[8]!.toString(16).padStart(2, "0"))
    + (randomBytes[9]!.toString(16).padStart(2, "0"));

  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20, 32)
  );
}

/** Returns current time as an ISO 8601 string. */
function nowISO(): string {
  return new Date().toISOString();
}

/** Error thrown when attempting to delete an already-deleted note. */
export class NoteAlreadyDeletedError extends Error {
  constructor(noteId: string) {
    super(`Note '${noteId}' is already deleted`);
    this.name = "NoteAlreadyDeletedError";
  }
}

/** Error thrown when a referenced parent note does not exist. */
export class ParentNoteNotFoundError extends Error {
  constructor(parentNoteId: string) {
    super(`Parent note '${parentNoteId}' not found`);
    this.name = "ParentNoteNotFoundError";
  }
}

/** Raw row shape from SQLite before tag parsing. */
interface NoteRow {
  note_id: string;
  session_id: string;
  user_id: string;
  agent: string;
  title: string | null;
  content: string;
  parent_note_id: string | null;
  context_url: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Converts a raw SQLite row to a Note, parsing the tags JSON. */
function rowToNote(row: NoteRow): Note {
  return {
    ...row,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
  };
}

export class NoteRepository {
  private db: DatabaseType;

  // Prepared statements (initialized after schema creation)
  private stmtInsert!: Statement;
  private stmtInsertFts!: Statement;
  private stmtGetById!: Statement;
  private stmtGetByIdIncludeDeleted!: Statement;
  private stmtSoftDelete!: Statement;
  private stmtDeleteFts!: Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    this.prepareStatements();
  }

  /** Creates tables, indexes, and FTS5 virtual table if they don't exist. */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        note_id        TEXT PRIMARY KEY,
        session_id     TEXT NOT NULL,
        user_id        TEXT NOT NULL,
        agent          TEXT NOT NULL,
        title          TEXT,
        content        TEXT NOT NULL,
        parent_note_id TEXT REFERENCES notes(note_id),
        context_url    TEXT,
        tags           TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_notes_session_id ON notes(session_id);
      CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notes_agent ON notes(agent);
      CREATE INDEX IF NOT EXISTS idx_notes_parent_note_id ON notes(parent_note_id);
      CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
      CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title,
        content,
        content='',
        contentless_delete=1
      );
    `);
  }

  /** Prepares frequently-used SQL statements for reuse. */
  private prepareStatements(): void {
    this.stmtInsert = this.db.prepare(`
      INSERT INTO notes (note_id, session_id, user_id, agent, title, content, parent_note_id, context_url, tags, created_at, updated_at, deleted_at)
      VALUES (@note_id, @session_id, @user_id, @agent, @title, @content, @parent_note_id, @context_url, @tags, @created_at, @updated_at, NULL)
    `);

    this.stmtInsertFts = this.db.prepare(`
      INSERT INTO notes_fts (rowid, title, content)
      VALUES (@rowid, @title, @content)
    `);

    this.stmtGetById = this.db.prepare(`
      SELECT * FROM notes WHERE note_id = ? AND deleted_at IS NULL
    `);

    this.stmtGetByIdIncludeDeleted = this.db.prepare(`
      SELECT * FROM notes WHERE note_id = ?
    `);

    this.stmtSoftDelete = this.db.prepare(`
      UPDATE notes SET deleted_at = ? WHERE note_id = ? AND deleted_at IS NULL
    `);

    this.stmtDeleteFts = this.db.prepare(`
      DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE note_id = ?)
    `);
  }

  /** Creates a new note. Returns the complete note record. */
  create(input: CreateNoteInput): Note {
    const noteId = generateUUIDv7();
    const now = nowISO();
    const tagsJson = input.tags ? JSON.stringify(input.tags) : null;

    // Verify parent exists if provided
    if (input.parent_note_id) {
      const parent = this.getById(input.parent_note_id);
      if (!parent) {
        throw new ParentNoteNotFoundError(input.parent_note_id);
      }
    }

    const params = {
      note_id: noteId,
      session_id: input.session_id,
      user_id: input.user_id,
      agent: input.agent,
      title: input.title ?? null,
      content: input.content,
      parent_note_id: input.parent_note_id ?? null,
      context_url: input.context_url ?? null,
      tags: tagsJson,
      created_at: now,
      updated_at: now,
    };

    const insertAndIndex = this.db.transaction(() => {
      this.stmtInsert.run(params);
      // Get the rowid for FTS indexing
      const row = this.stmtGetByIdIncludeDeleted.get(noteId) as NoteRow;
      const rowid = this.db.prepare("SELECT rowid FROM notes WHERE note_id = ?").get(noteId) as { rowid: number };
      this.stmtInsertFts.run({
        rowid: rowid.rowid,
        title: row.title ?? "",
        content: row.content,
      });
    });

    insertAndIndex();

    return this.getById(noteId)!;
  }

  /** Retrieves a note by ID. Returns null if not found or soft-deleted. */
  getById(noteId: string): Note | null {
    const row = this.stmtGetById.get(noteId) as NoteRow | undefined;
    return row ? rowToNote(row) : null;
  }

  /** Lists notes with optional filters. Returns non-deleted notes ordered by created_at DESC. */
  list(filters: ListNotesInput = {}): Note[] {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: Record<string, string> = {};

    if (filters.session_id) {
      conditions.push("session_id = @session_id");
      params.session_id = filters.session_id;
    }

    if (filters.user_id) {
      conditions.push("user_id = @user_id");
      params.user_id = filters.user_id;
    }

    if (filters.agent) {
      conditions.push("agent = @agent");
      params.agent = filters.agent;
    }

    if (filters.parent_note_id) {
      conditions.push("parent_note_id = @parent_note_id");
      params.parent_note_id = filters.parent_note_id;
    }

    if (filters.tags && filters.tags.length > 0) {
      // AND semantics: note must contain ALL requested tags.
      // Uses json_each to check that the count of matching tags equals the count of requested tags.
      const tagPlaceholders = filters.tags.map((_, i) => `@tag_${i}`);
      filters.tags.forEach((tag, i) => {
        params[`tag_${i}`] = tag;
      });
      conditions.push(`(
        SELECT COUNT(DISTINCT je.value)
        FROM json_each(tags) AS je
        WHERE je.value IN (${tagPlaceholders.join(", ")})
      ) = ${filters.tags.length}`);
    }

    const sql = `SELECT * FROM notes WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
    const rows = this.db.prepare(sql).all(params) as NoteRow[];
    return rows.map(rowToNote);
  }

  /** Updates a note's mutable fields. Returns the updated note or null if not found/deleted. */
  update(input: UpdateNoteInput): Note | null {
    // Check note exists and is not deleted
    const existing = this.getById(input.note_id);
    if (!existing) {
      return null;
    }

    // Verify parent exists if provided
    if (input.parent_note_id !== undefined) {
      const parent = this.getById(input.parent_note_id);
      if (!parent) {
        throw new ParentNoteNotFoundError(input.parent_note_id);
      }
    }

    const setClauses: string[] = ["updated_at = @updated_at"];
    const params: Record<string, string | null> = {
      note_id: input.note_id,
      updated_at: nowISO(),
    };

    if (input.title !== undefined) {
      setClauses.push("title = @title");
      params.title = input.title;
    }

    if (input.content !== undefined) {
      setClauses.push("content = @content");
      params.content = input.content;
    }

    if (input.tags !== undefined) {
      setClauses.push("tags = @tags");
      params.tags = JSON.stringify(input.tags);
    }

    if (input.context_url !== undefined) {
      setClauses.push("context_url = @context_url");
      params.context_url = input.context_url;
    }

    if (input.parent_note_id !== undefined) {
      setClauses.push("parent_note_id = @parent_note_id");
      params.parent_note_id = input.parent_note_id;
    }

    const sql = `UPDATE notes SET ${setClauses.join(", ")} WHERE note_id = @note_id AND deleted_at IS NULL`;

    const updateAndReindex = this.db.transaction(() => {
      this.db.prepare(sql).run(params);

      // Re-index FTS if title or content changed
      if (input.title !== undefined || input.content !== undefined) {
        const rowid = this.db.prepare("SELECT rowid FROM notes WHERE note_id = ?").get(input.note_id) as { rowid: number };
        this.stmtDeleteFts.run(input.note_id);
        const updated = this.stmtGetByIdIncludeDeleted.get(input.note_id) as NoteRow;
        this.stmtInsertFts.run({
          rowid: rowid.rowid,
          title: updated.title ?? "",
          content: updated.content,
        });
      }
    });

    updateAndReindex();

    return this.getById(input.note_id);
  }

  /** Soft-deletes a note. Returns confirmation or null if not found. Throws if already deleted. */
  softDelete(noteId: string): DeleteNoteResult | null {
    // Check if the note exists at all (including deleted)
    const row = this.stmtGetByIdIncludeDeleted.get(noteId) as NoteRow | undefined;

    if (!row) {
      return null;
    }

    if (row.deleted_at) {
      throw new NoteAlreadyDeletedError(noteId);
    }

    const deletedAt = nowISO();

    const deleteAndCleanFts = this.db.transaction(() => {
      this.stmtSoftDelete.run(deletedAt, noteId);
      this.stmtDeleteFts.run(noteId);
    });

    deleteAndCleanFts();

    return { note_id: noteId, deleted_at: deletedAt };
  }

  /** Searches notes by title and content using FTS5. Returns matches ordered by relevance. */
  search(query: string): Note[] {
    const sql = `
      SELECT notes.*
      FROM notes_fts
      JOIN notes ON notes.rowid = notes_fts.rowid
      WHERE notes_fts MATCH ?
        AND notes.deleted_at IS NULL
      ORDER BY notes_fts.rank
    `;
    const rows = this.db.prepare(sql).all(query) as NoteRow[];
    return rows.map(rowToNote);
  }

  /** Closes the database connection. */
  close(): void {
    this.db.close();
  }
}
