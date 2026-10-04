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

### Lint (`brace-expansion` override)

`pnpm lint` used to crash with `TypeError: expand is not a function`. The cause was **not** an eslint version mismatch: the pnpm override `brace-expansion@<1.1.13: '>=1.1.13'` was unbounded, so it forced `brace-expansion@5.0.6` onto `minimatch@3.1.5` (which needs the 1.x callable-export shape). It is now pinned to `'>=1.1.13 <2'`, so `minimatch@3` resolves `brace-expansion@1.1.21` while `minimatch@10` keeps `5.0.6`.

**When adding pnpm overrides, always bound the upper end** (`>=x <nextMajor`). An unbounded `>=x` silently forces a major-version bump onto transitive deps and breaks them at runtime.

`pnpm lint` still exits non-zero on pre-existing errors in `app/page.tsx`, `app/privacy/page.tsx`, `app/reset-password/page.tsx`, `app/vendor_reward/VendorRewardClient.tsx` (unescaped entities) and `components/store-finder.tsx` (`react-hooks/set-state-in-effect`). These are unrelated to lint working.

### Package Manager
Use **`pnpm`**. The repo has both `npm` and `pnpm` lock files; `pnpm-lock.yaml` is the authoritative one and is what encodes the `overrides` above. Running `npm install` will not honour `pnpm-workspace.yaml` and can reintroduce conflicts.

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
