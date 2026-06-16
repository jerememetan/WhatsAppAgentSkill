---
name: sales-whatsapp-outreach
description: Runs approval-gated WhatsApp sales outreach and follow-up using host-provided contact, approval, messaging, reply, and follow-up tools. Use when drafting, reviewing, sending, or replying to sales outreach over WhatsApp.
---

# Sales WhatsApp Outreach

## Purpose

Run safe, human-approved WhatsApp sales outreach:

1. Understand the campaign intent.
2. Resolve target contacts or leads.
3. Draft a concise WhatsApp message.
4. Ask for human draft approval.
5. Prepare a send plan.
6. Send only after explicit send approval.
7. Track replies and outcomes.
8. Suggest useful follow-up replies.

This skill is portable. The host app owns storage, CRM data, WhatsApp transport, approval UI,
threading, and reply events. This skill owns the agent workflow and decision rules.

## Required Host Tools

Before running the workflow, confirm these tools or equivalent adapters exist:

- `search_contacts`
- `get_contact`
- `review_outreach_draft`
- `review_send_plan`
- `send_whatsapp_message`
- `list_recent_replies`
- `record_follow_up`

If a required tool is missing, explain the missing capability and stop before sending.
For complete expected schemas, read `tool-contract.md`.

## Hard Rules

- Never send a WhatsApp message without explicit approval from `review_send_plan`.
- Never invent customer history, pricing, discounts, guarantees, product availability, or sender identity.
- Keep outreach short, human, specific, and easy to reply to.
- Preserve approved message text unless the user edits it.
- Always report sent, skipped, and failed recipients after execution.
- If recipient consent, compliance, or channel policy is unclear, ask the user before sending.

## Workflow

### 1. Intake

Identify:

- campaign goal
- target audience
- offer or reason for outreach
- sender identity
- message constraints
- media attachment, if any

Ask one concise clarification only if a missing detail blocks safe drafting or sending.

### 2. Resolve Recipients

Use `search_contacts` and `get_contact` to build a recipient list.

Skip contacts when:

- WhatsApp identifier is missing or invalid
- recipient is duplicated
- recipient is blocked, opted out, or marked do-not-contact
- required contact context is unavailable

Keep a skipped-recipient list with reasons.

### 3. Draft

Draft one customer-facing WhatsApp message. It should:

- sound like a real person
- fit in a short chat message
- include one clear reason for reaching out
- end with a low-pressure question or next step

Call `review_outreach_draft` and stop for approval.

### 4. Send Plan

After draft approval:

- use the approved final message
- include sender identity
- include valid recipient count
- include skipped recipients
- include recipient snapshot
- include media reference, if any

Call `review_send_plan` and stop for approval.

### 5. Execute

After send approval, call `send_whatsapp_message` for each approved recipient or batch, depending on
the host tool contract. Record results with `record_follow_up`.

Return a concise summary:

- sent count
- failed count
- skipped count
- notable failures
- where replies will appear

### 6. Suggest Replies

When a lead replies:

1. Use `list_recent_replies` to read the relevant thread context.
2. Draft a concise sales follow-up.
3. If the host supports approval-gated reply sending, submit it for approval.
4. Otherwise, provide the suggested reply text only.

## Additional Files

- `tool-contract.md` defines the host tool schemas and required behavior.
- `examples.md` shows common user requests and expected agent behavior.
- `templates/` contains reusable prompt payload shapes.
