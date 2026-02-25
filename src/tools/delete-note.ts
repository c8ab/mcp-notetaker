/**
 * delete_note MCP tool -- Soft-deletes a note.
 */

import { z } from "zod";
import { DeleteNoteSchema } from "../schema.js";
import { NoteRepository, NoteAlreadyDeletedError } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeleteNote(server: McpServer, repo: NoteRepository): void {
  server.registerTool(
    "delete_note",
    {
      description: "Soft-delete a note. The note is marked as deleted but preserved in the database for audit history. It will no longer appear in get, list, or search results.",
      inputSchema: DeleteNoteSchema,
    },
    (args: z.infer<typeof DeleteNoteSchema>) => {
      try {
        const result = repo.softDelete(args.note_id);

        if (!result) {
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
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof NoteAlreadyDeletedError) {
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
