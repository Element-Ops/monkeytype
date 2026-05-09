# Upstream Merge Runbook

When you actually want to pull in changes from `monkeytypegame/monkeytype` (CVE patch, new feature, browser-compat fix). **You don't have to do this on a schedule** — only when there's a reason.

## Branch baseline

This fork was branched from upstream at:

```
38bf94b1f  added MCP config and progres   (2026-05-08)
```

Upstream remote should already be configured:
```
git remote -v
# upstream  https://github.com/monkeytypegame/monkeytype.git (fetch)
# upstream  https://github.com/monkeytypegame/monkeytype.git (push)
```

If not: `git remote add upstream https://github.com/monkeytypegame/monkeytype.git`

## Pre-flight

Before merging:

```bash
git status                    # clean working tree
git checkout master
git pull origin master        # fully up to date with our fork
git fetch upstream            # pull latest upstream refs
```

Look at what changed:

```bash
git log --oneline master..upstream/master | head -50
```

If nothing scary in the log (no major refactor of any patched file — see list below), proceed.

## The merge

```bash
git checkout -b sync/upstream-$(date +%Y-%m-%d)
git merge upstream/master
```

Git will either succeed cleanly OR flag conflicts.

### Files we patched (conflict-prone)

| File | What we did | If upstream changed it |
|---|---|---|
| `frontend/src/ts/index.ts` | Branch boot on `isApplicantMode()` | Re-apply applicant boot block |
| `frontend/src/ts/test/test-logic.ts` (line ~1174) | Insert applicant submission path before user check | Re-apply applicant `if` block + imports |
| `frontend/src/ts/controllers/route-controller.ts` | URL guard preserving `?t=` | Re-apply guard at top of `router()` |
| `frontend/src/ts/input/hotkeys/commandline.ts` | Gate openCommandline on `isApplicantMode()` | Re-apply early-return guard |
| `frontend/src/ts/firebase.ts` | `init()` early-return in applicant mode | Re-apply guard at top of `init()` |
| `frontend/src/ts/ready.ts` | Skip ServerConfiguration.sync + MerchBanner | Re-apply two `if (!isApplicantMode())` blocks |
| `frontend/src/ts/components/mount.tsx` | APPLICANT_MOUNTS allowlist | Re-apply allowlist filter |
| `.dockerignore` | Un-exclude firebase-config-live.ts | Re-apply un-exclude line |
| `.gitignore` | Un-exclude firebase-config-live.ts | Re-apply `!` line |

### Files we created (zero conflict risk — git auto-keeps them)

- `frontend/src/ts/applicant/*` (all files)
- `frontend/src/ts/constants/firebase-config-live.ts`
- `railway.json`
- `docs/applicant-integration/*`

### Resolving conflicts

For each conflicted file:

```bash
git diff <file>                       # see the conflict
# Edit file: keep upstream's structure, re-apply our specific lines
git add <file>
```

Use the table above as a checklist. After all conflicts:

```bash
git commit -m "merge: upstream sync $(date +%Y-%m-%d)"
```

## Verify the merge

Don't trust git — verify nothing critical broke.

```bash
# Type check
node node_modules/.pnpm/node_modules/.bin/tsc.cmd --noEmit -p frontend

# No new circular deps
node node_modules/.pnpm/node_modules/.bin/madge.cmd --circular --extensions ts,tsx frontend/src

# Build
RECAPTCHA_SITE_KEY=disabled BACKEND_URL=https://api.example.com VITE_N8N_RESULT_WEBHOOK_URL=https://n8n.elementops.it.com/webhook/applicant-typing-result \
  node node_modules/.pnpm/node_modules/.bin/vite.cmd build
# (run from frontend/ dir, or use the powershell equivalents on Windows)
```

If those pass, smoke test live:

1. `python -m http.server 4173 -d frontend/dist` (in another terminal)
2. Open `http://127.0.0.1:4173/?t=fake.signature`
3. Confirm: applicant-mode body class, intro overlay shows, "Take Practice" + "Take Actual Typing Test" buttons, no nav/footer/ads, no console errors except the harmless preload warning

## Ship it

```bash
git checkout master
git merge --ff-only sync/upstream-YYYY-MM-DD
git push origin master
git branch -d sync/upstream-YYYY-MM-DD

# Then redeploy Railway:
railway up --ci
```

Watch the Railway deploy logs. If it goes red, the most likely culprit is a new build-time env var upstream added — check `vite.config.ts` for new `throw new Error(...)` lines and add the missing env var to Railway.

## Roll back if shit breaks

```bash
git checkout master
git reset --hard <last-known-good-sha>
git push --force-with-lease origin master   # only if you've pushed bad master already
railway up --ci                              # redeploy old version
```

The `--force-with-lease` flag is safer than `--force` because it refuses if someone else pushed in between. **Don't use plain `--force`.**

## When you'd actually want to sync

- **CVE in a dep** (vite, solidjs, etc.) — check `npm audit` or GitHub Dependabot alerts on the fork
- **Browser breakage** — applicants reporting the typing test doesn't work in their browser
- **A specific upstream feature** — e.g., they ship a better keystroke timing model and you want it
- **Curiosity / housekeeping** — once a year is plenty for a low-traffic tool

Skip otherwise. Static frontend with no user-input attack surface aging gracefully.
