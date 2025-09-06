# TypeScript testing and basic error capture

This document summarizes a minimal, low-friction setup to catch errors without white screens, and to surface type and lint issues across the codebase.

It focuses on:

- Error capture in React (render-time and async).
- TypeScript strictness for early detection of shape/type mistakes.
- ESLint rules that warn on risky patterns common in TS + React.

File references in this repo:

- `main.tsx` – app boot, `RootErrorBoundary`, and global error handlers.
- `tsconfig.json` – TypeScript compiler options (strictness).
- `.eslintrc.cjs` – ESLint config for TypeScript + React.
- `package.json` – scripts for type check and lint.

---

## Error capture in React

Render-time errors (like accessing a missing property in JSX) should not white-screen the app.

- `RootErrorBoundary` wraps the app to:
  - Show a friendly fallback UI when a render error occurs.
  - Log both the error and the component stack (in development) so you see exactly where it came from.
  - Remains silent in production unless you wire telemetry.

- Global listeners capture non-render errors that boundaries do not:
  - `window.onerror` – uncaught runtime errors.
  - `window.onunhandledrejection` – unhandled Promise rejections (async).

Where we use these:

- `main.tsx` contains both the `RootErrorBoundary` and the global error listeners. In development, they log to the browser Console; in production, they stay quiet by default (you can add telemetry later).

### What gets logged

- Error object – includes name/message/stack.
- Component stack – which components and lines were involved (React provides this to error boundaries).
- Async/global errors – message, source, and reason for rejected promises.

---

## TypeScript strictness

These compiler flags catch common mistakes early (for example, treating an array as an object or accessing possibly-undefined properties).

Enabled flags in `tsconfig.json`:

- `strict` – base strictness mode.
- `noImplicitAny` – require explicit types where inference fails.
- `useUnknownInCatchVariables` – safer error typing in catch blocks.
- `noUncheckedIndexedAccess` – indexing returns `T | undefined` (forces safer access).
- `exactOptionalPropertyTypes` – distinguishes `undefined` vs missing.
- `noFallthroughCasesInSwitch` – prevents accidental fallthrough.
- `noImplicitOverride` – requires `override` keyword on subclass overrides.
- `forceConsistentCasingInFileNames` – avoids case-sensitivity bugs.
- `isolatedModules` – improves compatibility with bundlers.

How to run a full project type check:

- `npm run typecheck` (uses `tsc --noEmit`).

---

## ESLint rules for risky patterns

ESLint complements TypeScript by flagging unsafe runtime patterns that TS might not catch without type-aware analysis.

Configured in `.eslintrc.cjs`:

