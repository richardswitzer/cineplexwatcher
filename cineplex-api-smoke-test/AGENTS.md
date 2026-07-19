---
type: concept
title: "Working in this repo as an agent"
description: "Entry point directing agents to the canonical agent rules."
resource: "AGENTS.md"
tags: [ai-context, agent-rules, pointer]
timestamp: 2026-07-18
review_required: false
---

# Working in this repo as an agent

This file is a pointer, not a rules file. The full, canonical rule set —
secret handling, the pre-write verification sweep, and the human-review
flag convention — lives in a single place:

**→ [`docs/ai-context/08-agent-rules.md`](docs/ai-context/08-agent-rules.md)**

Read that file before making changes. Start orientation at
[`docs/ai-context/index.md`](docs/ai-context/index.md).

Do not restate or fork these rules elsewhere in the repo — if a rule needs
to change, change it in `08-agent-rules.md` and log it in
`docs/ai-context/log.md`.
