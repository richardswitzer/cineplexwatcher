---
type: concept
title: "Agent Rules — Secret Handling, Verification, and Review Flags"
description: "Canonical agent safety rules for the Cineplex smoke-test repo. Adapted from PaymentEvolution/agent-kits ai-context-okf-bundle."
resource: "docs/ai-context/08-agent-rules.md"
tags: [ai-context, agent-rules, security, canonical]
timestamp: 2026-07-18
status: reviewed
generated_from_repo: false
last_verified_commit: null
review_required: false
---

# Agent Rules (Canonical Source)

> Adapted from `PaymentEvolution/agent-kits` `ai-context-okf-bundle`.
> This is the single source of truth for agent safety rules in this repo.

## 1. Purpose and scope

These rules apply to any coding agent operating on this repository —
including reading source files, generating documentation, writing tests,
or making code changes.

## 2. What IS sensitive here

Despite this being an exploration project with a public API key, the
following must still be handled carefully:

| Category | What to protect |
|----------|----------------|
| `.env` file | Do not read or print `.env` — it may contain future secrets |
| Personal data | Do not log or commit any values that appear user-specific |
| Booking tokens | `ticketingUrl` and `ticketingRedesignUrl` in API responses — use as read-only, never submit |
| CAPTCHA/session tokens | If ever observed — never log, never commit |

## 3. What is NOT sensitive

The Cineplex `Ocp-Apim-Subscription-Key` (`dcdac5601d864addbc2675a2e96cb1f8`)
is **not a secret**. It is embedded in plaintext in the public production
JavaScript bundle at `https://www.cineplex.com`. Any member of the public
can retrieve it by loading the Cineplex website. It is safe to:
- Store in `config.ts` as a hardcoded constant
- Commit to version control
- Include in documentation

Do not treat it as a secret. Do not add it to `.env`. Do not reference it
as a credential in security tooling.

## 4. Pre-write verification

Before generating or modifying any file that references an endpoint URL,
film ID, theatre ID, or session ID, verify that the value is evidence-backed:

- Check `findings/API-FINDINGS.md` for confirmed identifiers
- Check `src/endpoint-candidates.ts` for classification
- Do NOT fabricate endpoint confirmations, IDs, or response fields

## 5. Evidence, confidence, and unknowns

Any generated documentation that makes factual claims about API behaviour
must include an `## Evidence reviewed` section and a `## Confidence` rating
(High / Medium / Low), and a `## Unknowns` section listing open questions.

## 6. Booking constraints

**Never generate code that:**
- POSTs to any checkout or payment endpoint
- Adds items to a cart
- Reserves or releases seats
- Calls any endpoint with a CAPTCHA token
- Bypasses rate limits or blocks

This project is read-only. Monitoring and alerting only.

## 7. Lifecycle status

| Status | Meaning |
|--------|---------|
| `template` | Placeholder only — content not yet verified against real data |
| `generated` | Agent-written, not yet human-reviewed |
| `reviewed` | Human confirmed content is accurate |

Files with `status: reviewed` in their frontmatter have been signed off.
Files with `review_required: true` have outstanding items.
