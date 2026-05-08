# Applicant Typing Test — Reference Doc

**Project:** Self-hosted Monkeytype fork integrated with Fillout (form) + Airtable (data) + n8n (glue) for applicant typing assessments.

**Status:** Design phase complete; plan approved 2026-05-09.
**Last updated:** 2026-05-09

## Live status tracker (single source of truth)

**👉 [Element Ops Recruitment — Typing Test PM Tracker](https://docs.google.com/spreadsheets/d/1Xa8stuTLOPMD1VqNezaUqI4yvhmMcG-nqbGIsJjlq1E/edit)**

The Google Sheet is where all phase / step / status updates live. This file is a static reference for architectural decisions and pointers; do not duplicate task status here.

## Other reference files

- **Approved implementation plan:** `C:\Users\Marc\.claude\plans\greedy-wandering-parrot.md` (local — out-of-repo)
- **Recruitment process snapshot:** `docs/applicant-integration/recruitment-process.md` (gitignored — source: CalScore sheet, Pipeline Statuses tab)

---

## Architecture summary

```
Airtable (Recruitment table, ElementOps - Recruiting base)
    ↓ on record creation
n8n: generate-url → writes monkeytype_url field
    ↓ (existing form-email automation untouched)
Existing Application Form email automation → other dev pulls monkeytype_url for Fillout prefill
    ↓ applicant clicks Fillout link
Fillout form (with embedded typing test button)
    ↓ applicant clicks test button
typing.<yours>.com (Railway-hosted fork) reads ?t=, runs locked 60s test
    ↓ on finish()
n8n: receive-result → HMAC verify, plausibility checks, Airtable PATCH
    ↓
Airtable record has WPM, accuracy, etc.
```

**Key principle:** Frontend is the dumbest layer. Token is opaque to the frontend, never decoded client-side. All trust lives in n8n.

---

## Resolved design questions

| # | Question | Resolution | Reasoning |
|---|---|---|---|
| Q1 | Existing form-email automation: extend or replace? | **Neither — leave it alone.** | We just write `monkeytype_url`; other dev pulls it for Fillout prefill. Zero coupling. Lowest-risk path. |
| Q2 | Should `Candidate - Applicant Form Complete` wait for both form AND test? | **No — keep form-only trigger (Option B).** | Test is supplementary data, not a gate. CalScore continues running on form data alone. WPM as a scoring input is a separate v2 decision. |
| Q3 | Field naming: `monkeytype URL` (space) or `monkeytype_url` (snake_case)? | **`monkeytype_url`.** | Avoids formula-quoting issues in Airtable. |

## Other-dev handoff (Phase 5)

The other dev maintains the Fillout form. Their integration is minimal:

> The Recruitment table now has a column `monkeytype_url`. When configuring the Fillout form's "Take Typing Test" button, pull the URL value from this column instead of any hardcoded URL. The URL is unique per applicant and pre-signed — do not modify it.
>
> Additionally:
> 1. Configure Fillout's Airtable integration to **"Update existing record"** matched on `record_id`, NOT "Create new record" — otherwise form submission and test submission write to two separate rows.
> 2. Add a hidden `record_id` field to the form, prefilled from URL param.
> 3. Render the typing test link as a styled button (HMAC tokens are ugly inline text).

## Open questions (post-launch / future work)

1. **Future: WPM in Candidate CalScore rubric?** — Should typing test results feed into Candidate CalScore as a scored input, or stay separate? Defer until first 10 real submissions land; tune from real data.
2. **Field naming conventions audit** — Pull `Granular Field Plan` tab from CalScore sheet at implementation time to confirm naming aligns with existing Recruitment-table fields.

---

## Notes

- HMAC secret rotation invalidates all outstanding tokens.
- Upstream Monkeytype sync cadence: quarterly. Patches touch stable surfaces; ~15 min/quarter.
- Cost estimate: Railway ~$1–2/month (static site only — n8n already self-hosted at `n8n.elementops.it.com`).
- Secrets policy: never inline in `.mcp.json` or any committed file. Use `.env.local` or n8n credential store.
- Pre-launch checklist gate: rotate the n8n API key (it was visible in design conversation context). Tracker Phase 6 Step 6.
