/**
 * update_note MCP tool -- Updates an existing note's mutable fields.
 */

import { z } from "zod";
import { UpdateNoteSchema } from "../schema.js";
import { NoteApiClient, ApiError } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerUpdateNote(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "update_note",
    {
      description: "Update an existing note's mutable fields (title, content, tags, context_url, parent_note_id). Immutable fields (session_id, user_id, agent, created_at) cannot be changed.",
      inputSchema: UpdateNoteSchema,
    },
    async (args: z.infer<typeof UpdateNoteSchema>) => {
      try {
        const note = await client.update({
          note_id: args.note_id,
          title: args.title,
          content: args.content,
          tags: args.tags,
          context_url: args.context_url,
          parent_note_id: args.parent_note_id,
        });

        if (!note) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Note '${args.note_id}' not found`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(note, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: error.message,
              },
            ],
          };
        }
        throw error;
      }
    },
  );
}
