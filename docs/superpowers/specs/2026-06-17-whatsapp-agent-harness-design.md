# WhatsApp Agent Harness Design

## Goal

Replace the current manual outreach stepper with a prompt-driven agent harness that tests whether the portable skill at `.agents/skills/sales-whatsapp-outreach/` can run end-to-end against this app's host tools.

## Context

- The current app is a single-page Next.js host-tool demo with one dashboard entry point in `app/page.tsx`.
- The existing backend already satisfies the core host tool contract through `src/lib/tools.ts`, `app/api/tools/[tool]/route.ts`, and `app/api/store/route.ts`.
- The current UI in `src/components/Dashboard.tsx` bypasses the skill workflow by letting a human manually choose contacts, write copy, approve plans, and send.
- Existing tests in `tests/tools.test.ts` validate tool-level safety, especially approval gating and payload tamper detection.

## Problem Statement

The repo currently proves that the host can store contacts, review drafts, approve send plans, and send approved messages. It does not prove the intended product question:

> Can a basic agent, guided by the portable `sales-whatsapp-outreach` skill, successfully run the outreach workflow against a minimal host app?

The missing layer is an **agent harness** that:

1. Accepts a natural-language user request.
2. Runs a visible skill-like workflow.
3. Calls the existing host tools in the correct order.
4. Pauses at human approval checkpoints.
5. Resumes after approval and produces an execution summary.

## Non-Goals

- No real LLM integration in v1.
- No multi-user session persistence for transcript state.
- No redesign of the storage model or WhatsApp transport contract.
- No generalized arbitrary-skill runner.
- No reply sending; v1 only suggests replies when the host lacks an approval-gated reply-send tool.

## Existing Codebase Constraints

- Tool routing is already centralized and stable in `src/lib/tools.ts`.
- Store-backed review state already exists for draft review, send-plan review, threads, and follow-ups in `src/lib/types.ts` and `src/lib/store.ts`.
- The app currently has no `docs/` tree, so the spec and plan establish that structure now.
- Tests are written with Vitest and currently focus on `src/lib` behavior rather than component rendering.

## User Flows

### Flow 1: Run an outbound outreach request

**Entry point**

- User lands on the homepage and enters a natural-language prompt such as: “Send a WhatsApp intro to manufacturing leads in Singapore about our CRM.”

**Happy path**

1. The harness starts a new run and appends a transcript entry for the user request.
2. The basic agent interprets the request into:
   - campaign brief
   - contact search query
   - offer / reason for outreach
   - sender identity from host-controlled UI input
3. The agent calls `search_contacts`.
4. The agent filters or validates recipients using returned sendability metadata and, when needed, `get_contact`.
5. The agent composes one concise draft message.
6. The agent calls `review_outreach_draft`.
7. The run pauses in `awaiting_draft_approval`.
8. The user approves or rejects the draft from the harness approval card.
9. If approved, the agent calls `review_send_plan` with approved message text, recipients, skipped recipients, and sender identity.
10. The run pauses in `awaiting_send_plan_approval`.
11. The user approves or rejects the send plan from the harness approval card.
12. If approved, the agent calls `send_whatsapp_message` once per approved recipient.
13. After each successful send, the agent calls `record_follow_up`.
14. The run finishes with a concise sent/failed/skipped summary and points to where replies will appear.

**Terminal states**

- `completed`
- `blocked_for_input`
- `rejected_at_draft`
- `rejected_at_send_plan`
- `failed`

### Flow 2: Request cannot be safely resolved

**Entry point**

- User submits a prompt like: “Send this to all the contacts from yesterday’s event.”

**Happy path**

1. The agent inspects the request.
2. The request references a source the host cannot resolve from available tools.
3. The run stops before any review or send call.
4. The transcript explains the limitation using the contract language: the host has no event lookup capability.

**Terminal states**

- `blocked_for_input`

### Flow 3: Compliance or consent is unclear

**Entry point**

- User submits a prompt like: “Blast this promo to 5,000 scraped numbers.”

**Happy path**

1. The agent classifies the request as non-compliant based on the skill rules.
2. The run stops without calling send tools.
3. The transcript explains that an opted-in/contactable audience is required.

**Terminal states**

- `blocked_for_input`

### Flow 4: Draft approval is rejected or edited

**Entry point**

- User reviews the pending draft approval card.

**Happy path**

1. The agent has already paused after `review_outreach_draft`.
2. The user either:
   - approves with edited final text, or
   - rejects the draft
3. If approved, the harness uses the exact approved final text for later send-plan creation.
4. If rejected, the run ends with a clear transcript message and no send-plan creation.

**Terminal states**

- `awaiting_send_plan_approval`
- `rejected_at_draft`

### Flow 5: Send-plan approval is rejected

**Entry point**

- User reviews the pending send-plan approval card.

**Happy path**

1. The agent has already paused after `review_send_plan`.
2. The user rejects the plan.
3. The run ends with a transcript message that nothing was sent.

**Terminal states**

