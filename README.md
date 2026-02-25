# mcp-notetaker

An MCP server for recording atomic notes during AI-assisted working sessions. Notes are persisted locally in SQLite with full-text search.

## What it does

Exposes six MCP tools for managing notes:

| Tool | Purpose |
|---|---|
| `create_note` | Create a note with content, session/user/agent attribution, tags, and threading |
| `get_note` | Retrieve a note by ID |
| `list_notes` | List notes with filters (session, user, agent, tags, parent) |
| `update_note` | Update a note's mutable fields |
| `delete_note` | Soft-delete a note (preserves data) |
| `search_notes` | Full-text search across titles and content |

Notes use AsciiDoc for content, UUID v7 for identifiers, and support parent-child threading.

## Quick start

```sh
npm install
npm run build
```

### Configure your MCP client

Add to your `opencode.json` (in the `"mcp"` section):

```json
{
  "mcp": {
    "notetaker": {
      "type": "local",
      "command": ["node", "/absolute/path/to/mcp-notetaker/dist/index.js"],
      "enabled": true
    }
  }
}
```

The database is created automatically at `~/.local/share/mcp-notetaker/notes.db`. Override with the `NOTETAKER_DB_PATH` environment variable.

## Development

```sh
npm run dev          # watch mode (recompiles on change)
npm test             # run tests
npm run test:watch   # watch mode tests
npm run typecheck    # type check without emitting
```

Requires Node.js >= 20.

## Documentation

Detailed documentation lives in `docs/`:

- **[Architecture](docs/architecture.adoc)** -- C4 system overview, technology stack, data architecture
- **[ADRs](docs/adrs/index.adoc)** -- Architecture decision records (TypeScript, SQLite, soft-delete, UUID v7)
- **[Feature: note-management](docs/features/note-management/)** -- User stories, specs, design, data model, tasks

This project uses the [proven-intent](AGENTS.md) workflow for feature development.

## Contributing

1. Read the [architecture](docs/architecture.adoc) and relevant [ADRs](docs/adrs/index.adoc)
2. Load the `proven-intent` skill (see [AGENTS.md](AGENTS.md)) to declare your desired state
3. The workflow will guide you through stories, specs, design, implementation, and tests

## License

[Apache-2.0](LICENSE)
