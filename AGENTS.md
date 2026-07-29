# AGENTS.md - Development Guidelines for Coffee Sphut

> This guide is for agentic coding agents. It contains build instructions, test commands, code style guidelines, and conventions used in this repository.

## Project Overview

**Coffee Sphut** is a Next.js 16 + React 19 + TypeScript + Tailwind CSS web application for discovering coffee, finding stores, and managing favorites. Deployed to Vercel with Supabase backend.

**Tech Stack:**
- Next.js 16.2.6 (App Router)
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui + Lucide icons
- Supabase for backend

---

## Build & Development Commands

```bash
npm run dev       # Start dev server on http://localhost:3000
npm run build     # Create optimized production build (.next/)
npm start         # Run production server (requires build first)
npm run lint      # ESLint (eslint.config.mjs)
```

**Note:** No test runner configured. If adding tests, use `.test.ts` / `.test.tsx` and configure Jest or Vitest.

---

## Known Issues & Setup Quirks

### ESLint Version Mismatch
Currently there's a dependency conflict: `eslint-config-next@16.1.1` expects `eslint@^16.x` but the project has `eslint@9.39.4`. This causes `npm run lint` to fail with `"TypeError: expand is not a function"`. The pnpm-workspace.yaml has overrides to prevent this, but using `npm` directly bypasses them.

**Workaround:** Use `pnpm` instead of `npm` for package management (pnpm-lock.yaml is present and locked).

### Package Manager
The project has both `npm` and `pnpm` lock files. Use **`pnpm`** for consistency with the workspace overrides. Running `npm install` after `pnpm` may reintroduce version conflicts.

### Environment Variables
- Required at runtime: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (stored in `.env.local`)
- Development server respects `.env.local` automatically
- Vercel deployment uses these secrets in project settings

---

## Code Style & Conventions

### Imports & Paths
- Use path alias `@/*` (maps to root)
- Order: React → Next.js → 3rd-party → local
- Example: `import { cn } from "@/lib/utils"`

### TypeScript
- Strict mode enabled; always type function params and returns
- Use interfaces for component props
- Use React's built-in types: `React.ComponentProps<"button">`, `React.ReactNode`

### Components
- **Client components:** `"use client"` directive at top for interactive components
- **Server components:** In `app/` by default; fetch data directly
- Use `cn()` from `@/lib/utils` to merge Tailwind classes safely

### Styling
- Tailwind utility classes only (no CSS files)
- Theme colors via CSS variables in `app/globals.css`
- shadcn/ui components with CVA for variants
- Mobile-first responsive: `sm:`, `md:`, `lg:` prefixes

### Naming
- **Components:** PascalCase
- **Functions/variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Files:** lowercase with hyphens; PascalCase for component files

### Image Handling
- Always use Next.js `Image` component with explicit `width` and `height`
- Add `priority` for above-the-fold images
- Remote images must match patterns in `next.config.ts` (Vercel Blob storage configured)

---

**Last Updated:** 2026-07-28