- `rejected_at_send_plan`

### Flow 6: Suggest a reply to a lead response

**Entry point**

- User chooses an existing thread or contact and asks for a reply suggestion.

**Happy path**

1. The agent calls `list_recent_replies`.
2. The agent drafts a short reply suggestion using recent thread context.
3. The agent calls `record_follow_up` with a suggested next action.
4. The UI shows the suggested reply text and rationale.

**Terminal states**

- `completed`
- `failed`

## Flow Analysis

### Critical Gaps Found

1. **No natural-language run entry point exists today**
   - The current homepage is a manual stepper, not an agent run surface.
   - This blocks the main user journey the portable skill is meant to test.
   - Default decision: replace the stepper with a prompt-first harness UI.

2. **No run state machine exists to pause and resume across approvals**
   - Current code creates pending reviews in the store but the UI has no agent-run concept.
   - Without explicit run states, approval handling becomes ambiguous and brittle.
   - Default decision: introduce a dedicated harness run model in client state with explicit statuses and transcript events.

3. **No defined behavior for unsupported audience resolution**
   - The skill examples require the agent to stop when the host cannot resolve recipients.
   - Current UI assumes the user manually selects contacts, which bypasses this scenario entirely.
   - Default decision: the agent runner must detect unsupported sources and stop with a clear explanation before any approval step.

### Important Gaps Found

1. **Sender identity source is underspecified**
   - The skill says sender identity must come from the host, not model inference.
   - Current UI already has a sender identity field; this should remain a host-controlled input outside prompt parsing.
   - Default decision: keep a dedicated sender identity field in the harness.

2. **Reply suggestion flow exists in the skill but not in the current UI**
   - The host exposes `list_recent_replies` and `record_follow_up`, but the harness has no reply-testing surface.
   - Default decision: add a lightweight reply suggestion panel in the same page, scoped to existing threads and no actual reply sending.

3. **Transcript persistence is unspecified**
   - Existing store persistence covers business data, not agent sessions.
   - Persisting sessions would add new entities and more scope.
   - Default decision: keep transcript state in-memory for v1 and reset on refresh.

4. **Draft rejection follow-up is ambiguous**
   - The skill says stop for approval but does not require automatic redrafting.
   - Default decision: end the run on rejection and let the user submit a revised prompt manually.

### Minor Gaps Found

1. **Complex prompt parsing is not specified**
   - Without an LLM, the harness needs constrained heuristics.
   - Default decision: support a rule-based parser that extracts search intent from the prompt, with clear failure messages when intent is too vague.

2. **Approval continuation UX is unspecified**
   - It is unclear whether approval should auto-resume or require a resume click.
   - Default decision: auto-resume after successful approval to keep the flow feeling agent-driven.

3. **Reply rationale shape is not stored today**
   - The reply template includes rationale, but current follow-up storage does not.
   - Default decision: display rationale in UI transcript only; persist only `summary` and `nextAction` through existing follow-up fields.

## Questions

1. **Should v1 persist agent transcripts across page refreshes?**
   - Why it matters: persistence affects data model scope and future debugging.
   - Default assumption: no; keep transcripts in memory for the first harness.

2. **Should the agent auto-resume after each approval, or require an explicit “continue” action?**
   - Why it matters: it changes both run state complexity and user feel.
   - Default assumption: auto-resume after approval.

3. **Should reply suggestions live in the same run transcript or a separate reply tool panel?**
   - Why it matters: the answer affects UI complexity and mental model.
   - Default assumption: a separate lightweight reply panel on the same page.

## Product Requirements

### Core Harness Requirements

1. The homepage must become a prompt-driven agent harness rather than a manual stepper.
2. The harness must accept:
   - one natural-language prompt
   - one host-controlled sender identity value
3. The harness must visibly log the agent workflow as transcript events.
4. The harness must reuse the existing host tool contract rather than inventing parallel send logic.
5. The harness must pause on draft and send-plan approvals and render approval cards inline.
6. The harness must resume after approval and continue the same run.
7. The harness must summarize sent, skipped, and failed recipients at the end.

### Agent Runner Requirements

1. The runner must implement the portable skill’s flow order:
   - intake
   - resolve recipients
   - draft
   - draft approval
   - send-plan creation
   - send-plan approval
   - send execution
   - follow-up recording
2. The runner must stop safely when:
   - sender identity is empty
   - prompt is too vague to resolve audience
   - prompt requests clearly non-compliant outreach
   - no sendable recipients are found
3. The runner must preserve the exact approved draft text when creating the send plan.
4. The runner must report where replies can be inspected in the host app.

### Approval UX Requirements

1. Pending draft review must show:
   - campaign brief
   - audience summary
   - editable final message
   - approve / reject actions
2. Pending send-plan review must show:
   - sender identity
   - approved final message
   - recipients
   - skipped recipients with reasons
   - approve / reject actions
3. Approval actions must call existing host endpoints and reflect persisted decisions from the store.

### Reply Suggestion Requirements

