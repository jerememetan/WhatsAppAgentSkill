# WhatsApp Skill Harness Step 1 Design

## Goal

Build the smallest possible host UI that proves the portable skill flow can drive:

1. a chat-style user request,
2. a draft approval card,
3. a send-plan approval card,
4. and a final approved JSON payload.

This step does **not** send real WhatsApp messages. It stops after approval and shows the JSON object that a future WhatsApp integration could consume.

## Context

- The current app already has a Next.js page and local JSON-backed state.
- The current implementation drifted toward a broader host-tool demo with manual workflow steps.
- The actual question for Step 1 is much smaller:

> If the user chats with a basic agent and asks it to do WhatsApp outreach, can the host render the right approval cards and produce the right approved payload?

## Non-Goals

- No real WhatsApp sending.
- No WhatsApp channel creation or Cloud API wiring.
- No CRM/contact search integration.
- No reply suggestion flow.
- No generic multi-skill agent platform.
- No persistent multi-run session history beyond what the page needs.

## Desired Demo Flow

### Flow 1: Main happy path

**Entry point**

- User lands on the homepage and sees a chat box with a simple agent interface.

**User message**

- Example: `do a whatsapp outreach for +8123 and +81234`

**Happy path**

1. User submits the prompt.
2. The basic agent extracts phone numbers from the message.
3. The basic agent drafts a short outreach message.
4. The UI shows a **Draft Review** approval card.
5. The user approves or edits the draft.
6. The UI shows a **Send Plan Review** card with:
   - sender identity
   - recipient phone numbers
   - final approved message
7. The user approves the send plan.
8. The app renders a final approved JSON object.

**Terminal state**

- `approved_json_ready`

### Flow 2: Draft rejected

1. User submits a prompt.
2. Agent extracts recipients and drafts the message.
3. Draft Review card appears.
4. User rejects the draft.
5. Flow stops and no send-plan card is shown.

**Terminal state**

- `draft_rejected`

### Flow 3: Send plan rejected

1. User approves the draft.
2. Send Plan Review card appears.
3. User rejects the send plan.
4. Flow stops and no JSON export is shown.

**Terminal state**

- `send_plan_rejected`

### Flow 4: No valid phone numbers found

1. User submits a prompt.
2. Agent cannot extract any phone numbers.
3. The chat area shows a short explanation that no recipients were found.
4. No approval card is shown.

**Terminal state**

- `blocked_no_recipients`

## What This Step Proves

This step proves:

- the portable skill can start from a chat request,
- the host can pause for draft approval,
- the host can pause for send-plan approval,
- and the approved result can be shaped into a JSON payload for future transport wiring.

It does **not** prove:

- real WhatsApp delivery,
- contact lookup,
- reply handling,
- or end-to-end messaging infrastructure.

## Product Requirements

### UI Requirements

1. The homepage must show a chat-style interface.
2. The user must be able to submit one free-text request.
3. The page must show a simple agent transcript or message log.
4. The page must render a Draft Review card after the agent drafts a message.
5. The page must render a Send Plan Review card after draft approval.
6. The page must render the final approved JSON payload after send-plan approval.

### Agent Behavior Requirements

1. The agent must parse phone numbers directly from the user prompt.
2. The agent must create one concise draft message.
3. The draft text must be editable at approval time.
4. The send-plan card must use the exact approved draft text.
5. The final JSON must use the exact approved sender identity, recipient list, and message.

### Approval Requirements

1. Draft approval must support:
   - approve
   - reject
   - edit approved text
2. Send-plan approval must support:
   - approve
   - reject
3. Rejecting either card must stop the flow cleanly.

### JSON Output Requirements

The final JSON should look like this shape:

```json
{
  "senderIdentity": "+6591240000",
  "recipients": [
    { "phoneNumber": "+8123" },
    { "phoneNumber": "+81234" }
  ],
  "message": "Hi, I’m reaching out because...",
  "approved": true
}
```

The exact field names may differ slightly, but the payload must clearly represent:

- sender identity
- approved recipients
- approved message
- approved state

## Existing Codebase Constraints

- The current `Dashboard` is too workflow-heavy for this scope and should be simplified.
- The current store/tool system is more than Step 1 needs; Step 1 should reuse only what helps, not force a full host-tool simulation.
- The app already has test infrastructure with Vitest, so Step 1 should add a few focused tests rather than a full harness suite.

## Technical Design

### Recommended Scope

Keep Step 1 mostly in one page plus one small helper module:

- `src/components/Dashboard.tsx`
  - main chat UI
  - approval card rendering
  - final JSON rendering
- `src/lib/agent-runner.ts`
  - phone-number extraction
  - draft generation
  - send-plan shaping
  - JSON export shaping

Optional only if it meaningfully simplifies the file:

- `src/lib/agent-types.ts`

No additional UI subcomponents are required for Step 1 unless `Dashboard.tsx` becomes clearly unwieldy.

### State Model

One active flow in client state is enough:

- `idle`
- `awaiting_draft_approval`
- `awaiting_send_plan_approval`
- `approved_json_ready`
- `draft_rejected`
- `send_plan_rejected`
- `blocked_no_recipients`

### Parsing Rules

For Step 1, the agent only needs simple extraction:

- pull `+`-prefixed phone-like tokens from the prompt
- dedupe them
- if none are found, block with a clear message

No CRM lookup, no contact enrichment, and no compliance intelligence beyond this minimal scope.

### Draft Rules

The agent should generate one short outreach draft that:

- sounds human
- is brief
- ends with a low-pressure next step

The draft can be deterministic rather than LLM-generated.

## Questions Resolved For This Step

1. **Should this step integrate with real WhatsApp?**
   - No.

2. **Should this step include reply handling?**
   - No.

3. **Should this step rely on contact search tools?**
   - No.

4. **Should this step stop at JSON export?**
   - Yes.

## Testing Strategy

Add only focused tests for:

1. phone number extraction from a prompt,
2. blocking when no numbers are found,
3. preserving edited draft text into the send-plan payload,
4. shaping the final approved JSON object correctly.

## Recommended Next Step After This

If this Step 1 works, the next step is:

- replace raw phone-number extraction with real recipient resolution or host tools,
- and replace JSON export with actual WhatsApp integration.
