# Frontend — React + React Router 7

## Run

```bash
npm run dev
```

## Structure

```
app/
  root.tsx                — ClerkProvider, sidebar (notebooks list, auth), layout
  routes.ts               — Route definitions
  app.css                 — Tailwind + sidebar + TipTap editor styles
  lib/
    api.ts                — apiFetch() — authenticated fetch wrapper with Clerk token
  components/
    recording-button.tsx  — MediaRecorder: record/stop, timer, returns Blob
  routes/
    home.tsx              — Landing page, redirects to /notebooks when signed in
    notebooks.tsx         — Notebook list + create form
    notebook-notes.tsx    — Note list within a notebook + "New Recording" button
    new-note.tsx          — Recording page: record → upload → poll status → navigate to detail
    note-detail.tsx       — TipTap editor: load content_json, auto-save (1.5s debounce), title edit, delete
```

## Routes

```
/                    → home (redirect to /notebooks if signed in)
/notebooks           → notebook list
/notebooks/:id       → note list for a notebook
/notebooks/:id/new   → recording page
/notes/:id           → note detail/editor
```

## Key Decisions

- **SPA mode** (`ssr: false` in react-router.config.ts) — Clerk is client-only
- **Clerk `@clerk/react`** — `<Show when="signed-in/signed-out">`, `<SignInButton>`, `<SignUpButton>`, `<UserButton>`
- **Audio recording**: prefers OGG (Chrome/Firefox) or MP4 (Safari) — formats Gemini natively supports. WebM as fallback only
- **TipTap**: `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-placeholder`
- **API calls**: `apiFetch(path, token, options)` in `lib/api.ts` — gets token from `useAuth().getToken()`
- **Polling**: 500ms interval for note processing status, uses fresh `getToken()` each poll

## Conventions

- No `publishableKey` auto-detection — must pass via `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` prop
- Use `~/` path alias for imports (maps to `app/`)
- Tailwind 4 with `@theme` block for custom variables
