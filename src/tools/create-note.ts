/**
 * create_note MCP tool -- Creates a new atomic note with metadata.
 */

import { z } from "zod";
import { CreateNoteSchema } from "../schema.js";
import { NoteApiClient, ApiError } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateNote(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "create_note",
    {
      description: "Create a new atomic note with metadata. Content should be in AsciiDoc format.",
      inputSchema: CreateNoteSchema,
    },
    async (args: z.infer<typeof CreateNoteSchema>) => {
      try {
        const note = await client.create({
          title: args.title,
          content: args.content,
          session_id: args.session_id,
          user_id: args.user_id,
          agent: args.agent,
          tags: args.tags,
          parent_note_id: args.parent_note_id,
          context_url: args.context_url,
          created_at: args.created_at,
        });

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
