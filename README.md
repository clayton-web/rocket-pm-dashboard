# Rocket PM Dashboard

## Overview

An inbox and AI-assisted responder dashboard for property management operations in British Columbia. It connects to Gmail, syncs threads on demand, and generates draft replies with BC-oriented safeguards and human-review flags.

## Current features

- Gmail connection (OAuth)
- Manual email sync
- Inbox viewer
- AI draft responder (BC-aware safety and review flags)

## Tech stack

- Next.js (App Router)
- Prisma + PostgreSQL
- Gmail API
- OpenAI

## Setup

1. Copy `.env.example` to `.env`.

2. Set the required environment variables:

   - `DATABASE_URL`
   - `NEXTAUTH_SECRET` or `AUTH_SECRET`
   - `NEXTAUTH_URL` or `AUTH_URL`
   - `OPENAI_API_KEY`

   Gmail OAuth, token encryption, and other options are documented in `.env.example`.

3. Install dependencies and prepare the database:

   ```bash
   npm install
   npx prisma db push
   npm run db:seed
   npm run dev
   ```

## Notes

- Gmail and AI calls run only on the server; API keys and tokens are not exposed to the client.
- Data access is scoped to a multi-tenant organization model.
- V1 focuses on inbox workflows and the AI responder; other product areas are stubs only in navigation.
- There is no automated sync, scheduling, or outbound email sending in this version.

## Future direction

This dashboard is intended to grow into a broader command center that also integrates property management core operations, maintenance, inspections, documents, and CRM. Those modules are not implemented in the current codebase.
