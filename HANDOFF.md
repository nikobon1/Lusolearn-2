# Handoff

## Current focus

Fix production authentication and secret handling for `https://lusolearn.vercel.app`.

## What we found

1. Google OAuth itself is not the primary failure right now.
2. Production is redirecting to:
   - `https://qhyvcrwucjxsgylzmsdu.supabase.co/auth/v1/authorize`
3. That Supabase host currently fails with:
   - `DNS_PROBE_FINISHED_NXDOMAIN`
4. Therefore the production app is using an invalid Supabase project URL.

## Important conclusions

- The issue is currently a bad Supabase config, not a Google provider config.
- `qhyvcrwucjxsgylzmsdu.supabase.co` is currently baked into the live client bundle.
- The warning about fallback disappeared earlier because Vercel env vars started being read, but they appear to contain the wrong Supabase URL/key pair.
- `VITE_SUPABASE_URL` and likely `VITE_SUPABASE_ANON_KEY` on Vercel need to be replaced with the real values from the correct Supabase project.

## Code changes already made locally

These files currently have local modifications and were used in the latest Vercel redeploy, but are not committed/pushed yet:

- [components/Auth.tsx](/C:/Users/bonap/Documents/Projects/Lusolearn%202/components/Auth.tsx)
- [config/env.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/config/env.ts)
- [services/repositories/authRepository.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/services/repositories/authRepository.ts)

### Purpose of those changes

- Show clearer OAuth errors on the login page
- Warn when fallback Supabase config is in use
- Improve Google OAuth redirect handling
- Fix client env reading for Vite via `import.meta.env`

## Vercel state

The following env vars exist on Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLOUD_API_KEY`
- `GEMINI_API_KEY`
- `ELEVEN_LABS_API_KEY`

Latest production alias:

- `https://lusolearn.vercel.app`

Recent production deployment was completed successfully, but it still points to the invalid Supabase host because the configured values appear to be wrong.

## Secret handling findings

- `.env.local` was not found in git history as a committed file.
- No clear evidence of secrets in git history or Vercel runtime logs was found.
- However, a Google-style key (`AIza...`) was found in the built client bundle because `VITE_GOOGLE_CLOUD_API_KEY` is used client-side in:
  - [services/speechRecognition.ts](/C:/Users/bonap/Documents/Projects/Lusolearn%202/services/speechRecognition.ts)
- This means the Speech key should be treated as exposed and was already rotated.

## Required next steps

1. In the correct Supabase project dashboard, open:
   - `Project Settings -> API`
2. Copy the real values for:
   - `Project URL`
   - `anon public key`
3. In Vercel, replace:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Make sure both values come from the same Supabase project.
5. Remove old duplicate vars if desired after verification:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
6. Redeploy production.
7. Verify:
   - login page no longer redirects to `qhyvcrwucjxsgylzmsdu.supabase.co`
   - Google login reaches the correct Supabase project
   - if OAuth still fails after that, then check Supabase Google provider + redirect URLs

## After auth is fixed

Next security task:

1. Move speech recognition off the client and onto a server endpoint.
2. Remove public usage of `VITE_GOOGLE_CLOUD_API_KEY`.
3. Rotate any Google key again if necessary after migration.

## Useful verification snippets

### Check current working tree

```powershell
git status --short
```

### Build locally

```powershell
npm.cmd run build
```

### Redeploy to production

```powershell
npx.cmd vercel@50.13.2 --prod --yes
```

### Check Vercel env vars

```powershell
npx.cmd vercel@50.13.2 env ls
```

## Notes for the next session

- Do not store real secrets in this file.
- Do not trust the current Supabase values on Vercel until they are manually verified against Supabase Dashboard.
- If production still redirects to `qhyvcrwucjxsgylzmsdu.supabase.co`, the wrong URL is still being deployed.
