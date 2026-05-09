# Internal Runbook — Applicant Typing Test

For Marc + future Element Ops devs handling day-to-day operations of the typing assessment system.

## System overview (in 5 lines)

1. New record in Airtable Recruitment table → Airtable automation POSTs `{recordId, fullName}` to n8n
2. n8n `Applicant Typing - Generate URL` issues a signed URL → writes to `Typing Speed URL - Monkeytype`
3. Fillout form's "Take Typing Test" button pulls that URL → applicant clicks
4. Applicant takes 60s test on `https://typing.elementops.it.com/?t=...`
5. Frontend POSTs result → n8n `Applicant Typing - Receive Result` validates HMAC + plausibility → writes WPM/Accuracy/Submitted/SubmittedAt back to the same Airtable record

## Common operations

### "Applicant says the URL doesn't work"

Likely causes (most → least common):

| Symptom | What to do |
|---|---|
| Page shows "This typing test link has expired" | Token TTL is 30d. Re-issue: clear `Typing Speed URL - Monkeytype`, run **Applicant Typing - Backfill URLs** workflow, applicant uses the new URL |
| Page shows "This test has already been submitted" | They already submitted. Allow retake → see below |
| Page shows "Result rejected" | Plausibility check failed — check `automation-alerts` Slack for the specific reason |
| Page shows "Connection issue. Save your score..." | n8n was down briefly during their submit. Their score is on the page — manually transcribe to Airtable, then mark Submitted = true |
| Page is blank / errors out | Check Railway deployment status: `railway logs` or dashboard. Should be rare. |

### "I want to give an applicant a retake"

1. Open their Recruitment record in Airtable
2. **Uncheck** `Typing Speed Submitted - Monkeytype`
3. Tell them to re-open their original URL (it's still valid for the full 30-day window)

That's it. The submitted flag is the only thing blocking re-submission. The URL doesn't change.

> Note: there's no automated UI for this in v1. If we ever want self-serve retakes (e.g. recruiter clicks a button), see the archived Row 19/26/36 in the PM tracker — those covered an `allow_retake` field + workflow that we deferred.

### "I need to onboard an applicant manually (the auto-flow missed them)"

Two cases:

**Case A: applicant exists in Recruitment but URL field is empty**
- Run the **Applicant Typing - Backfill URLs** workflow once. It scans for `Status = 'Applicant - Needs Review' AND empty URL` and re-issues for all of them. Slack summary lands in `#automation-alerts`.

**Case B: applicant isn't in Recruitment yet**
- Create the record normally with their `Full Name`. The record-created automation fires, URL appears in ~3s.

If neither works, the n8n webhook may be down — check **n8n executions** for `Applicant Typing - Generate URL` (workflow id `wjyTQjBQxkTbKi9B`).

### "I want to test the system without affecting real applicants"

Create a record in Recruitment with `Full Name = 'TEST - DELETE ME (description)'`. Use it to verify the flow, then delete the record manually when done.

## Where to look when something breaks

| Symptom | First place to look |
|---|---|
| URL not appearing on a fresh record | n8n executions for `Applicant Typing - Generate URL` (workflow `wjyTQjBQxkTbKi9B`). Look at the latest execution's input/output. |
| Submission accepted but Airtable not updating | n8n executions for `Applicant Typing - Receive Result` (workflow `UhFDxGqLmR9HAAh3`). Check the `Update Airtable Record` step — it has `onError: continueRegularOutput` so failures don't 500 the response, but they show in the execution log. |
| Errors on `automation-alerts` Slack channel | The error workflow `lsssyK7KqnqVzeJe` posted them. Each message has the failed workflow + execution URL. |
| Frontend looks broken | Open browser console at `https://typing.elementops.it.com/?t=fake.signature`. Should have zero errors except the one harmless preload warning. |
| Cert error on the domain | Railway issues Let's Encrypt — it should auto-renew. If broken, check Railway dashboard → service → settings → custom domain. |

## Slack channels & contacts

- `#automation-alerts` (channel id `C07PQUFD943`) — all errors, suspicious 401/422 submissions, backfill summaries land here
- Tagged: `<@U07FK03BRC1>` (Marc) on actionable failures

## n8n resource IDs (when you need them in a hurry)

| Thing | ID |
|---|---|
| Generate URL workflow | `wjyTQjBQxkTbKi9B` |
| Receive Result workflow | `UhFDxGqLmR9HAAh3` |
| Backfill URLs workflow | `r4n3v52770lk120F` |
| Error notification workflow | `lsssyK7KqnqVzeJe` |
| HMAC credential | `s24zn4E4pWvKr2qj` |
| Tokens datatable | `Yb9NT9DUmiMhXhks` |

## Airtable resource IDs

| Thing | ID |
|---|---|
| Element Ops - Recruiting base | `appa28zyvdbF534Xl` |
| Recruitment table | `tblsDdMFkapAv604l` |
| Typing Speed URL - Monkeytype field | `fldxjZrYgtiDmXryW` |
| Typing Speed Submitted - Monkeytype field | `fldHuCl1ThiLIid51` |
| Typing Speed Submitted At - Monkeytype field | `fld3ozQjIFOg6bxr1` |
| Typing Speed WPM - Monkeytype field | `fldsP7ppnKsxKuDxp` |
| Typing Speed Accuracy - Monkeytype field | `fldpNOBjZuWQhUZfS` |

## What's intentionally not automated

- **Retake gating**: requires manually flipping a checkbox. Deliberate (low volume, gives recruiter discretion).
- **Threshold tuning**: defaults shipped; tune after first ~10 real submissions based on `automation-alerts` data.
- **URL regeneration on field rename**: if you ever rename `Typing Speed URL - Monkeytype`, the n8n workflows will break. Update both `generate-url` and `receive-result` to match.

## When in doubt

- Workflow JSON copies are committed at `docs/applicant-integration/workflow-*.json` — even if you accidentally delete a workflow in n8n, you can re-import.
- The HMAC secret only lives in n8n's credential vault. If you nuke that credential, ALL existing applicant URLs become invalid (HMAC verify will fail). Don't.
- Frontend code is on Element-Ops/monkeytype, branch `master`. Source of truth.
