# Onboarding — Element Ops Monkeytype Fork

Read this first. ~10 minute read. Points you at the deeper docs.

## What this repo is

A fork of [monkeytypegame/monkeytype](https://github.com/monkeytypegame/monkeytype) (the typing test) customized for **applicant typing assessment** in the Element Ops recruiting pipeline. We host only the **frontend** at [typing.elementops.it.com](https://typing.elementops.it.com) on Railway. The backend (accounts, leaderboards, DB) is **not** deployed — applicant mode bypasses it entirely.

Upstream is untouched in spirit: we layer applicant features on top via a separate code path that activates only when a `?t=<token>` URL param is present. No token → normal Monkeytype.

## The 60-second mental model

```
Airtable (Recruitment table)
   │  on new record
   ▼
n8n: Generate URL ──► writes signed URL to "Typing Speed URL - Monkeytype" field
   │
   ▼
Fillout form's "Take Typing Test" button reads that URL
   │  applicant clicks
   ▼
This frontend (typing.elementops.it.com/?t=...)
   │  applicant takes 60s locked test
   ▼
n8n: Receive Result ──► HMAC verify + plausibility check + PATCH Airtable
   │
   ▼
Airtable record now has WPM, Accuracy, Submitted, SubmittedAt
```

**Trust model:** frontend is dumb. The token is opaque — frontend never validates it, just relays it back on submit. All trust lives in n8n (HMAC, expiry, dedupe).

## What we added to the fork

| Area | Files / location |
|---|---|
| Applicant-mode entry | `frontend/src/ts/applicant/boot.ts` — booted from index when `?t=` is present |
| Token decode (name only, no verify) | `frontend/src/ts/applicant/token.ts` |
| Mode state (intro / practice / real) | `frontend/src/ts/applicant/mode.ts` |
| Config lock (forces 60s English mode, hides settings) | `frontend/src/ts/applicant/config-lock.ts` + `ui-lock.css` |
| Submit pipeline → n8n webhook | `frontend/src/ts/applicant/reporter.ts` |
| Intro / submitting / submitted overlays | `frontend/src/ts/applicant/result-states.tsx` |
| Practice toolbar (Retry / Exit) | `frontend/src/ts/applicant/toolbar.ts` |
| Firebase / merch / server-sync gating | grep for `isApplicantMode()` |

Everything outside `frontend/src/ts/applicant/` is either upstream code or thin gates calling `isApplicantMode()`.

## External systems (where the magic actually happens)

| System | Purpose | Where to find it |
|---|---|---|
| **Airtable** — `Element Ops - Recruiting` base | Source of truth for applicants. Triggers n8n on record create. | base `appa28zyvdbF534Xl`, table `tblsDdMFkapAv604l` |
| **n8n** — `n8n.elementops.it.com` | All glue. 4 workflows: Generate URL, Receive Result, Backfill URLs, Error Notification. | IDs in `docs/applicant-integration/internal-runbook.md` |
| **Fillout** — application form | Renders the "Take Typing Test" button using the URL Airtable holds. Maintained by a separate dev. | See `docs/applicant-integration/fillout-developer-handoff.md` |
| **Railway** — deployment | Hosts this static frontend. Auto-deploys on push to `master`. | `typing.elementops.it.com` |
| **Slack** — `#automation-alerts` | All errors + suspicious submissions land here. | channel `C07PQUFD943` |

## Local dev

Standard monkeytype setup. Requires Node ≥24 and `pnpm`.

```bash
pnpm install
pnpm dev-fe          # frontend only — what we deploy
```

**No `.env` needed for applicant mode.** There's no `.env.example` to copy and no client-side secrets to configure. The HMAC secret that signs/verifies tokens lives only in n8n's credential vault — the frontend never touches it. Upstream monkeytype has its own frontend env vars (Firebase, ads, etc.) but applicant mode short-circuits all of them, so a fresh clone runs end-to-end without any local config.

**Test applicant mode locally:** append a fake token to the URL. The token's payload is decoded for the name only; signature is never verified client-side, so any base64-ish thing works for UI testing:

```
http://localhost:3000/?t=eyJyIjoidGVzdCIsImUiOjk5OTk5OTk5OTksIm4iOiJ4IiwibmFtZSI6IkpvaG4gRG9lIn0.fakesig
```

Real submission requires a token issued by `Applicant Typing - Generate URL` (n8n) — without it, the HMAC verify on the receive side will 401.

## Deployment

`git push origin master` → Railway picks up, builds `pnpm build-fe`, serves the static bundle at `typing.elementops.it.com`. No manual step.

## Upstream sync

Quarterly cadence. The upstream codebase moves fast but our touchpoints are small and stable. See `docs/applicant-integration/upstream-merge-runbook.md` for the exact merge procedure (it's mostly: merge, resolve conflicts in our applicant files, smoke-test).

## Where to dig deeper

All operational/architectural docs live in `docs/applicant-integration/`:

| File | When to read |
|---|---|
| `internal-runbook.md` | **Start here for day-to-day ops.** Troubleshooting, retakes, resource IDs. |
| `recruitment-process.md` | Context on the broader Element Ops recruiting pipeline this slots into. |
| `security-notes.md` | Token format, HMAC scheme, threat model. |
| `fillout-developer-handoff.md` | What the Fillout dev needs to do on their end. |
| `airtable-script-v2.md` | The Airtable automation script that POSTs to n8n. |
| `upstream-merge-runbook.md` | How to merge upstream monkeytype changes without breaking applicant mode. |
| `PROGRESS.md` | Design decisions log + resolved/open questions. |

Upstream monkeytype's own docs (build, contributing, themes, languages) live in `docs/` and `README.md`.

## When in doubt

- Frontend not working → browser console at `typing.elementops.it.com/?t=fake.sig`, then Railway logs.
- Submission failing → n8n executions for `Receive Result` (workflow `UhFDxGqLmR9HAAh3`).
- URL not generating → n8n executions for `Generate URL` (workflow `wjyTQjBQxkTbKi9B`).
- Anything else → `#automation-alerts` Slack or ping Marc.
