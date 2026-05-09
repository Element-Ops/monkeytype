# Airtable Automation Script v2

Replace the v1 script in your "Applicant Typing - Issue URL" automation (Recruitment table → "When record is created" trigger).

**Change from v1:** also passes the applicant's `fullName` so the typing test can render a personalized greeting.

## Input variables (configure in the script step's left panel)

Add a second input variable alongside `recordId`:

| Name | Value (click + select) |
|---|---|
| `recordId` | Trigger → Airtable record ID |
| `fullName` | Trigger → **Full Name** field |

## The script

```js
const { recordId, fullName } = input.config();

const WEBHOOK = "https://n8n.elementops.it.com/webhook/applicant-typing-generate-url";

const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, fullName: fullName || "" }),
});

const text = await res.text();

if (!res.ok) {
    throw new Error(`n8n returned ${res.status}: ${text}`);
}

output.set("status", res.status);
output.set("response", text);
```

## Test

After saving the script and adding the `fullName` input variable, click **Test** with a real record. You should see the n8n response body include both the recordId and a URL — and decoding the URL's token (paste the part between `?t=` and the `.` into a base64url decoder) will show `{"r":"rec...","e":...,"n":"...","name":"Their Name"}`.
