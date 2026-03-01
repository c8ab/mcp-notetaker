/**
 * Unit tests for NoteApiClient.
 *
 * Feature: note-management
 *
 * Tests the HTTP client by mocking the global fetch function.
 * Each test verifies that the client sends the correct request
 * and handles the response properly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NoteApiClient,
  ApiError,
  NoteAlreadyDeletedError,
} from "../../../src/repository/note-repository.js";
import type { Note, DeleteNoteResult, DeletedNoteEntry } from "../../../src/types.js";

const BASE_URL = "http://localhost:3000";

/** Helper to build a mock Note object. */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    note_id: "019abc12-3456-7def-8901-234567890abc",
    session_id: "session-001",
    user_id: "user-001",
    agent: "test-agent",
    title: null,
    content: "= Test Note\n\nThis is a test note.",
    parent_note_id: null,
    context_url: null,
    tags: null,
    created_at: "2026-01-15T10:00:00.000Z",
    updated_at: "2026-01-15T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

/** Helper to create a mock Response. */
function mockResponse(body: unknown, init: { status?: number; statusText?: string } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? "OK",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

describe("NoteApiClient", () => {
  let client: NoteApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new NoteApiClient(BASE_URL);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe("create", () => {
    it("should POST to /api/v1/notes with required fields", async () => {
      const note = makeNote({ title: "Test" });
      fetchMock.mockResolvedValue(mockResponse(note, { status: 201 }));

      const result = await client.create({
        content: "Test content",
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/api/v1/notes`);
      expect(opts.method).toBe("POST");
      expect(opts.headers).toEqual({ "Content-Type": "application/json" });
      const body = JSON.parse(opts.body);
      expect(body).toEqual({
        content: "Test content",
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
      });
      expect(result).toEqual(note);
    });

    it("should include optional fields when provided", async () => {
      const note = makeNote({
        title: "Full Note",
        tags: ["architecture"],
        parent_note_id: "parent-1",
        context_url: "https://example.com",
      });
      fetchMock.mockResolvedValue(mockResponse(note, { status: 201 }));

      await client.create({
        content: "Content",
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
        title: "Full Note",
        tags: ["architecture"],
        parent_note_id: "parent-1",
        context_url: "https://example.com",
        created_at: "2026-01-15T10:00:00.000Z",
      });

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.title).toBe("Full Note");
      expect(body.tags).toEqual(["architecture"]);
      expect(body.parent_note_id).toBe("parent-1");
      expect(body.context_url).toBe("https://example.com");
      expect(body.created_at).toBe("2026-01-15T10:00:00.000Z");
    });

    it("should throw ApiError on non-OK response", async () => {
      fetchMock.mockResolvedValue(mockResponse("Bad Request", { status: 400 }));

      await expect(
        client.create({ content: "x", session_id: "s", user_id: "u", agent: "a" }),
      ).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // GET BY ID
  // ==========================================================================

  describe("getById", () => {
    it("should GET /api/v1/notes/{noteId}", async () => {
      const note = makeNote();
      fetchMock.mockResolvedValue(mockResponse(note));

      const result = await client.getById("note-123");

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/notes/note-123`);
      expect(result).toEqual(note);
    });

    it("should return null on 404", async () => {
      fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

      const result = await client.getById("nonexistent");
      expect(result).toBeNull();
    });

    it("should throw ApiError on unexpected status", async () => {
      fetchMock.mockResolvedValue(mockResponse("Server error", { status: 500 }));

      await expect(client.getById("note-123")).rejects.toThrow(ApiError);
    });

    it("should encode noteId in the URL", async () => {
      fetchMock.mockResolvedValue(mockResponse(makeNote()));

      await client.getById("id/with/slashes");

      expect(fetchMock.mock.calls[0]![0]).toBe(
        `${BASE_URL}/api/v1/notes/id%2Fwith%2Fslashes`,
      );
    });
  });

  // ==========================================================================
  // LIST
  // ==========================================================================

  describe("list", () => {
    it("should GET /api/v1/notes with no query params when no filters", async () => {
      const notes = [makeNote()];
      fetchMock.mockResolvedValue(mockResponse(notes));

      const result = await client.list();

      expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE_URL}/api/v1/notes`);
      expect(result).toEqual(notes);
    });

    it("should pass scalar filters as query params", async () => {
      fetchMock.mockResolvedValue(mockResponse([]));

      await client.list({
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
        parent_note_id: "p1",
      });

      const url = new URL(fetchMock.mock.calls[0]![0]);
      expect(url.searchParams.get("session_id")).toBe("s1");
      expect(url.searchParams.get("user_id")).toBe("u1");
      expect(url.searchParams.get("agent")).toBe("a1");
      expect(url.searchParams.get("parent_note_id")).toBe("p1");
    });

    it("should pass tags as repeated query params", async () => {
      fetchMock.mockResolvedValue(mockResponse([]));

      await client.list({ tags: ["arch", "decision"] });

      const url = new URL(fetchMock.mock.calls[0]![0]);
      expect(url.searchParams.getAll("tags")).toEqual(["arch", "decision"]);
    });

    it("should pass created_after and updated_after filters", async () => {
      fetchMock.mockResolvedValue(mockResponse([]));

      await client.list({
        created_after: "2026-01-01T00:00:00.000Z",
        updated_after: "2026-01-02T00:00:00.000Z",
      });

      const url = new URL(fetchMock.mock.calls[0]![0]);
      expect(url.searchParams.get("created_after")).toBe("2026-01-01T00:00:00.000Z");
      expect(url.searchParams.get("updated_after")).toBe("2026-01-02T00:00:00.000Z");
    });

    it("should throw ApiError on non-OK response", async () => {
      fetchMock.mockResolvedValue(mockResponse("Error", { status: 500 }));

      await expect(client.list()).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe("update", () => {
    it("should PATCH /api/v1/notes/{noteId} with changed fields", async () => {
      const updated = makeNote({ title: "Updated" });
      fetchMock.mockResolvedValue(mockResponse(updated));

      const result = await client.update({
        note_id: "note-123",
        title: "Updated",
        content: "New content",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/api/v1/notes/note-123`);
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body).toEqual({ title: "Updated", content: "New content" });
      expect(body).not.toHaveProperty("note_id");
      expect(result).toEqual(updated);
    });

    it("should return null on 404", async () => {
      fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

      const result = await client.update({ note_id: "nonexistent", title: "X" });
      expect(result).toBeNull();
    });

    it("should throw ApiError on unexpected status", async () => {
      fetchMock.mockResolvedValue(mockResponse("Error", { status: 500 }));

      await expect(client.update({ note_id: "n", title: "X" })).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe("delete", () => {
    it("should DELETE /api/v1/notes/{noteId}", async () => {
      const deleteResult: DeleteNoteResult = {
        note_id: "note-123",
        deleted_at: "2026-01-15T12:00:00.000Z",
      };
      fetchMock.mockResolvedValue(mockResponse(deleteResult));

      const result = await client.delete("note-123");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/api/v1/notes/note-123`);
      expect(opts.method).toBe("DELETE");
      expect(result).toEqual(deleteResult);
    });

    it("should return null on 404", async () => {
      fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

      const result = await client.delete("nonexistent");
      expect(result).toBeNull();
    });

    it("should throw NoteAlreadyDeletedError on 409", async () => {
      fetchMock.mockResolvedValue(mockResponse("Already deleted", { status: 409 }));

      await expect(client.delete("note-123")).rejects.toThrow(NoteAlreadyDeletedError);
    });

    it("should throw ApiError on unexpected status", async () => {
      fetchMock.mockResolvedValue(mockResponse("Error", { status: 500 }));

      await expect(client.delete("note-123")).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  describe("search", () => {
    it("should GET /api/v1/notes/search with query param", async () => {
      const notes = [makeNote({ title: "Architecture" })];
      fetchMock.mockResolvedValue(mockResponse(notes));

      const result = await client.search("architecture");

      const url = new URL(fetchMock.mock.calls[0]![0]);
      expect(url.pathname).toBe("/api/v1/notes/search");
      expect(url.searchParams.get("query")).toBe("architecture");
      expect(result).toEqual(notes);
    });

    it("should throw ApiError on non-OK response", async () => {
      fetchMock.mockResolvedValue(mockResponse("Error", { status: 500 }));

      await expect(client.search("test")).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // LIST DELETED
  // ==========================================================================

  describe("listDeleted", () => {
    it("should GET /api/v1/notes/deleted with since param", async () => {
      const entries: DeletedNoteEntry[] = [
        { note_id: "note-1", deleted_at: "2026-01-15T12:00:00.000Z" },
      ];
      fetchMock.mockResolvedValue(mockResponse(entries));

      const result = await client.listDeleted("2026-01-01T00:00:00.000Z");

      const url = new URL(fetchMock.mock.calls[0]![0]);
      expect(url.pathname).toBe("/api/v1/notes/deleted");
      expect(url.searchParams.get("since")).toBe("2026-01-01T00:00:00.000Z");
      expect(result).toEqual(entries);
    });

    it("should throw ApiError on non-OK response", async () => {
      fetchMock.mockResolvedValue(mockResponse("Error", { status: 500 }));

      await expect(client.listDeleted("2026-01-01T00:00:00.000Z")).rejects.toThrow(ApiError);
    });
  });

  // ==========================================================================
  // BASE URL HANDLING
  // ==========================================================================

  describe("base URL normalization", () => {
    it("should strip trailing slashes from base URL", async () => {
      const c = new NoteApiClient("http://localhost:3000///");
      fetchMock.mockResolvedValue(mockResponse([]));

      await c.list();

      expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:3000/api/v1/notes");
    });
  });
});
