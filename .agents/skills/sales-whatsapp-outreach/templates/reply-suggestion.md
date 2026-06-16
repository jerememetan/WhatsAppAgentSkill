# Reply Suggestion Template

Use this when a recipient replies and the user wants a suggested response.

## Inputs To Gather

- Contact name
- Company name, if known
- Original outreach message
- Latest customer reply
- Recent thread context
- Product or offer facts available in the host app

## Output Shape

```json
{
  "threadId": "",
  "contactId": "",
  "replyDraft": "",
  "rationale": "",
  "nextAction": ""
}
```

Checklist:

- Reply directly addresses the customer's message.
- Reply is short and conversational.
- No unsupported product claims are added.
- If the customer asks for a human, pricing approval, legal issue, or sensitive topic, recommend handoff.
