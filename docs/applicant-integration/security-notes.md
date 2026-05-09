# Applicant URL — Security Notes

## What the URL contains

```
https://typing.elementops.it.com/?t=<base64url-payload>.<hex-sig>
```

- **`<base64url-payload>`** — JSON-encoded `{ r: recordId, e: expiresUnix, n: nonce }`. Base64url is *encoding*, not encryption. Anyone with the URL can decode this in 1 line of JavaScript and read the recordId, expiry timestamp, and nonce.
- **`<hex-sig>`** — HMAC-SHA256 of the payload, computed with a 32-byte secret stored in the n8n `Monkeytype HMAC` credential. Without the secret, the signature is computationally infeasible to forge.

After our planned name-passthrough optimization, payload becomes `{ r, e, n, name }` — name is also visible after decoding.

## Threat model: "reasonable friction"

We've explicitly accepted that determined applicants who script the n8n webhook can spoof results. This document covers the realistic threats below that bar.

| Threat | Mitigated? | Notes |
|---|---|---|
| Forge a token (set arbitrary recordId / expiry) | ✅ HMAC-SHA256 with 32-byte secret blocks this. Brute-force = infeasible. |
| Submit twice to overwrite score | ✅ n8n receive-result returns 409 if `Typing Speed Submitted - Monkeytype` is true |
| Submit wildly implausible result | ✅ Plausibility checks reject (testDuration ≥ 55, charTotal ≥ 150, wpm ≤ 200, afkDuration < 10, restartCount ≤ 3, keySpacing variance > 1) |
| Token expires after 30d → still attempt | ✅ Server enforces; returns 410 |
| URL leaks via web search engine | ⚠️ Mitigation: add `<meta name="robots" content="noindex,nofollow">` to applicant-mode HTML. Frontend isn't linked from anywhere public, but defense in depth. |
| URL leaks via Referer header to embedded resources | ✅ Applicant-mode HTML loads only same-origin assets (no third-party iframes/images on the test page). The URL stays on origin. |
| URL leaks via reverse-proxy / Caddy / Railway edge access logs | ⚠️ The full token appears in any access log for `typing.elementops.it.com`. Anyone with log read access can replay until the applicant submits (which closes the window via the 409 check). After submission, replays bounce harmlessly. Mitigation: move token to POST body — but breaks the click-to-take-test flow, not worth it. **Accepted risk.** |
| URL leaks via browser history on shared device | ⚠️ The token is in `location.search`. After submission, replays return 409. Before submission, anyone with browser history access could complete the test in the applicant's name. Same risk as a recovery email link. **Accepted at "reasonable friction" tier.** |
| URL forwarded to a friend who takes the test for them | ⚠️ No per-user binding (no IP check, no client fingerprint). If the applicant deliberately shares the URL, the friend's score becomes the applicant's score. **Accepted at this tier.** Future hardening: add a webcam snapshot or Fillout-side verification. |
| Token reuse across multiple sessions on the same device | ✅ Submitted flag in Airtable handles dedup. |
| HMAC secret leaks → can forge any token | ✅ Secret lives in n8n credential vault, never in repo, never in workflow JSON, never in chat (current credential value was generated client-side and rotated post-architecture-switch). Crypto node references it by ID only. |
| n8n webhook DoS | ⚠️ No rate limit currently. n8n can take a moderate burst. If we ever see abuse, add Cloudflare in front of `n8n.elementops.it.com` with a per-IP rate limit. **Accepted for current volume.** |

## What I'd recommend (and what we're doing)

1. **Add `noindex` meta tag** in applicant mode — implemented as part of optimization #3. One-line change. Prevents search engines from ever indexing an exposed URL.
2. **Keep the 30-day expiry** — long enough for slow-moving applicants, short enough that stale URLs die.
3. **No changes to token format** — the bearer-token-in-URL pattern is industry-standard for this exact use case (think email magic links, password reset links, Calendly URLs). The risks are well-understood and acceptable for non-security-critical UX.
4. **Document the "what if applicant shares the URL" scenario** so reviewers know — added above.

## What we explicitly do NOT do (and why)

- **No IP binding** — applicants legitimately switch networks (mobile → wifi). Would lock out real users.
- **No client fingerprinting** — privacy concern, fragile across browser updates.
- **No CAPTCHA on result submit** — adds friction, low ROI given plausibility checks already handle scripted submissions.
- **No proof-of-presence (webcam, mic)** — heavy UX cost, privacy concern, only catches a subset of cheating.

## Bottom line

The URL/token design is appropriate for the assessment use case. The biggest practical risks (URL forwarding, log leak) are intentional tradeoffs documented here. If recruitment integrity ever becomes a higher bar, the upgrade path is server-side proctoring (e.g. send the test through a Fillout-embedded iframe with browser fingerprinting), not changes to the URL token.