- Core TypeScript safety:
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-call`
  - `@typescript-eslint/no-floating-promises`
  - `@typescript-eslint/consistent-type-imports`
  - `@typescript-eslint/no-non-null-assertion` (warn)

- React:
  - `plugin:react/recommended`
  - `plugin:react-hooks/recommended`
  - `react/react-in-jsx-scope` disabled (not needed in modern React)
  - `react/prop-types` disabled (using TypeScript instead)

How to run ESLint:

- `npm run lint` – report issues.
- `npm run lint:fix` – auto-fix where possible.

---

## Debugging workflow tips

- Console:
  - Use it during development. The boundary and handlers group logs to keep them readable.
  - Look for `[floot] RootErrorBoundary caught` and the component stack.

- React DevTools:
  - Inspect component tree, props, and state while reproducing an issue.

- Source maps:
  - Provided by Vite; browser DevTools show the original TS/TSX lines.

---

## Optional: what is Sentry?

- What: A hosted error monitoring service for client and server apps.
- Why: Captures errors with stack traces and context (user/session, breadcrumbs), aggregates them by frequency, and alerts you.
- Cost: Has a free tier (limited monthly events and retention). Paid plans scale by error volume and features.
- Setup (basic):
  - Create an account to get a DSN (project key).
  - Install the React SDK (e.g., `@sentry/react`).
  - Initialize it once at startup, then call `Sentry.captureException(error, { extra: { componentStack } })` in the error boundary.
  - You can keep dev Console logs and only send to Sentry in production.

This is entirely optional. The current setup already logs everything needed in development without any external dependency.

---

## Quick reference

- Error boundary and global handlers: `main.tsx`.
- TS strictness: `tsconfig.json`.
- Lint rules: `.eslintrc.cjs`.
- Scripts: `npm run typecheck`, `npm run lint`, `npm run lint:fix`.

With these in place, rendering errors display a friendly fallback and detailed logs, while static checks catch most shape/type issues before they hit the browser.

---

## Common strict-mode errors and how to fix them

This project enables stricter TypeScript options (see `tsconfig.json`). Below are issues you may see and the minimal, practical fixes to apply.

### 1) exactOptionalPropertyTypes and undefined

When `exactOptionalPropertyTypes` is on, an optional property like `error?: Error` means:

- If the property exists, it must be an `Error` (not `undefined`).
- If you want to represent “not set,” omit the property instead of setting it to `undefined`.

Example reference: `main.tsx`, `RootErrorBoundary` state

- Problem: Initializing state with `{ hasError: false, error: undefined, info: undefined }` triggers an error because `error` and `info` are present but set to `undefined`.
- Minimal fix: Initialize only `{ hasError: false }` and omit the optional properties. If you later need to include them explicitly as `undefined`, widen the types to `error?: Error | undefined` and `info?: { componentStack?: string } | undefined`.

### 2) noImplicitOverride on class methods

`noImplicitOverride` requires the `override` keyword for methods that override base class members.

Example reference: `main.tsx`, `RootErrorBoundary`

- Problem: Missing `override` on `componentDidCatch` and `render`.
- Minimal fix: Prefix these with `override` (e.g., `override componentDidCatch(...)`, `override render()`).

### 3) Optional object properties when setting React state

With `exactOptionalPropertyTypes`, avoid writing optional keys with `undefined` into state objects.

Example reference: `pages/generator.tsx`, `setImportDetails(...)`

- Problem: Passing an object like `{ schema, version, colors, title, warnings }` when some entries are `undefined`.
- Minimal fix: Build the object conditionally and include only keys that have values:
  - Start with `{}` and add `schema` only if defined; repeat for other keys. Then call `setImportDetails(details)`.

### 4) Passing `number | undefined` where `number` is required

`resolveTintYFromIndex(...)` returns `number | undefined`. Passing that directly to a function requiring `number` causes an error.

Example reference: `pages/generator.tsx`, usage of `resolveTintYFromIndex`

- Minimal fix: Guard or default:
  - `const y = resolveTintYFromIndex(...); if (y == null) return;` or use a sensible fallback value via `??`.

### 5) `setValues` with a too-generic object shape

Form helpers like `manualForm.setValues(...)` expect the exact form value shape. A `Record<string, string>` is too generic.

Example reference: `pages/generator.tsx`, loading saved manual colors

- Problem: `nextValues` typed as `Record<string, string>` is missing required form keys.
- Minimal fix options:
  - Initialize `nextValues` as a clone of the typed form values (so it has all required keys), then assign conditionally.
  - Or cast when calling `setValues` (short-term): `manualForm.setValues(nextValues as any)`.

### 6) Ensuring required strings are never assigned `undefined`

State like `Palette` requires `hex: string`. Combining saved data may yield `undefined`.

Example reference: `pages/generator.tsx`, `setPalette` functional update

- Problem: Creating objects such that `hex` can be `undefined` violates the `Palette` type.
- Minimal fix: Use fallbacks:
  - `hex: newHex || prev.primary.hex` (repeat for each color family).

### 7) Why this surfaced “now”

These errors often become visible only after enabling strict flags (
`strict`, `exactOptionalPropertyTypes`, `noImplicitOverride`, etc.). They’re helpful guards that catch real edge cases before runtime.

---

## What “first render” means in React

- React calls your component function to compute JSX.
- All calculations like `useMemo` happen during that call.
- Only after React commits the UI do `useEffect` hooks run (e.g., reading `localStorage`).
- Therefore, any data shape your JSX relies on must already be correct during the initial render, or you must guard it.

