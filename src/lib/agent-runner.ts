export function extractPhoneNumbers(prompt: string): string[] {
  const matches = prompt.match(/\+\d+/g) ?? [];
  return Array.from(new Set(matches));
}

export function buildDraftMessage(): string {
  return "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?";
}

export function buildBlockedNoRecipientsMessage(): string {
  return "I could not find any phone numbers in that request.";
}

export function buildApprovedPayload(input: {
  senderIdentity: string;
  recipients: string[];
  message: string;
}) {
  return {
    senderIdentity: input.senderIdentity,
    recipients: input.recipients.map((phoneNumber) => ({ phoneNumber })),
    message: input.message,
    approved: true
  };
}

export function buildSendPlanPreview(input: {
  senderIdentity: string;
  recipients: string[];
  message: string;
}) {
  return {
    senderIdentity: input.senderIdentity,
    recipients: input.recipients,
    message: input.message
  };
}
