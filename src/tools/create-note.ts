/**
 * create_note MCP tool -- Creates a new atomic note with metadata.
 */

import { z } from "zod";
import { CreateNoteSchema } from "../schema.js";
import { NoteRepository, ParentNoteNotFoundError } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateNote(server: McpServer, repo: NoteRepository): void {
  server.registerTool(
    "create_note",
    {
      description: "Create a new atomic note with metadata. Content should be in AsciiDoc format.",
      inputSchema: CreateNoteSchema,
    },
    (args: z.infer<typeof CreateNoteSchema>) => {
      try {
        const note = repo.create({
          title: args.title,
          content: args.content,
          session_id: args.session_id,
          user_id: args.user_id,
          agent: args.agent,
          tags: args.tags,
          parent_note_id: args.parent_note_id,
          context_url: args.context_url,
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
        if (error instanceof ParentNoteNotFoundError) {
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
