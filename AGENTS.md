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
