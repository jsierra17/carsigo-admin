---
description: Instructions building apps with Firebase
globs: *
alwaysApply: true
---

# Firebase Documentation - Overview

## What is Firebase?

Backend-as-a-service (BaaS) platform providing:

- **Database**: Firestore (NoSQL, document/collection model)
- **Authentication**: Email/password + Google OAuth
- **Storage**: File upload/download
- **Functions**: Serverless function deployment
- **Realtime**: Firestore listeners / onSnapshot pub-sub

## Technology Stack

This project uses **Firebase** as its backend:

- **Database**: Firestore
- **Auth**: Firebase Auth (email/password + Google OAuth)
- **SDK (Web)**: `firebase` + `firebase-admin`
- **SDK (Mobile)**: `firebase_*` Flutter packages

## Important Notes

- Use Firebase client libraries, never Supabase or InsForge SDK
- The project uses `firebase` (browser) and `firebase-admin` (server)
- Admin SDK clients: `lib/firebase/service.ts` (admin), `lib/firebase/admin-fs.ts` (Firestore admin), `lib/firebase/rest-auth.ts` (Auth admin via REST)
- Browser clients: `lib/firebase/client.ts`, `lib/firebase/server.ts` (SSR/cookies), `lib/firebase/firestore-compat.ts` (compat API layer)
- Singleton for client components: `lib/db.ts`
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
