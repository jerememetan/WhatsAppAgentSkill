export type Contact = {
  contactId: string;
  name: string;
  companyName?: string;
  whatsapp?: string;
  email?: string;
  status?: "active" | "inactive";
  doNotContact?: boolean;
  notes?: string;
  recentInteractions?: string[];
};

export type Recipient = {
  recipientId: string;
  contactId: string;
  name: string;
  companyName?: string;
  whatsapp: string;
};

export type SkippedRecipient = {
  recipientId: string;
  name?: string;
  reason: string;
};

export type DraftReview = {
  id: string;
  campaignBrief: string;
  audienceSummary: string;
  draftMessage: string;
  finalMessage?: string;
  mediaReference: string | null;
  decision: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
};

export type SendPlan = {
  id: string;
  campaignBrief: string;
  senderIdentity: string;
  validRecipientCount: number;
  recipients: Recipient[];
  skippedRecipients: SkippedRecipient[];
  finalMessage: string;
  mediaReference: string | null;
  decision: "pending" | "approved" | "rejected";
  sendAuthorizationToken?: string;
  payloadHash?: string;
  expiresAt?: string;
  createdAt: string;
  decidedAt?: string;
};

export type SendAuthorization = {
  token: string;
  payloadHash: string;
  expiresAt: string;
  usedAt?: string;
  sentRecipientIds?: string[];
  createdAt: string;
  sendPlanId: string;
};

export type ThreadMessage = {
  role: "business" | "customer";
  content: string;
  createdAt: string;
  messageId?: string;
};

export type Thread = {
  threadId: string;
  contactId: string;
  recipientId: string;
  messages: ThreadMessage[];
  createdAt: string;
  updatedAt: string;
};

export type FollowUp = {
  id: string;
  threadId: string;
  contactId: string;
  status: string;
  summary: string;
  nextAction?: string;
  createdAt: string;
};

export type StoreData = {
  contacts: Contact[];
  draftReviews: DraftReview[];
  sendPlans: SendPlan[];
  authorizations: SendAuthorization[];
  threads: Thread[];
  followUps: FollowUp[];
};

export type SendPayloadForHash = {
  senderIdentity: string;
  recipient: Recipient;
  message: string;
  mediaReference: string | null;
};

export type WhatsAppSendResult = {
  status: "sent" | "failed";
  threadId?: string;
  messageId?: string;
  error: string | null;
};
