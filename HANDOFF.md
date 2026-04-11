# Handoff

## Current state

Production is live at:

- `https://lusolearn.vercel.app`

Latest pushed commit:

- `16639dd` on `main`

Current local-only change:

- [`.env.local`](/C:/Users/bonap/Documents/Projects/Lusolearn%202/.env.local)
  - `VITE_GOOGLE_CLOUD_API_KEY` was renamed to `SPEECH_API_KEY`
  - this was intentionally not committed

## What was completed

### Product and UX work

- Mobile navigation was expanded and cleaned up
- Dashboard word list got search, filters, sorting, and removed the hard 50-card cap
- Study flow now supports richer SRS grading instead of a binary review result
- Real review history, streak, and related stats were wired into app state
- Frontend delivery was improved:
  - Tailwind CDN removed
  - local CSS pipeline enabled
  - major screens lazy-loaded
  - main bundle reduced significantly

### Authentication

- Google login is working again
- The blocking issue turned out to be the Supabase project being paused
- Additional auth diagnostics were added:
  - clearer OAuth error handling on the login screen
  - warning when fallback Supabase config is in use
  - better Google OAuth redirect handling

Relevant files:

- [components/Auth.tsx](/C:/Users/bonap/Documents/Projects/Lusolearn%202/components/Auth.tsx)
- [services/repositories/authRepository.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/services/repositories/authRepository.ts)
- [config/env.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/config/env.ts)

### Speech key migration

Speech recognition was moved behind a server endpoint so the Google Speech key is no longer exposed through client env configuration.

Relevant files:

- [api/speech.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/api/speech.ts)
- [services/speechRecognition.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/services/speechRecognition.ts)
- [config/env.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/config/env.ts)

What changed:

- client no longer calls `speech.googleapis.com` directly
- client no longer reads a speech key from `import.meta.env`
- server endpoint reads:
  - `SPEECH_API_KEY`
  - or `GOOGLE_CLOUD_API_KEY`
  - and only as a temporary fallback `VITE_GOOGLE_CLOUD_API_KEY`

Verification already done:

- local `npm.cmd run build` passed
- production redeploy completed successfully
- Vercel env now uses `SPEECH_API_KEY`
- `VITE_GOOGLE_CLOUD_API_KEY` was removed from Vercel

## Current Vercel env shape

Present on Vercel:

- `SPEECH_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `ELEVEN_LABS_API_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

Notes:

- `SPEECH_API_KEY` exists in `Production`, `Preview`, and `Development`
- old `REACT_APP_SUPABASE_*` variables still exist as duplicates and can be removed later

## Secret handling conclusions

- `.env.local` was not found committed in git history
- no clear evidence of secrets in Vercel runtime logs was found during prior checks
- the old browser Speech key had been exposed previously through the client bundle
- that risk was mitigated by:
  - rotating the key
  - moving speech requests server-side
  - removing `VITE_GOOGLE_CLOUD_API_KEY` from Vercel

## What still needs to be done

### Short term

1. Verify speech recognition end-to-end on production.
2. Verify Gemini-powered flows still work after the env cleanup.
3. Remove duplicate Vercel vars if desired:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

### Nice next engineering steps

1. Add `lint` and `typecheck` scripts if still missing.
2. Add basic smoke tests for:
   - login
   - card creation
   - study session
   - story generation
3. Consider another rotation of the Speech key after confirming the server-side flow is stable.

## Useful commands

### Check git state

```powershell
git status --short
```

### Build locally

```powershell
npm.cmd run build
```

### Redeploy production

```powershell
npx.cmd vercel@50.13.2 --prod --yes
```

### Check Vercel env vars

```powershell
npx.cmd vercel@50.13.2 env ls
```

## Notes for the next session

- Do not store real secrets in this file.
- `.env.local` is intentionally local-only and currently differs from git.
- If speech fails after future env changes, first check that `SPEECH_API_KEY` still exists on Vercel.
