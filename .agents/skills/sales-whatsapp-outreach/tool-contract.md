# Sales WhatsApp Outreach Tool Contract

Host apps may implement these as native agent tools, MCP tools, HTTP endpoints, or local functions.
Tool names can differ, but the behavior and data shape should be equivalent.

## Core Entities

### Contact

```json
{
  "contactId": "contact_123",
  "name": "Alex Tan",
  "companyName": "Acme Sdn Bhd",
  "whatsapp": "+6591111111",
  "email": "alex@example.com",
  "status": "active",
  "doNotContact": false,
  "notes": "Interested in automation"
}
```

### Recipient

```json
{
  "recipientId": "+6591111111",
  "contactId": "contact_123",
  "name": "Alex Tan",
  "companyName": "Acme Sdn Bhd",
  "whatsapp": "+6591111111"
}
```

### Skipped Recipient

```json
{
  "recipientId": "contact_456",
  "name": "Priya",
  "reason": "Missing WhatsApp number"
}
```

## Required Tools

### `search_contacts`

Find possible recipients.

Input:

```json
{
  "query": "manufacturing leads in Singapore",
  "limit": 25
}
```

Output:

```json
{
  "contacts": [
    {
      "contactId": "contact_123",
      "name": "Alex Tan",
      "companyName": "Acme Sdn Bhd",
      "whatsapp": "+6591111111",
      "doNotContact": false,
      "notes": "Interested in automation"
    }
  ]
}
```

Required behavior:

- Return only contacts the current user is allowed to access.
- Include WhatsApp/sendability fields when known.
- Do not silently include blocked or opted-out contacts as sendable.

### `get_contact`

Fetch full context for one contact.

Input:

```json
{
  "contactId": "contact_123"
}
```

Output:

```json
{
  "contact": {
    "contactId": "contact_123",
    "name": "Alex Tan",
    "companyName": "Acme Sdn Bhd",
    "whatsapp": "+6591111111",
    "doNotContact": false,
    "notes": "Interested in automation",
    "recentInteractions": []
  }
}
```

### `review_outreach_draft`

Show the draft to a human and block until approve, reject, or edit.

Input:

```json
{
  "campaignBrief": "Introduce Globiz to Singapore manufacturing leads",
  "audienceSummary": "12 contacts with valid WhatsApp numbers",
  "draftMessage": "Hi Alex, I’m reaching out because we help B2B teams find and follow up with better-fit leads. Would it be worth a quick chat to see if this is relevant for Acme?",
  "mediaReference": null
}
```

Output:

```json
{
  "decision": "approved",
  "finalMessage": "Hi Alex, I’m reaching out because we help B2B teams find and follow up with better-fit leads. Would it be worth a quick chat to see if this is relevant for Acme?",
  "mediaReference": null
}
```

Allowed decisions: `approved`, `rejected`.

Required behavior:

- Must be human-in-the-loop.
- Must return the exact approved or edited final message.

### `review_send_plan`

Show final sender, recipients, skipped recipients, and message before sending.

Input:

```json
{
  "campaignBrief": "Introduce Globiz to Singapore manufacturing leads",
  "senderIdentity": "+6591240000",
  "validRecipientCount": 12,
  "recipients": [],
  "skippedRecipients": [],
  "finalMessage": "Hi Alex, I’m reaching out because...",
  "mediaReference": null
}
```

Output:

```json
{
  "decision": "approved",
  "sendAuthorizationToken": "token_abc123",
  "expiresAt": "2026-06-16T10:00:00.000Z"
}
```

Required behavior:

- Must be human-in-the-loop.
- Must return a token or equivalent proof that the reviewed payload was approved.
- Token should be scoped to the approved message and recipient snapshot.

### `send_whatsapp_message`

Send one approved WhatsApp message or one approved batch.

Input:

```json
{
  "sendAuthorizationToken": "token_abc123",
  "senderIdentity": "+6591240000",
  "recipient": {
    "recipientId": "+6591111111",
    "contactId": "contact_123",
    "name": "Alex Tan",
    "companyName": "Acme Sdn Bhd",
    "whatsapp": "+6591111111"
  },
  "message": "Hi Alex, I’m reaching out because...",
  "mediaReference": null
}
```

Output:

```json
{
  "status": "sent",
  "threadId": "thread_123",
  "messageId": "wamid_123",
  "error": null
}
```

Required behavior:

- Reject sends without valid approval.
- Use the configured WhatsApp sender identity.
- Return thread/message identifiers for reply tracking.
- Surface per-recipient failures.

### `list_recent_replies`

Read recent customer replies for a thread, contact, or campaign.

Input:

```json
{
  "threadId": "thread_123",
  "limit": 10
}
```

Output:

```json
{
  "messages": [
    {
      "role": "customer",
      "content": "Can you send more details?",
      "createdAt": "2026-06-16T09:00:00.000Z"
    }
  ]
}
```

### `record_follow_up`

Persist outreach outcome or suggested next action.

Input:

```json
{
  "threadId": "thread_123",
  "contactId": "contact_123",
  "status": "reply_received",
  "summary": "Asked for more details",
  "nextAction": "Send short product overview"
}
```

Output:

```json
{
  "ok": true
}
```

## Recommended Optional Tools

- `resolve_sender_identity`
- `validate_whatsapp_recipient`
- `get_campaign_context`
- `attach_media`
- `review_reply_draft`
- `send_approved_reply`

## Minimum Viable Host App

A new app can satisfy this skill with:

1. a contacts table
2. a WhatsApp transport adapter
3. a threads/messages table
4. approval screens or CLI confirmations
5. implementations of the required tools above
