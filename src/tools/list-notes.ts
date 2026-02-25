/**
 * list_notes MCP tool -- Lists notes with optional filters.
 */

import { z } from "zod";
import { ListNotesSchema } from "../schema.js";
import type { NoteRepository } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerListNotes(server: McpServer, repo: NoteRepository): void {
  server.registerTool(
    "list_notes",
    {
      description: "List notes with optional filters. Supports filtering by session_id, user_id, agent, tags, and parent_note_id. Returns notes ordered by creation time (newest first).",
      inputSchema: ListNotesSchema,
    },
    (args: z.infer<typeof ListNotesSchema>) => {
      const notes = repo.list({
        session_id: args.session_id,
        user_id: args.user_id,
        agent: args.agent,
        tags: args.tags,
        parent_note_id: args.parent_note_id,
      });

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