1. The page must include a simple reply-testing area using existing thread data.
2. The runner must call `list_recent_replies` before generating a reply suggestion.
3. The UI must display:
   - recent customer reply context
   - suggested reply text
   - rationale
   - next action
4. The runner must call `record_follow_up` to persist the suggested next action.

## Technical Design

### Overview

The app will remain a single-page Next.js app with server-backed host tools and a client-side agent harness. The existing tool contract remains the source of truth for business operations. The new layer is a rule-based runner that sequences those tools, manages run state, and emits transcript events.

### Proposed File Structure

- `src/lib/agent-types.ts`
  - Types for run status, transcript events, parsed prompt shape, and reply suggestion output.
- `src/lib/agent-runner.ts`
  - Pure runner helpers for prompt classification, recipient resolution orchestration, draft generation, summary generation, and next-step transitions.
- `src/lib/agent-copy.ts`
  - Small deterministic copy helpers for outreach drafts and reply suggestions.
- `src/components/Dashboard.tsx`
  - Replaced with a harness-oriented page shell that orchestrates UI state and server calls.
- `src/components/AgentTranscript.tsx`
  - Read-only transcript list for user messages, tool calls, approval pauses, and results.
- `src/components/ApprovalPanel.tsx`
  - Shared UI for draft/send-plan approval cards.
- `src/components/ReplySuggestionPanel.tsx`
  - Lightweight UI for reply suggestion testing.
- `tests/agent-runner.test.ts`
  - Unit tests for prompt parsing, blocked flows, and summary shaping.
- `tests/dashboard-harness.test.ts`
  - UI-level tests for approval pause/resume behavior if the repo’s existing setup can support component tests without new heavy dependencies; otherwise keep this coverage in runner tests only.

### State Model

The harness keeps one active run in component state:

- `idle`
- `running`
- `awaiting_draft_approval`
- `awaiting_send_plan_approval`
- `completed`
- `blocked_for_input`
- `rejected_at_draft`
- `rejected_at_send_plan`
- `failed`

Each run also stores transcript events such as:

- user prompt submitted
- tool call started
- tool result received
- approval requested
- approval decision applied
- send completed
- run blocked / failed

### Prompt Handling

The harness does not use an LLM. Instead it uses a small rule-based interpreter:

- detect obviously non-compliant phrases like “scraped numbers”
- treat the prompt body as both campaign brief and a search query seed
- require a host-provided sender identity
- generate concise message copy from the prompt using deterministic templates
- stop with a limitation message when the prompt references unsupported data sources such as events or lists the host cannot resolve

### Tool Usage Strategy

The harness should call through the existing HTTP endpoints used by the app today, not import server-only functions into the client. This keeps the harness behavior close to how an external agent integration would exercise the host.

Outbound run sequence:

1. `POST /api/tools/search_contacts`
2. `POST /api/tools/get_contact` for any contacts needing fuller context
3. `POST /api/tools/review_outreach_draft`
4. `POST /api/store` with `approveDraft`
5. `POST /api/tools/review_send_plan` or existing equivalent store-backed path
6. `POST /api/store` with `approveSendPlan`
7. `POST /api/tools/send_whatsapp_message` per recipient or existing `sendPlan` action when it matches the approved payload contract
8. `POST /api/tools/record_follow_up`

Reply suggestion sequence:

1. `POST /api/tools/list_recent_replies`
2. local reply draft generation
3. `POST /api/tools/record_follow_up`

### Error Handling

- Unknown or unsupported prompt source: stop with `blocked_for_input`.
- Empty sender identity: stop with a direct host-configuration error.
- No sendable contacts: complete with `0 sent`, all skipped reasons visible.
- Draft rejection: stop cleanly with no send plan.
- Send-plan rejection: stop cleanly with no sends.
- Per-recipient send failures: continue remaining approved recipients and summarize failures at the end.
- Network or API errors: mark run `failed` and surface the last failing step.

## Testing Strategy

### Unit Tests

- Prompt classification:
  - compliant outreach request
  - unsupported event-source request
  - clearly non-compliant scraped-number request
- Draft generation:
  - concise message output
  - no empty output for valid request
- Transcript / summary shaping:
  - blocked summary
  - mixed send results summary

### Integration-Like Runner Tests

- Approval pause after draft review.
- Resume after approved draft.
- Pause after send-plan review.
- Resume after approved send plan.
- Stop on draft rejection.
- Stop on send-plan rejection.
- Preserve exact approved final message into send-plan creation.

### Existing Tool Regression

- Keep `tests/tools.test.ts` as the safety net for approval token enforcement and payload tampering.

## Recommended Next Steps

1. Introduce a dedicated runner/type layer in `src/lib` rather than embedding agent logic inside `Dashboard`.
2. Replace the current dashboard with a prompt-first harness UI and transcript.
3. Reuse current approval actions instead of rewriting review storage behavior.
4. Add runner tests before implementation so the pause/resume workflow is proven outside the UI.
5. Leave transcript persistence and true LLM integration out of scope for this first pass.
