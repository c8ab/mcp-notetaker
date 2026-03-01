/**
 * get_note MCP tool -- Retrieves a single note by its ID.
 */

import { z } from "zod";
import { GetNoteSchema } from "../schema.js";
import type { NoteApiClient } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetNote(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "get_note",
    {
      description: "Retrieve a single note by its ID. Returns the complete note record.",
      inputSchema: GetNoteSchema,
    },
    async (args: z.infer<typeof GetNoteSchema>) => {
      const note = await client.getById(args.note_id);

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
    },
  );
}
