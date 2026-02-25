/**
 * Integration tests for MCP tool handlers.
 *
 * Feature: note-management
 * Spec version: 1.0.0
 * Generated from: spec.adoc
 *
 * Tests the tool handlers through the McpServer registration,
 * verifying the full request path from tool invocation to response.
 * Covers error formatting and MCP result structure.
 *
 * Spec coverage:
 *   NOTE-006, NOTE-009, NOTE-010, NOTE-023, NOTE-024, NOTE-026, NOTE-029, NOTE-030
 *   (error handling paths that the repository tests don't cover at the MCP response level)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { NoteRepository } from "../../../src/repository/note-repository.js";
import { registerCreateNote } from "../../../src/tools/create-note.js";
import { registerGetNote } from "../../../src/tools/get-note.js";
import { registerListNotes } from "../../../src/tools/list-notes.js";
import { registerUpdateNote } from "../../../src/tools/update-note.js";
import { registerDeleteNote } from "../../../src/tools/delete-note.js";
import { registerSearchNotes } from "../../../src/tools/search-notes.js";

describe("MCP Tool Handlers", () => {
  let repo: NoteRepository;
  let server: McpServer;
  let client: Client;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "notetaker-tool-test-"));
    repo = new NoteRepository(join(tmpDir, "test.db"));

    server = new McpServer(
      { name: "test-notetaker", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );

    registerCreateNote(server, repo);
    registerGetNote(server, repo);
    registerListNotes(server, repo);
    registerUpdateNote(server, repo);
    registerDeleteNote(server, repo);
    registerSearchNotes(server, repo);

    client = new Client({ name: "test-client", version: "0.1.0" });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    repo.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create a note and return the full record via MCP", async () => {
    const result = await client.callTool({
      name: "create_note",
      arguments: {
        title: "MCP Test Note",
        content: "= Test\n\nHello from MCP.",
        session_id: "mcp-session",
        user_id: "mcp-user",
        agent: "mcp-agent",
        tags: ["mcp", "test"],
      },
    });

    expect(result.isError).toBeFalsy();
    const note = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(note.note_id).toBeDefined();
    expect(note.title).toBe("MCP Test Note");
    expect(note.session_id).toBe("mcp-session");
    expect(note.tags).toEqual(["mcp", "test"]);
  });

  it("NOTE-006: should return error when creating with invalid parent_note_id", async () => {
    const result = await client.callTool({
      name: "create_note",
      arguments: {
        content: "Child note",
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
        parent_note_id: "nonexistent",
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("Parent note");
    expect(text).toContain("not found");
  });

  it("NOTE-009: should return error when getting a nonexistent note", async () => {
    const result = await client.callTool({
      name: "get_note",
      arguments: { note_id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("should list notes with filters via MCP", async () => {
    await client.callTool({
      name: "create_note",
      arguments: { content: "Note A", session_id: "s1", user_id: "u1", agent: "a1" },
    });
    await client.callTool({
      name: "create_note",
      arguments: { content: "Note B", session_id: "s2", user_id: "u1", agent: "a1" },
    });

    const result = await client.callTool({
      name: "list_notes",
      arguments: { session_id: "s1" },
    });

    expect(result.isError).toBeFalsy();
    const notes = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(notes).toHaveLength(1);
    expect(notes[0].session_id).toBe("s1");
  });

  it("NOTE-023: should return error when updating a nonexistent note", async () => {
    const result = await client.callTool({
      name: "update_note",
      arguments: { note_id: "nonexistent", title: "New Title" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("NOTE-026: should return error when updating with invalid parent_note_id", async () => {
    // Create a note first
    const createResult = await client.callTool({
      name: "create_note",
      arguments: { content: "Test", session_id: "s1", user_id: "u1", agent: "a1" },
    });
    const created = JSON.parse((createResult.content as Array<{ text: string }>)[0]!.text);

    const result = await client.callTool({
      name: "update_note",
      arguments: { note_id: created.note_id, parent_note_id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("Parent note");
    expect(text).toContain("not found");
  });

  it("NOTE-029: should return error when deleting a nonexistent note", async () => {
    const result = await client.callTool({
      name: "delete_note",
      arguments: { note_id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("NOTE-030: should return error when deleting an already-deleted note", async () => {
    const createResult = await client.callTool({
      name: "create_note",
      arguments: { content: "Delete me", session_id: "s1", user_id: "u1", agent: "a1" },
    });
    const created = JSON.parse((createResult.content as Array<{ text: string }>)[0]!.text);

    // First delete succeeds
    await client.callTool({
      name: "delete_note",
      arguments: { note_id: created.note_id },
    });

    // Second delete should error
    const result = await client.callTool({
      name: "delete_note",
      arguments: { note_id: created.note_id },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("already deleted");
  });

  it("should search notes via MCP", async () => {
    await client.callTool({
      name: "create_note",
      arguments: {
        title: "Architecture Review",
        content: "Reviewed the architecture.",
        session_id: "s1",
        user_id: "u1",
        agent: "a1",
      },
    });

    const result = await client.callTool({
      name: "search_notes",
      arguments: { query: "architecture" },
    });

    expect(result.isError).toBeFalsy();
    const notes = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].title).toBe("Architecture Review");
  });
});
