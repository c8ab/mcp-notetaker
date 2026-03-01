/**
 * delete_note MCP tool -- Deletes a note (soft-delete on the API side).
 */

import { z } from "zod";
import { DeleteNoteSchema } from "../schema.js";
import { NoteApiClient, NoteAlreadyDeletedError } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeleteNote(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "delete_note",
    {
      description: "Delete a note. The note is soft-deleted on the API side -- it will no longer appear in get, list, or search results but can be found via list_deleted_notes.",
      inputSchema: DeleteNoteSchema,
    },
    async (args: z.infer<typeof DeleteNoteSchema>) => {
      try {
        const result = await client.delete(args.note_id);

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
