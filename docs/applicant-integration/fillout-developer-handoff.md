# Fillout Form: Typing Test Button — Developer Handoff

**Audience:** the developer wiring the Fillout application form for Element Ops applicants.

**Goal:** a button on the form that takes each applicant to a unique typing test page. The URL is generated upstream — you do not generate it, sign it, or modify it.

## What you do

1. The Recruitment table in Airtable (base **Element Ops - Recruiting**) now has a column called:

   ```
   Typing Speed URL - Monkeytype
   ```

   Every record gets one populated automatically by an n8n workflow on record creation. Treat it as read-only.

2. In the Fillout form's "Take Typing Test" button (or however the test is presented), bind the **destination URL** to that column's value. Pull it through Fillout's Airtable integration like any other prefilled field — no transformation, no truncation, no re-encoding.

3. Make sure Fillout's Airtable integration on this form is configured as **Update existing record** matched on the Airtable record ID, **NOT** Create new record. Otherwise the form's submission and the typing test results will land on two different rows and we lose the link.

That's it. You do not need to:

- Understand the URL's format or what's inside it
- Add any signing, hashing, or auth headers
- Call any n8n endpoint
- Worry about token expiry or replay protection

The URL embeds everything required. It expires 30 days after the record is created.

## What happens after the applicant clicks

1. Applicant lands on `https://typing.elementops.com/?t=<token>`
2. They take a locked 60-second English typing test
3. The frontend POSTs the result to an n8n webhook
4. n8n verifies the signature and writes back to the same Airtable record:
   - `Typing Speed Submitted - Monkeytype` → checked
   - `Typing Speed Submitted At - Monkeytype` → server timestamp
   - `Typing Speed WPM - Monkeytype` → numeric
   - `Typing Speed Accuracy - Monkeytype` → percent

You don't see or touch any of this — it lands in the same row Fillout updated.

## Edge cases worth knowing

- **Applicant clicks the test button before submitting the form.** Fine. The test posts results to the same record either way.
- **Applicant takes the test on a different device / network than they filled the form on.** Fine. The URL is the only identity needed.
- **Applicant tries to take the test twice.** Second submission gets a 409 from n8n. Their original score stands.
- **Token expired (>30 days from record creation).** Page shows "this link has expired, contact your recruiter". Marc / a recruiter can manually flip `Typing Speed Submitted - Monkeytype` to false to allow a retake within the original 30 days, but cannot extend expiry — that requires regenerating the URL upstream.

## Contact

Anything ambiguous → message Marc on Slack. Don't guess; the security model assumes this URL is treated as opaque.
