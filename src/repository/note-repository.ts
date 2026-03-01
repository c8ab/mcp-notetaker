/**
 * NoteApiClient -- HTTP client for the notetaker-api.
 *
 * Delegates all note operations to the REST API using the built-in fetch API.
 * Replaces the previous SQLite-based NoteRepository.
 */

import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesInput,
  DeleteNoteResult,
  DeletedNoteEntry,
} from "../types.js";

/** Error thrown when the API returns an unexpected response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Error thrown when attempting to delete an already-deleted note. */
export class NoteAlreadyDeletedError extends Error {
  constructor(noteId: string) {
    super(`Note '${noteId}' is already deleted`);
    this.name = "NoteAlreadyDeletedError";
  }
}

export class NoteApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Strip trailing slash for consistent URL building
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /** Creates a new note. Returns the complete note record. */
  async create(input: CreateNoteInput): Promise<Note> {
    const body: Record<string, unknown> = {
      content: input.content,
      session_id: input.session_id,
      user_id: input.user_id,
      agent: input.agent,
    };

    if (input.title !== undefined) body.title = input.title;
    if (input.tags !== undefined) body.tags = input.tags;
    if (input.parent_note_id !== undefined) body.parent_note_id = input.parent_note_id;
    if (input.context_url !== undefined) body.context_url = input.context_url;
    if (input.created_at !== undefined) body.created_at = input.created_at;

    const res = await fetch(`${this.baseUrl}/api/v1/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to create note: ${res.status} ${text}`);
    }

    return (await res.json()) as Note;
  }

  /** Retrieves a note by ID. Returns null if not found or soft-deleted. */
  async getById(noteId: string): Promise<Note | null> {
    const res = await fetch(`${this.baseUrl}/api/v1/notes/${encodeURIComponent(noteId)}`);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to get note: ${res.status} ${text}`);
    }

    return (await res.json()) as Note;
  }

  /** Lists notes with optional filters. Returns non-deleted notes ordered by created_at DESC. */
  async list(filters: ListNotesInput = {}): Promise<Note[]> {
    const params = new URLSearchParams();

    if (filters.session_id) params.set("session_id", filters.session_id);
    if (filters.user_id) params.set("user_id", filters.user_id);
    if (filters.agent) params.set("agent", filters.agent);
    if (filters.parent_note_id) params.set("parent_note_id", filters.parent_note_id);
    if (filters.created_after) params.set("created_after", filters.created_after);
    if (filters.updated_after) params.set("updated_after", filters.updated_after);

    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        params.append("tags", tag);
      }
    }

    const qs = params.toString();
    const url = `${this.baseUrl}/api/v1/notes${qs ? `?${qs}` : ""}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to list notes: ${res.status} ${text}`);
    }

    return (await res.json()) as Note[];
  }

  /** Updates a note's mutable fields. Returns the updated note or null if not found/deleted. */
  async update(input: UpdateNoteInput): Promise<Note | null> {
    const { note_id, ...fields } = input;

    const res = await fetch(`${this.baseUrl}/api/v1/notes/${encodeURIComponent(note_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to update note: ${res.status} ${text}`);
    }

    return (await res.json()) as Note;
  }

  /** Deletes a note. Returns confirmation or null if not found. Throws if already deleted. */
  async delete(noteId: string): Promise<DeleteNoteResult | null> {
    const res = await fetch(`${this.baseUrl}/api/v1/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });

    if (res.status === 404) {
      return null;
    }

    if (res.status === 409) {
      throw new NoteAlreadyDeletedError(noteId);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to delete note: ${res.status} ${text}`);
    }

    return (await res.json()) as DeleteNoteResult;
  }

  /** Searches notes by title and content. Returns matches ordered by relevance. */
  async search(query: string): Promise<Note[]> {
    const params = new URLSearchParams({ query });
    const res = await fetch(`${this.baseUrl}/api/v1/notes/search?${params.toString()}`);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to search notes: ${res.status} ${text}`);
    }

    return (await res.json()) as Note[];
  }

  /** Lists deleted note IDs since the given timestamp. */
  async listDeleted(since: string): Promise<DeletedNoteEntry[]> {
    const params = new URLSearchParams({ since });
    const res = await fetch(`${this.baseUrl}/api/v1/notes/deleted?${params.toString()}`);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `Failed to list deleted notes: ${res.status} ${text}`);
    }

    return (await res.json()) as DeletedNoteEntry[];
  }
}
