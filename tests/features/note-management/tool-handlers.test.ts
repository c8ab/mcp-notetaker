/**
 * Integration tests for MCP tool handlers.
 *
 * Feature: note-management
 *
 * Tests the tool handlers through the McpServer registration,
 * verifying the full request path from tool invocation to response.
 * Uses a mocked fetch to simulate the notetaker-api.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { NoteApiClient } from "../../../src/repository/note-repository.js";
import { registerCreateNote } from "../../../src/tools/create-note.js";
import { registerGetNote } from "../../../src/tools/get-note.js";
import { registerListNotes } from "../../../src/tools/list-notes.js";
import { registerUpdateNote } from "../../../src/tools/update-note.js";
import { registerDeleteNote } from "../../../src/tools/delete-note.js";
import { registerSearchNotes } from "../../../src/tools/search-notes.js";
import { registerListDeletedNotes } from "../../../src/tools/list-deleted-notes.js";
import type { Note } from "../../../src/types.js";

const BASE_URL = "http://localhost:3000";

/** Helper to build a mock Note object. */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    note_id: "019abc12-3456-7def-8901-234567890abc",
    session_id: "session-001",
    user_id: "user-001",
    agent: "test-agent",
    title: null,
    content: "= Test\n\nHello from MCP.",
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
function mockResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

describe("MCP Tool Handlers", () => {
  let apiClient: NoteApiClient;
  let server: McpServer;
  let client: Client;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    apiClient = new NoteApiClient(BASE_URL);

    server = new McpServer(
      { name: "test-notetaker", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );

    registerCreateNote(server, apiClient);
    registerGetNote(server, apiClient);
    registerListNotes(server, apiClient);
    registerUpdateNote(server, apiClient);
    registerDeleteNote(server, apiClient);
    registerSearchNotes(server, apiClient);
    registerListDeletedNotes(server, apiClient);

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
    vi.restoreAllMocks();
  });

  it("should create a note and return the full record via MCP", async () => {
    const note = makeNote({
      title: "MCP Test Note",
      tags: ["mcp", "test"],
      session_id: "mcp-session",
    });
    fetchMock.mockResolvedValue(mockResponse(note, { status: 201 }));

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
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.note_id).toBeDefined();
    expect(parsed.title).toBe("MCP Test Note");
    expect(parsed.tags).toEqual(["mcp", "test"]);
  });

  it("should return error when creating a note fails (API error)", async () => {
    fetchMock.mockResolvedValue(mockResponse("Parent note not found", { status: 400 }));

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
    expect(text).toContain("Failed to create note");
  });

  it("should return error when getting a nonexistent note", async () => {
    fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

    const result = await client.callTool({
      name: "get_note",
      arguments: { note_id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("should list notes with filters via MCP", async () => {
    const notes = [makeNote({ session_id: "s1" })];
    fetchMock.mockResolvedValue(mockResponse(notes));

    const result = await client.callTool({
      name: "list_notes",
      arguments: { session_id: "s1" },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].session_id).toBe("s1");

    // Verify the query param was sent
    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get("session_id")).toBe("s1");
  });

  it("should list notes with created_after and updated_after filters", async () => {
    fetchMock.mockResolvedValue(mockResponse([]));

    await client.callTool({
      name: "list_notes",
      arguments: {
        created_after: "2026-01-01T00:00:00.000Z",
        updated_after: "2026-01-02T00:00:00.000Z",
      },
    });

    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get("created_after")).toBe("2026-01-01T00:00:00.000Z");
    expect(url.searchParams.get("updated_after")).toBe("2026-01-02T00:00:00.000Z");
  });

  it("should return error when updating a nonexistent note", async () => {
    fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

    const result = await client.callTool({
      name: "update_note",
      arguments: { note_id: "nonexistent", title: "New Title" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("should return error when update fails with API error", async () => {
    fetchMock.mockResolvedValue(mockResponse("Server error", { status: 500 }));

    const result = await client.callTool({
      name: "update_note",
      arguments: { note_id: "note-1", title: "New Title" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("Failed to update note");
  });

  it("should return error when deleting a nonexistent note", async () => {
    fetchMock.mockResolvedValue(mockResponse("Not found", { status: 404 }));

    const result = await client.callTool({
      name: "delete_note",
      arguments: { note_id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("not found");
  });

  it("should return error when deleting an already-deleted note", async () => {
    fetchMock.mockResolvedValue(mockResponse("Already deleted", { status: 409 }));

    const result = await client.callTool({
      name: "delete_note",
      arguments: { note_id: "note-123" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("already deleted");
  });

  it("should search notes via MCP", async () => {
    const notes = [makeNote({ title: "Architecture Review" })];
    fetchMock.mockResolvedValue(mockResponse(notes));

    const result = await client.callTool({
      name: "search_notes",
      arguments: { query: "architecture" },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].title).toBe("Architecture Review");

    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get("query")).toBe("architecture");
  });

  it("should list deleted notes via MCP", async () => {
    const entries = [
      { note_id: "note-1", deleted_at: "2026-01-15T12:00:00.000Z" },
    ];
    fetchMock.mockResolvedValue(mockResponse(entries));

    const result = await client.callTool({
      name: "list_deleted_notes",
      arguments: { since: "2026-01-01T00:00:00.000Z" },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].note_id).toBe("note-1");

    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get("since")).toBe("2026-01-01T00:00:00.000Z");
  });
});
