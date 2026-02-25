/**
 * search_notes MCP tool -- Searches notes by text content using FTS5.
 */

import { z } from "zod";
import { SearchNotesSchema } from "../schema.js";
import type { NoteRepository } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchNotes(server: McpServer, repo: NoteRepository): void {
  server.registerTool(
    "search_notes",
    {
      description: "Search notes by text content. Performs case-insensitive full-text search across note titles and content. Returns results ordered by relevance.",
      inputSchema: SearchNotesSchema,
    },
    (args: z.infer<typeof SearchNotesSchema>) => {
      const notes = repo.search(args.query);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(notes, null, 2),
          },
        ],
      };
    },
  );
}
