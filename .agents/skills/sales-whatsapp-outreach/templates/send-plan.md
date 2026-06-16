# Send Plan Payload Template

Use this shape when calling `review_send_plan`.

```json
{
  "campaignBrief": "",
  "senderIdentity": "",
  "validRecipientCount": 0,
  "recipients": [],
  "skippedRecipients": [],
  "finalMessage": "",
  "mediaReference": null
}
```

Checklist before calling:

- Sender identity comes from the host app, not model inference.
- Recipient list is deduped.
- Skipped recipients include reasons.
- Final message exactly matches the approved draft unless the user edited it.
- Media reference is included only when the host can send it.
