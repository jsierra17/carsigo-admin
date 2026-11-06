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
- **SDK (Web)**: `firebase` (en `apps/admin-web`)
- **SDK (Server)**: `firebase-admin` (en `apps/admin-api` y `functions`)
- **SDK (Mobile)**: `firebase_*` Flutter packages (en `apps/mobile`)

> ⚠️ Este proyecto **NO** usa Next.js, React, Mapbox ni Supabase.
> Si algo en el código los menciona, es código muerto de una versión anterior.
> Las instrucciones completas (y las prohibiciones) están en [`CLAUDE.md`](CLAUDE.md).

## Important Notes

- Use Firebase client libraries, never Supabase or InsForge SDK
- The project uses `firebase` (browser) and `firebase-admin` (server)

### Dónde está cada cosa

| Contexto | Ruta |
|---|---|
| Firebase Web SDK (cliente) | `apps/admin-web/src/services/firebase.js` |
| App Check (reCAPTCHA v3) | `apps/admin-web/src/services/app-check.js` |
| Firebase Admin SDK (servidor) | `apps/admin-api/src/lib/firebase-admin.js` |
| Auth vía REST (servidor) | `apps/admin-api/src/lib/firebase/rest-auth.js` |
| Config y env de la API | `apps/admin-api/src/config.js` |
| Firebase Flutter (móvil) | `apps/mobile/lib/firebase_options.dart` + `apps/mobile/lib/services/app_check_service.dart` |
| Reglas de Firestore | `firebase/firestore.rules` |
| Reglas de Storage | `firebase/storage.rules` |
| Índices de Firestore | `firebase/firestore.indexes.json` |
| Config del CLI (única) | `firebase.json` (raíz del monorepo) |

### Variables de entorno

- El navegador solo ve variables con prefijo **`VITE_`** (`import.meta.env`).
- El servidor usa variables **sin prefijo** (`FIREBASE_API_KEY`, `OWNER_EMAIL`…).
- Ficheros: `.env` (desarrollo), `.env.production` (producción), `.env.example` (plantilla).

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
