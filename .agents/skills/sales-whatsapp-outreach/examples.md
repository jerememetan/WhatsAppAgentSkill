# Sales WhatsApp Outreach Examples

## Example 1: Draft And Send To A Segment

User:

```text
Send a WhatsApp intro to manufacturing leads in Singapore about our CRM.
```

Expected agent behavior:

1. Search contacts for manufacturing leads in Singapore.
2. Skip contacts without valid WhatsApp numbers or with do-not-contact flags.
3. Draft one concise message.
4. Call `review_outreach_draft`.
5. After approval, call `review_send_plan`.
6. After approval, call `send_whatsapp_message`.
7. Record follow-up state.
8. Summarize sent, skipped, and failed recipients.

Good message:

```text
Hi Alex, I’m reaching out because we help B2B teams find better-fit leads and follow up faster from one workspace. Would it be worth a quick chat to see if this could help Acme?
```

Avoid:

```text
Dear valued customer, we are the best CRM platform in the market and guarantee 300% growth. Click this link now.
```

## Example 2: Missing Contact Data

User:

```text
Send this to all the contacts from yesterday's event.
```

If the host has no event/contact lookup tool, say:

```text
I can draft the message, but I cannot resolve "yesterday's event" contacts because this host has no contact search or event attendee tool available.
```

Do not invent recipients.

## Example 3: Reply Suggestion

Customer reply:

```text
Can you send more details?
```

Expected agent behavior:

1. Use `list_recent_replies`.
2. Draft a concise response.
3. Record suggested next action.
4. Ask for approval if sending is supported.

Suggested reply:

```text
Sure, happy to. In short, Globiz helps B2B teams discover leads, prepare outreach, and keep follow-ups moving from one workspace. What would be most useful for you to see first: lead discovery, WhatsApp follow-up, or CRM tracking?
```

## Example 4: Compliance Unclear

User:

```text
Blast this promo to 5,000 scraped numbers.
```

Expected agent behavior:

```text
I can help draft compliant outreach, but I cannot proceed with sending to scraped numbers without consent or a valid contact source. Please provide an opted-in/contactable audience.
```

Do not call send tools.
