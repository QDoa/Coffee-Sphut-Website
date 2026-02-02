# AGENTS.md - Development Guidelines for Coffee Sphut

> This guide is for agentic coding agents. It contains build instructions, test commands, code style guidelines, and conventions used in this repository.

## Project Overview

**Coffee Sphut** is a Next.js 16 + React 19 + TypeScript + Tailwind CSS web application showcasing a coffee discovery platform with features for discovering content, finding coffee stores, and managing favorites.

**Tech Stack:**
- Next.js 16.1.1 (App Router)
- React 19.2.3 (Client Components)
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui components
- Lucide React icons
- ESLint 9 (with Next.js + TypeScript rules)

---

## Build & Development Commands

### Development
```bash
npm run dev
# Starts Next.js development server on http://localhost:3000
```

### Build
```bash
npm run build
# Creates optimized production build in .next/
```

### Start Production Server
```bash
npm start
# Runs production server (requires build first)
```

### Linting
```bash
npm run lint
# Runs ESLint on the entire codebase using eslint.config.mjs
```

### Running a Single Test
**Note:** This project currently has no test setup (Jest/Vitest not configured). If tests need to be added, create test files with `.test.ts` or `.test.tsx` extension and set up a test runner.

---

## Code Style Guidelines

### 1. Imports & Module Organization

- Use ESM imports with path aliases defined in `tsconfig.json`
- **Path aliases:** `@/*` maps to the root directory
  ```typescript
  import { Button } from "@/components/ui/button"
  import { cn } from "@/lib/utils"
  import Image from "next/image"
  ```
- Order imports: React → Next.js → 3rd-party → local aliases
- Group related imports with blank lines between groups
- Always use named imports over default imports when possible

### 2. File Organization

```
app/               # Next.js App Router pages and layouts
  page.tsx        # Root page
  layout.tsx      # Root layout
components/        # Reusable React components
  ui/             # shadcn/ui components
lib/              # Utilities and helpers
public/           # Static assets
```

### 3. TypeScript & Type Safety

- **Strict mode enabled:** All files use strict TypeScript checking
- Always define types explicitly for function parameters and return values
- Use interfaces for component props (avoid inline prop types)
- Use React's built-in types: `React.ComponentProps<"button">`, `React.ReactNode`, etc.

```typescript
interface JobPosting {
  title: string
  location: string
  type: string
  jobDescriptionLink: string
}
```

### 4. Component Conventions

**Client Components:**
- Use `"use client"` directive at the top for interactive components
- Keep components in `components/` directory
- Export component and variant exports (e.g., `buttonVariants`)

**Server/Page Components:**
- Components in `app/` are Server Components by default
- Use data fetching directly in server components

**Props Structure:**
```typescript
interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "outline" | "destructive"
  size?: "sm" | "default" | "lg"
  asChild?: boolean
}
```

### 5. Naming Conventions

- **Components:** PascalCase (`Button`, `Card`, `JobPosting`)
- **Functions & Variables:** camelCase (`setDownloadText`, `currentImageIndex`)
- **Constants:** UPPER_SNAKE_CASE (only for true constants)
- **CSS Classes:** Follow Tailwind utility naming
- **File names:** lowercase with hyphens for directories, PascalCase for components (`button.tsx`)

### 6. Styling with Tailwind CSS

- Use Tailwind utility classes for styling (no CSS files unless necessary)
- Use `cn()` utility from `@/lib/utils` to merge class names safely
  ```typescript
  className={cn("base-classes", conditionalClass && "conditional-class")}
  ```
- Define theme colors via CSS variables in `globals.css`
- Use shadcn/ui components with CVA (class-variance-authority) for variants
- Responsive design: mobile-first with `sm:`, `md:`, `lg:` prefixes

### 7. State Management

- Use React hooks: `useState`, `useEffect`, `useContext`
- Keep state close to where it's used
- Derive state from props when possible
- For complex states, consider context or external state management

```typescript
const [currentImageIndex, setCurrentImageIndex] = useState(0)

useEffect(() => {
  const timer = setInterval(() => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length)
  }, 5000)
  return () => clearInterval(timer)
}, [images.length])
```

### 8. Error Handling

- Wrap async operations in try-catch blocks
- Provide meaningful error messages
- Log errors to console in development (not in production)
- Don't throw errors silently; always handle or propagate explicitly

```typescript
try {
  // async operation
} catch (error) {
  console.error("Operation failed:", error)
  // Handle error gracefully
}
```

### 9. Formatting & Code Quality

- **ESLint:** Automatically enforces Next.js + TypeScript rules
- **Indentation:** 2 spaces
- **Semicolons:** Use them consistently
- **Quotes:** Double quotes for strings (enforced by config)
- **Line length:** Keep lines readable (80-100 chars preferred, not strict)

### 10. React Best Practices

- Use functional components only
- Keep components focused and single-responsibility
- Memoize expensive computations with `useMemo` if needed
- Use `key` prop correctly in lists (never use array index if list can change)
- Avoid inline object/array creation in dependencies

---

## Project-Specific Standards

### Image Handling
- Use Next.js `Image` component from `next/image`
- Always set `width` and `height` props
- Use `priority` for above-the-fold images

```typescript
<Image
  src="/images/home.png"
  alt="Descriptive alt text"
  width={300}
  height={650}
  priority
/>
```

### Accessibility
- Always provide `aria-label` for icon buttons
- Use semantic HTML elements where appropriate
- Ensure color contrast meets WCAG standards
- Use descriptive link/button text

---

## Linting & Quality Assurance

- Run `npm run lint` before committing
- Fix all ESLint errors; warnings should be addressed if possible
- The project uses eslint.config.mjs with:
  - Next.js core web vitals
  - TypeScript support
  - Configured ignores (`.next/`, `out/`, `build/`, `next-env.d.ts`)

---

## Git Conventions

- Commit messages: clear, concise descriptions of changes
- Branch naming: descriptive lowercase with hyphens (`feature/add-jobs-section`)
- Keep commits atomic and logical

---

## Adding Dependencies

Use `npm install` for new packages:
```bash
npm install package-name
npm install --save-dev dev-package
```

Keep dependencies minimal and use npm's built-in packages where possible.

---

## Useful Resources

- [Next.js Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Last Updated:** 2025-02-01
