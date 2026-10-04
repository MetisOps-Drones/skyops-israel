# E2E tests (Playwright)

Run against a real dev server (`npm run dev`) hitting the real Supabase
project — there's no local/staging DB yet. Every test needs dedicated
**test accounts**, never real pilot/org data, set via env vars in `.env.local`
(already gitignored):

| Var | Used by | Notes |
| --- | --- | --- |
| `E2E_HOBBY_EMAIL` / `E2E_HOBBY_PASSWORD` | auth, flight-request specs | A `pilot_hobby` account with no org. |
| `E2E_DISPATCHER_EMAIL` / `E2E_DISPATCHER_PASSWORD` | notam-publish spec | A `dispatcher_admin` account. |

A spec whose required vars aren't set calls `test.skip()` with a message
naming the missing var, instead of failing — so `npm run test:e2e` is always
safe to run, it just covers less until the vars are added.

## Run

```bash
npm run test:e2e
```

Add `--ui` for the interactive runner, or `--debug` to step through.
