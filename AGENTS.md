---
description: Instructions building apps with Supabase
globs: *
alwaysApply: true
---

# Supabase Documentation - Overview

## What is Supabase?

Backend-as-a-service (BaaS) platform providing:

- **Database**: PostgreSQL with PostgREST API
- **Authentication**: Email/password + OAuth (Google, GitHub)
- **Storage**: File upload/download
- **AI**: Chat completions and image generation (OpenAI-compatible)
- **Functions**: Serverless function deployment
- **Realtime**: WebSocket pub/sub (database + client events)

## Technology Stack

This project uses **Supabase** (not InsForge) as its backend:

- **Database**: Supabase PostgreSQL + PostGIS
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime
- **SDK (Web)**: `@supabase/supabase-js` + `@supabase/ssr`
- **SDK (Mobile)**: `supabase_flutter`

## Important Notes

- Use Supabase client libraries, never InsForge SDK
- The project uses `@supabase/supabase-js` and `@supabase/ssr`
- Database inserts require object format (not array wrapping)
- Serverless functions are deployed via Supabase Edge Functions
- AI operations use OpenAI-compatible API
- API returns `{data, error}` structure for all operations

## Codebase Memory MCP

This project uses **codebase-memory-mcp** — a persistent knowledge graph of the entire codebase. Use these MCP tools instead of manual file searches:

- **`index_repository`** — (re)build the graph. Run when files change.
- **`search_graph`** — find nodes by name pattern and label (e.g., `"Function"`, `"Class"`, `"Route"`).
- **`trace_path`** — trace function call chains (callers/callees) between nodes.
- **`get_architecture`** — get a high-level overview of the project structure.
- **`search_code`** — semantic code search across the indexed codebase.
- **`query_graph`** — run custom Cypher-like queries on the graph.
- **`get_code_snippet`** — retrieve the full source of a specific node.
- **`detect_changes`** — check what files changed since last index and update the graph incrementally.

  Use `get_architecture(aspects=['all'])` first to understand the project layout, then drill into specific areas with `search_graph` or `trace_path`.
