/**
 * list_deleted_notes MCP tool -- Lists deleted note IDs since a given timestamp.
 */

import { z } from "zod";
import { ListDeletedSchema } from "../schema.js";
import type { NoteApiClient } from "../repository/note-repository.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerListDeletedNotes(server: McpServer, client: NoteApiClient): void {
  server.registerTool(
    "list_deleted_notes",
    {
      description: "List note IDs that have been deleted since a given timestamp. Useful for sync clients that need to detect deletions.",
      inputSchema: ListDeletedSchema,
    },
    async (args: z.infer<typeof ListDeletedSchema>) => {
      const entries = await client.listDeleted(args.since);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(entries, null, 2),
          },
        ],
      };
    },
  );
}
