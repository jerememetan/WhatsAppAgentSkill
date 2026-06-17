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

export function buildInitialAgentStep(prompt: string) {
  const recipients = extractPhoneNumbers(prompt);
  const userMessage = `User: ${prompt}`;

  if (!recipients.length) {
    return {
      status: "blocked_no_recipients" as const,
      chatMessages: [userMessage, `Agent: ${buildBlockedNoRecipientsMessage()}`]
    };
  }

  return {
    status: "awaiting_draft_approval" as const,
    recipients,
    draftMessage: buildDraftMessage(),
    chatMessages: [
      userMessage,
      `Agent: I found ${recipients.length} recipient(s) and prepared a draft.`
    ]
  };
}

export function buildDraftApprovalStep(input: {
  senderIdentity: string;
  recipients: string[];
  approvedMessage: string;
}) {
  return {
    status: "awaiting_send_plan_approval" as const,
    sendPlanPreview: buildSendPlanPreview({
      senderIdentity: input.senderIdentity,
      recipients: input.recipients,
      message: input.approvedMessage
    }),
    chatMessages: ["Agent: Draft approved. Preparing send plan."]
  };
}

export function buildDraftRejectionStep() {
  return {
    status: "draft_rejected" as const,
    chatMessages: ["Agent: Draft rejected."]
  };
}
