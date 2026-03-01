#!/usr/bin/env node

/**
 * MCP Notetaker -- An MCP server for recording atomic notes via the notetaker-api.
 *
 * Entry point: creates the MCP server, initializes the API client, registers all tools,
 * and connects to stdio transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NoteApiClient } from "./repository/note-repository.js";
import { registerCreateNote } from "./tools/create-note.js";
import { registerGetNote } from "./tools/get-note.js";
import { registerListNotes } from "./tools/list-notes.js";
import { registerUpdateNote } from "./tools/update-note.js";
import { registerDeleteNote } from "./tools/delete-note.js";
import { registerSearchNotes } from "./tools/search-notes.js";
import { registerListDeletedNotes } from "./tools/list-deleted-notes.js";

/**
 * Resolves the API base URL from environment or default.
 * Default: http://localhost:3000
 */
function resolveApiUrl(): string {
  return process.env.NOTETAKER_API_URL ?? "http://localhost:3000";
}

async function main(): Promise<void> {
  const apiUrl = resolveApiUrl();
  const client = new NoteApiClient(apiUrl);

  // Create the MCP server
  const server = new McpServer(
    {
      name: "mcp-notetaker",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register all tools
  registerCreateNote(server, client);
  registerGetNote(server, client);
  registerListNotes(server, client);
  registerUpdateNote(server, client);
  registerDeleteNote(server, client);
  registerSearchNotes(server, client);
  registerListDeletedNotes(server, client);

  // Graceful shutdown
  const cleanup = () => {
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
