#!/usr/bin/env node

/**
 * MCP Notetaker -- An MCP server for recording atomic notes with SQLite persistence.
 *
 * Entry point: creates the MCP server, initializes the database, registers all tools,
 * and connects to stdio transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NoteRepository } from "./repository/note-repository.js";
import { registerCreateNote } from "./tools/create-note.js";
import { registerGetNote } from "./tools/get-note.js";
import { registerListNotes } from "./tools/list-notes.js";
import { registerUpdateNote } from "./tools/update-note.js";
import { registerDeleteNote } from "./tools/delete-note.js";
import { registerSearchNotes } from "./tools/search-notes.js";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/**
 * Resolves the database file path from environment or default.
 * Default: ~/.local/share/mcp-notetaker/notes.db
 */
function resolveDbPath(): string {
  const envPath = process.env.NOTETAKER_DB_PATH;
  if (envPath) {
    return envPath;
  }

  const dataDir = join(homedir(), ".local", "share", "mcp-notetaker");
  return join(dataDir, "notes.db");
}

async function main(): Promise<void> {
  const dbPath = resolveDbPath();

  // Ensure the directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Initialize the repository
  const repo = new NoteRepository(dbPath);

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
  registerCreateNote(server, repo);
  registerGetNote(server, repo);
  registerListNotes(server, repo);
  registerUpdateNote(server, repo);
  registerDeleteNote(server, repo);
  registerSearchNotes(server, repo);

  // Graceful shutdown
  const cleanup = () => {
    repo.close();
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
