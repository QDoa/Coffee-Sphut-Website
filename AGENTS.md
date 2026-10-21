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
pnpm dev          # Start dev server on http://localhost:3000
pnpm build        # Create optimized production build (.next/)
pnpm start        # Run production server (requires build first)
pnpm lint         # ESLint (eslint.config.mjs)
pnpm exec tsc --noEmit --incremental false  # Type-check without updating build metadata
```

**Note:** No test runner configured. If adding tests, use `.test.ts` / `.test.tsx` and configure Jest or Vitest.

---

## Known Issues & Setup Quirks

### Lint (`brace-expansion` override)

`pnpm lint` used to crash with `TypeError: expand is not a function`. The cause was **not** an eslint version mismatch: the pnpm override `brace-expansion@<1.1.13: '>=1.1.13'` was unbounded, so it forced `brace-expansion@5.0.6` onto `minimatch@3.1.5` (which needs the 1.x callable-export shape). It is now pinned to `'>=1.1.13 <2'`, so `minimatch@3` resolves `brace-expansion@1.1.21` while `minimatch@10` keeps `5.0.6`.

**When adding pnpm overrides, always bound the upper end** (`>=x <nextMajor`). An unbounded `>=x` silently forces a major-version bump onto transitive deps and breaks them at runtime.

Full-repository lint has pre-existing findings in account/privacy pages, admin code, and migration scripts. These are unrelated to lint working. Check the current output rather than assuming an old list of failing files still applies. Run targeted ESLint for changed files, for example `pnpm exec eslint app/layout.tsx app/page.tsx`, and distinguish new findings from existing ones.

### Fonts during builds
`next/font/google` fetches fonts during compilation and serves the bundled files locally at runtime. Production builds need access to Google Fonts when those resources are not cached. If a build fails fetching fonts, check network access before changing the font setup.

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

### Typography
- Use **Fraunces** for public-facing display headings via `font-serif`.
- Use **Geist** for body text, navigation, buttons, inputs, and other controls via `font-sans`. FAQ questions remain interface controls even though the accordion renders heading elements.
- Fonts are configured in `app/layout.tsx` with `next/font/google`; Tailwind font tokens live in `app/globals.css`. The body explicitly applies `font-sans`.
- Fraunces includes normal and italic styles and the optical-size (`opsz`) axis. Preserve real italics for short heading accents.
- Keep font choices centralized in these tokens. Avoid per-component font imports and global heading overrides that unintentionally restyle the admin interface.

### UI Direction & Interactions
- Keep the public website coffee-focused: concrete café discovery, coffee stories, loyalty, and community benefits. Separate café-owner messaging from consumer benefits.
- Prefer clear hierarchy and varied editorial layouts over repeating centered headings and identical icon cards.
- Use the existing Radix-backed tabs, accordion, and sheet components for keyboard support, focus handling, and accessible state.
- Use `Button asChild` or `buttonVariants` to style links; avoid nesting buttons inside anchors.
- Keep the loyalty stamp interaction clearly labeled as a demo. It must not imply that real stamps or rewards were issued.
- Preserve event registration, calendar, app download, and partner signup links when changing layouts.

### Motion & Accessibility
- Respect `prefers-reduced-motion` in both CSS and JavaScript, including map camera movement.
- Reuse `SectionReveal` for subtle entrance animations. Content must remain readable before hydration and when JavaScript or animation is unavailable.
- Prefer motion that explains a state change, such as stamp feedback, tab transitions, and selected café states. Avoid unnecessary autoplay and continuously moving decorative content.
- Keep keyboard focus visible. Mobile menu navigation should focus the destination section rather than restore focus to the trigger and undo anchor scrolling.
- Keep café search available in both mobile list and map views; expose loading, selection, and empty states accessibly.

### Responsive Layout Checks
- Verify mobile, intermediate, and desktop widths after layout or font changes. Recent regression checks used **390px, 897px, and 1280px**; also check 320px when changing header controls.
- Event cards stack below `lg`. Desktop columns use `minmax(0, ...)`; square poster containers use `min-w-0` and `self-start` so their aspect ratio cannot force the details outside the card.
- Confirm the complete event description and registration link stay inside the card and can be reached by keyboard. Do not use fixed heights or clipping to conceal overflowing content.
- `TabsList` has a shared conditional horizontal height. For taller public-site tabs, override it with `group-data-[orientation=horizontal]/tabs:h-auto`, and use `h-auto min-h-11` on triggers. Plain `h-auto` on the list does not override the conditional rule.
- Confirm tab backgrounds contain their buttons and the page has no horizontal overflow. Recheck the event card and FAQ tabs when changing typography.

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

**Last Updated:** 2026-10-21
