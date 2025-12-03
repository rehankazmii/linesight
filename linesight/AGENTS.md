# AGENTS.md – LineSight

## Project Overview
- This repo contains LineSight, a factory quality dashboard for Apple Watch Ultra 2 FATP.
- Tech stack: Next.js (App Router), React, TypeScript, Tailwind CSS, Prisma + SQLite.
- All data is synthetic and generated locally.

## PRD
- Before changing code, consult PRD_SUMMARY.md for entities, metrics, and behavior.

## Coding Conventions
- Use TypeScript strict mode, idiomatic React, and clean separation of concerns.
- Use Tailwind CSS for styling; UI should be clean, data-dense, and Apple-like.
- Prefer simple, readable architecture over clever abstractions.

## Commands
- `npm run dev` – Next.js dev server.
- `npm install prisma @prisma/client` – install Prisma.
- `npx prisma migrate dev` – apply DB migrations.
- `npx ts-node scripts/seed.ts` – seed demo data (after implemented).

## Workflow
- Codex should only edit files in this repo.
- Never add GitHub remotes or external integrations; everything stays local.
