/**
 * search_notes MCP tool -- Searches notes by text content.
 */

import { z } from "zod";
import { SearchNotesSchema } from "../schema.js";
import type { NoteApiClient } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchNotes(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "search_notes",
    {
      description: "Search notes by text content. Performs full-text search across note titles and content. Returns results ordered by relevance.",
      inputSchema: SearchNotesSchema,
    },
    async (args: z.infer<typeof SearchNotesSchema>) => {
      const notes = await client.search(args.query);

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
