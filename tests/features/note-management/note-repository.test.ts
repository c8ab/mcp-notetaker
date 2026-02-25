/**
 * Integration tests for NoteRepository.
 *
 * Feature: note-management
 * Spec version: 1.0.0
 * Generated from: spec.adoc
 *
 * Tests run against a real SQLite database (temp file per test suite).
 * Each test gets a fresh repository to ensure isolation.
 *
 * Spec coverage:
 *   NOTE-001 through NOTE-036 (all 36 requirements)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  NoteRepository,
  ParentNoteNotFoundError,
  NoteAlreadyDeletedError,
} from "../../../src/repository/note-repository.js";
import type { CreateNoteInput } from "../../../src/types.js";

/** Helper to create a standard test note input. */
function makeNoteInput(overrides: Partial<CreateNoteInput> = {}): CreateNoteInput {
  return {
    content: "= Test Note\n\nThis is a test note in AsciiDoc format.",
    session_id: "session-001",
    user_id: "user-001",
    agent: "test-agent",
    ...overrides,
  };
}

describe("NoteRepository", () => {
  let repo: NoteRepository;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "notetaker-test-"));
    repo = new NoteRepository(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    repo.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe("create", () => {
    it("NOTE-001: should accept a note with required fields (content, session_id, user_id, agent)", () => {
      const note = repo.create(makeNoteInput());

      expect(note.content).toBe("= Test Note\n\nThis is a test note in AsciiDoc format.");
      expect(note.session_id).toBe("session-001");
      expect(note.user_id).toBe("user-001");
      expect(note.agent).toBe("test-agent");
    });

    it("NOTE-002: should generate a unique note_id for each created note", () => {
      const note1 = repo.create(makeNoteInput());
      const note2 = repo.create(makeNoteInput());

      expect(note1.note_id).toBeDefined();
      expect(note2.note_id).toBeDefined();
      expect(note1.note_id).not.toBe(note2.note_id);
      // UUID v7 format check: 8-4-4-4-12 hex characters
      expect(note1.note_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("NOTE-003: should record created_at and updated_at in ISO 8601 format", () => {
      const before = new Date().toISOString();
      const note = repo.create(makeNoteInput());
      const after = new Date().toISOString();

      expect(note.created_at).toBeDefined();
      expect(note.updated_at).toBeDefined();
      // ISO 8601 format check
      expect(new Date(note.created_at).toISOString()).toBe(note.created_at);
      expect(new Date(note.updated_at).toISOString()).toBe(note.updated_at);
      // Within reasonable time window
      expect(note.created_at >= before).toBe(true);
      expect(note.created_at <= after).toBe(true);
      // created_at and updated_at should be equal at creation
      expect(note.created_at).toBe(note.updated_at);
    });

    it("NOTE-004: should store optional fields (tags, parent_note_id, context_url) when provided", () => {
      const parent = repo.create(makeNoteInput());
      const note = repo.create(
        makeNoteInput({
          title: "Test Title",
          tags: ["architecture", "decision"],
          parent_note_id: parent.note_id,
          context_url: "https://example.com/pr/123",
        }),
      );

      expect(note.title).toBe("Test Title");
      expect(note.tags).toEqual(["architecture", "decision"]);
      expect(note.parent_note_id).toBe(parent.note_id);
      expect(note.context_url).toBe("https://example.com/pr/123");
    });

    it("NOTE-004: should allow creating a note without optional fields", () => {
      const note = repo.create(makeNoteInput());

      expect(note.title).toBeNull();
      expect(note.tags).toBeNull();
      expect(note.parent_note_id).toBeNull();
      expect(note.context_url).toBeNull();
    });

    it("NOTE-005: should accept a valid parent_note_id referencing an existing note", () => {
      const parent = repo.create(makeNoteInput({ title: "Parent" }));
      const child = repo.create(
        makeNoteInput({ title: "Child", parent_note_id: parent.note_id }),
      );

      expect(child.parent_note_id).toBe(parent.note_id);
    });

    it("NOTE-006: should reject creation when parent_note_id does not reference an existing note", () => {
      expect(() => {
        repo.create(makeNoteInput({ parent_note_id: "nonexistent-id" }));
      }).toThrow(ParentNoteNotFoundError);
    });

    it("NOTE-006: should reject creation when parent_note_id references a soft-deleted note", () => {
      const parent = repo.create(makeNoteInput({ title: "Parent" }));
      repo.softDelete(parent.note_id);

      expect(() => {
        repo.create(makeNoteInput({ parent_note_id: parent.note_id }));
      }).toThrow(ParentNoteNotFoundError);
    });

    it("NOTE-007: should return the complete note record including all generated fields", () => {
      const note = repo.create(
        makeNoteInput({
          title: "Full Record",
          tags: ["test"],
          context_url: "file:///test.ts",
        }),
      );

      expect(note).toHaveProperty("note_id");
      expect(note).toHaveProperty("session_id", "session-001");
      expect(note).toHaveProperty("user_id", "user-001");
      expect(note).toHaveProperty("agent", "test-agent");
      expect(note).toHaveProperty("title", "Full Record");
      expect(note).toHaveProperty("content");
      expect(note).toHaveProperty("tags", ["test"]);
      expect(note).toHaveProperty("context_url", "file:///test.ts");
      expect(note).toHaveProperty("created_at");
      expect(note).toHaveProperty("updated_at");
      expect(note).toHaveProperty("deleted_at", null);
    });
  });

  // ==========================================================================
  // RETRIEVE
  // ==========================================================================

  describe("getById", () => {
    it("NOTE-008: should return the complete note record when requested by note_id", () => {
      const created = repo.create(makeNoteInput({ title: "Retrieve Me" }));
      const retrieved = repo.getById(created.note_id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.note_id).toBe(created.note_id);
      expect(retrieved!.title).toBe("Retrieve Me");
      expect(retrieved!.content).toBe(created.content);
      expect(retrieved!.session_id).toBe(created.session_id);
      expect(retrieved!.user_id).toBe(created.user_id);
      expect(retrieved!.agent).toBe(created.agent);
      expect(retrieved!.created_at).toBe(created.created_at);
    });

    it("NOTE-009: should return null when the note_id does not exist", () => {
      const result = repo.getById("nonexistent-id");
      expect(result).toBeNull();
    });

    it("NOTE-010: should return null when the note has been soft-deleted", () => {
      const note = repo.create(makeNoteInput());
      repo.softDelete(note.note_id);

      const result = repo.getById(note.note_id);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // LIST AND FILTER
  // ==========================================================================

  describe("list", () => {
    it("NOTE-011: should return all non-deleted notes when no filters are provided", () => {
      repo.create(makeNoteInput({ title: "Note 1" }));
      repo.create(makeNoteInput({ title: "Note 2" }));
      repo.create(makeNoteInput({ title: "Note 3" }));

      const notes = repo.list();
      expect(notes).toHaveLength(3);
    });

    it("NOTE-012: should filter by session_id", () => {
      repo.create(makeNoteInput({ session_id: "session-A" }));
      repo.create(makeNoteInput({ session_id: "session-A" }));
      repo.create(makeNoteInput({ session_id: "session-B" }));

      const notes = repo.list({ session_id: "session-A" });
      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.session_id === "session-A")).toBe(true);
    });

    it("NOTE-013: should filter by user_id", () => {
      repo.create(makeNoteInput({ user_id: "alice" }));
      repo.create(makeNoteInput({ user_id: "bob" }));
      repo.create(makeNoteInput({ user_id: "alice" }));

      const notes = repo.list({ user_id: "alice" });
      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.user_id === "alice")).toBe(true);
    });

    it("NOTE-014: should filter by agent", () => {
      repo.create(makeNoteInput({ agent: "claude" }));
      repo.create(makeNoteInput({ agent: "gpt" }));
      repo.create(makeNoteInput({ agent: "claude" }));

      const notes = repo.list({ agent: "claude" });
      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.agent === "claude")).toBe(true);
    });

    it("NOTE-015: should filter by tags (AND semantics -- must contain all specified tags)", () => {
      repo.create(makeNoteInput({ tags: ["architecture", "decision"] }));
      repo.create(makeNoteInput({ tags: ["architecture", "bug"] }));
      repo.create(makeNoteInput({ tags: ["decision"] }));

      const notes = repo.list({ tags: ["architecture", "decision"] });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.tags).toEqual(["architecture", "decision"]);
    });

    it("NOTE-015: should return notes that contain all specified tags plus additional tags", () => {
      repo.create(makeNoteInput({ tags: ["architecture", "decision", "important"] }));
      repo.create(makeNoteInput({ tags: ["architecture"] }));

      const notes = repo.list({ tags: ["architecture", "decision"] });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.tags).toContain("architecture");
      expect(notes[0]!.tags).toContain("decision");
    });

    it("NOTE-016: should filter by parent_note_id (direct children only)", () => {
      const parent = repo.create(makeNoteInput({ title: "Parent" }));
      repo.create(makeNoteInput({ title: "Child 1", parent_note_id: parent.note_id }));
      repo.create(makeNoteInput({ title: "Child 2", parent_note_id: parent.note_id }));
      repo.create(makeNoteInput({ title: "Unrelated" }));

      const children = repo.list({ parent_note_id: parent.note_id });
      expect(children).toHaveLength(2);
      expect(children.every((n) => n.parent_note_id === parent.note_id)).toBe(true);
    });

    it("NOTE-017: should not include soft-deleted notes in list results", () => {
      const note1 = repo.create(makeNoteInput({ title: "Keep" }));
      const note2 = repo.create(makeNoteInput({ title: "Delete" }));
      repo.softDelete(note2.note_id);

      const notes = repo.list();
      expect(notes).toHaveLength(1);
      expect(notes[0]!.note_id).toBe(note1.note_id);
    });

    it("NOTE-018: should return notes ordered by created_at descending (newest first)", () => {
      const note1 = repo.create(makeNoteInput({ title: "First" }));
      // Spin-wait to ensure distinct millisecond timestamps between creates
      const wait1 = Date.now() + 2;
      while (Date.now() < wait1) { /* spin */ }
      const note2 = repo.create(makeNoteInput({ title: "Second" }));
      const wait2 = Date.now() + 2;
      while (Date.now() < wait2) { /* spin */ }
      const note3 = repo.create(makeNoteInput({ title: "Third" }));

      const notes = repo.list();
      expect(notes).toHaveLength(3);
      // Newest first
      expect(notes[0]!.note_id).toBe(note3.note_id);
      expect(notes[1]!.note_id).toBe(note2.note_id);
      expect(notes[2]!.note_id).toBe(note1.note_id);
    });

    it("NOTE-012,013,014: should combine multiple filters", () => {
      repo.create(makeNoteInput({ session_id: "s1", user_id: "alice", agent: "claude" }));
      repo.create(makeNoteInput({ session_id: "s1", user_id: "bob", agent: "claude" }));
      repo.create(makeNoteInput({ session_id: "s2", user_id: "alice", agent: "claude" }));

      const notes = repo.list({ session_id: "s1", user_id: "alice", agent: "claude" });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.session_id).toBe("s1");
      expect(notes[0]!.user_id).toBe("alice");
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe("update", () => {
    it("NOTE-019: should apply changes to the specified note", () => {
      const note = repo.create(makeNoteInput({ title: "Original" }));
      const updated = repo.update({
        note_id: note.note_id,
        title: "Updated",
        content: "New content",
      });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe("Updated");
      expect(updated!.content).toBe("New content");
    });

    it("NOTE-020: should allow updating title, content, tags, context_url, and parent_note_id", () => {
      const parent = repo.create(makeNoteInput({ title: "Parent" }));
      const note = repo.create(makeNoteInput());

      const updated = repo.update({
        note_id: note.note_id,
        title: "New Title",
        content: "New Content",
        tags: ["new-tag"],
        context_url: "https://new-url.com",
        parent_note_id: parent.note_id,
      });

      expect(updated!.title).toBe("New Title");
      expect(updated!.content).toBe("New Content");
      expect(updated!.tags).toEqual(["new-tag"]);
      expect(updated!.context_url).toBe("https://new-url.com");
      expect(updated!.parent_note_id).toBe(parent.note_id);
    });

    it("NOTE-021: should not change immutable fields (session_id, user_id, agent, created_at)", () => {
      const note = repo.create(makeNoteInput());
      const originalCreatedAt = note.created_at;

      // Update only mutable fields
      const updated = repo.update({
        note_id: note.note_id,
        title: "Changed",
      });

      expect(updated!.session_id).toBe(note.session_id);
      expect(updated!.user_id).toBe(note.user_id);
      expect(updated!.agent).toBe(note.agent);
      expect(updated!.created_at).toBe(originalCreatedAt);
    });

    it("NOTE-022: should set updated_at to the current timestamp on update", () => {
      const note = repo.create(makeNoteInput());
      const originalUpdatedAt = note.updated_at;

      // Ensure at least 1ms passes
      const waitUntil = Date.now() + 2;
      while (Date.now() < waitUntil) {
        /* spin */
      }

      const updated = repo.update({
        note_id: note.note_id,
        title: "Changed",
      });

      expect(updated!.updated_at).not.toBe(originalUpdatedAt);
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      );
    });

    it("NOTE-023: should return null when the note_id does not exist", () => {
      const result = repo.update({
        note_id: "nonexistent-id",
        title: "Updated",
      });
      expect(result).toBeNull();
    });

    it("NOTE-024: should return null when the note has been soft-deleted", () => {
      const note = repo.create(makeNoteInput());
      repo.softDelete(note.note_id);

      const result = repo.update({
        note_id: note.note_id,
        title: "Updated",
      });
      expect(result).toBeNull();
    });

    it("NOTE-025: should accept a valid parent_note_id on update", () => {
      const parent = repo.create(makeNoteInput({ title: "Parent" }));
      const note = repo.create(makeNoteInput({ title: "Child" }));

      const updated = repo.update({
        note_id: note.note_id,
        parent_note_id: parent.note_id,
      });

      expect(updated!.parent_note_id).toBe(parent.note_id);
    });

    it("NOTE-026: should throw when parent_note_id does not reference an existing note", () => {
      const note = repo.create(makeNoteInput());

      expect(() => {
        repo.update({
          note_id: note.note_id,
          parent_note_id: "nonexistent-parent",
        });
      }).toThrow(ParentNoteNotFoundError);
    });

    it("NOTE-027: should return the complete updated note record", () => {
      const note = repo.create(makeNoteInput({ title: "Original" }));
      const updated = repo.update({
        note_id: note.note_id,
        title: "Updated",
      });

      expect(updated).toHaveProperty("note_id", note.note_id);
      expect(updated).toHaveProperty("title", "Updated");
      expect(updated).toHaveProperty("content");
      expect(updated).toHaveProperty("session_id");
      expect(updated).toHaveProperty("user_id");
      expect(updated).toHaveProperty("agent");
      expect(updated).toHaveProperty("created_at");
      expect(updated).toHaveProperty("updated_at");
      expect(updated).toHaveProperty("deleted_at", null);
    });
  });

  // ==========================================================================
  // SOFT-DELETE
  // ==========================================================================

  describe("softDelete", () => {
    it("NOTE-028: should mark the note as deleted without permanently removing it", () => {
      const note = repo.create(makeNoteInput());
      const result = repo.softDelete(note.note_id);

      expect(result).not.toBeNull();
      // Note should not be retrievable via normal getById
      expect(repo.getById(note.note_id)).toBeNull();
      // But the note is NOT permanently gone -- list won't show it
      expect(repo.list()).toHaveLength(0);
    });

    it("NOTE-029: should return null when the note_id does not exist", () => {
      const result = repo.softDelete("nonexistent-id");
      expect(result).toBeNull();
    });

    it("NOTE-030: should throw when the note has already been soft-deleted", () => {
      const note = repo.create(makeNoteInput());
      repo.softDelete(note.note_id);

      expect(() => {
        repo.softDelete(note.note_id);
      }).toThrow(NoteAlreadyDeletedError);
    });

    it("NOTE-031: should return confirmation with note_id and deleted_at timestamp", () => {
      const note = repo.create(makeNoteInput());
      const result = repo.softDelete(note.note_id);

      expect(result).not.toBeNull();
      expect(result!.note_id).toBe(note.note_id);
      expect(result!.deleted_at).toBeDefined();
      // ISO 8601 format
      expect(new Date(result!.deleted_at).toISOString()).toBe(result!.deleted_at);
    });
  });

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  describe("search", () => {
    it("NOTE-032: should return notes whose title or content matches the query", () => {
      repo.create(makeNoteInput({ title: "Architecture Decision", content: "We chose TypeScript." }));
      repo.create(makeNoteInput({ title: "Bug Report", content: "Found a bug in the architecture module." }));
      repo.create(makeNoteInput({ title: "Meeting Notes", content: "Discussed roadmap." }));

      const results = repo.search("architecture");
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Both notes with "architecture" should be found
      const titles = results.map((n) => n.title);
      expect(titles).toContain("Architecture Decision");
      expect(titles).toContain("Bug Report");
    });

    it("NOTE-033: should perform case-insensitive matching", () => {
      repo.create(makeNoteInput({ title: "Architecture Notes", content: "Important decisions." }));

      const lower = repo.search("architecture");
      const upper = repo.search("ARCHITECTURE");

      expect(lower.length).toBeGreaterThanOrEqual(1);
      expect(upper.length).toBeGreaterThanOrEqual(1);
      expect(lower[0]!.note_id).toBe(upper[0]!.note_id);
    });

    it("NOTE-034: should not include soft-deleted notes in search results", () => {
      const note = repo.create(
        makeNoteInput({ title: "Deletable", content: "Unique searchable content xyzzy." }),
      );
      repo.softDelete(note.note_id);

      const results = repo.search("xyzzy");
      expect(results).toHaveLength(0);
    });

    it("NOTE-035: should return an empty list when no notes match", () => {
      repo.create(makeNoteInput({ content: "Regular content." }));

      const results = repo.search("nonexistentterm12345");
      expect(results).toHaveLength(0);
    });

    it("NOTE-036: should return results ordered by relevance", () => {
      // Note with "typescript" in both title and content should rank higher
      repo.create(
        makeNoteInput({
          title: "TypeScript Best Practices",
          content: "TypeScript provides type safety for TypeScript projects.",
        }),
      );
      repo.create(
        makeNoteInput({
          title: "Meeting Notes",
          content: "We briefly mentioned TypeScript.",
        }),
      );

      const results = repo.search("typescript");
      expect(results.length).toBeGreaterThanOrEqual(2);
      // The note with more occurrences of "typescript" should appear first
      expect(results[0]!.title).toBe("TypeScript Best Practices");
    });
  });
});
