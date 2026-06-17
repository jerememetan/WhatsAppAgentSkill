import { createToken, expiresInMinutes, hashValue } from "./canonical";
import { readStore, updateStore } from "./store";
import type {
  DraftReview,
  FollowUp,
  Recipient,
  SendPlan,
  SkippedRecipient,
  WhatsAppSendResult
} from "./types";
import { sendWithConfiguredAdapter } from "./whatsapp";

export type ToolName =
  | "search_contacts"
  | "get_contact"
  | "review_outreach_draft"
  | "review_send_plan"
  | "send_whatsapp_message"
  | "list_recent_replies"
  | "record_follow_up";

const tokenTtlMinutes = 30;

function now(): string {
  return new Date().toISOString();
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeMedia(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toRecipient(contact: {
  contactId: string;
  name: string;
  companyName?: string;
  whatsapp?: string;
}): Recipient | null {
  if (!contact.whatsapp) {
    return null;
  }

  return {
    recipientId: contact.whatsapp,
    contactId: contact.contactId,
    name: contact.name,
    companyName: contact.companyName,
    whatsapp: contact.whatsapp
  };
}

function getSkippedReason(contact: { whatsapp?: string; doNotContact?: boolean; status?: string }): string | null {
  if (contact.doNotContact) {
    return "Do not contact";
  }

  if (contact.status && contact.status !== "active") {
    return "Inactive contact";
  }

  if (!contact.whatsapp) {
    return "Missing WhatsApp number";
  }

  return null;
}

function buildPlanPayload(input: {
  senderIdentity: string;
  recipients: Recipient[];
  skippedRecipients: SkippedRecipient[];
  finalMessage: string;
  mediaReference: string | null;
}) {
  return {
    senderIdentity: input.senderIdentity,
    recipients: input.recipients,
    skippedRecipients: input.skippedRecipients,
    finalMessage: input.finalMessage,
    mediaReference: input.mediaReference
  };
}

export async function searchContacts(input: { query?: string; limit?: number }) {
  const data = await readStore();
  const query = input.query?.trim().toLowerCase() ?? "";
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));

  const contacts = data.contacts
    .filter((contact) => {
      if (!query) {
        return true;
      }

      return [contact.name, contact.companyName, contact.notes, contact.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    })
    .slice(0, limit)
    .map((contact) => ({
      contactId: contact.contactId,
      name: contact.name,
      companyName: contact.companyName,
      whatsapp: contact.whatsapp,
      doNotContact: Boolean(contact.doNotContact),
      notes: contact.notes
    }));

  return { contacts };
}

export async function getContact(input: { contactId: string }) {
  const data = await readStore();
  const contact = data.contacts.find((candidate) => candidate.contactId === input.contactId);

  if (!contact) {
    return { contact: null };
  }

  return { contact: { ...contact, recentInteractions: contact.recentInteractions ?? [] } };
}

export async function reviewOutreachDraft(input: {
  campaignBrief: string;
  audienceSummary: string;
  draftMessage: string;
  mediaReference?: string | null;
}) {
  return updateStore((data) => {
    const review: DraftReview = {
      id: createToken("draft"),
      campaignBrief: input.campaignBrief,
      audienceSummary: input.audienceSummary,
      draftMessage: input.draftMessage,
      mediaReference: normalizeMedia(input.mediaReference),
      decision: "pending",
      createdAt: now()
    };

    data.draftReviews.unshift(review);

    return {
      decision: "pending",
      reviewId: review.id,
      reviewUrl: `/`,
      finalMessage: null,
      mediaReference: review.mediaReference
    };
  });
}

export async function approveDraftReview(input: {
  reviewId: string;
  decision: "approved" | "rejected";
  finalMessage?: string;
}) {
  return updateStore((data) => {
    const review = data.draftReviews.find((candidate) => candidate.id === input.reviewId);
    if (!review) {
      throw new Error("Draft review not found");
    }

    review.decision = input.decision;
    review.finalMessage = input.decision === "approved" ? input.finalMessage || review.draftMessage : undefined;
    review.decidedAt = now();

    return {
      decision: review.decision,
      finalMessage: review.finalMessage ?? null,
      mediaReference: review.mediaReference
    };
  });
}

export async function reviewSendPlan(input: {
  campaignBrief: string;
  senderIdentity: string;
  validRecipientCount?: number;
  recipients?: Recipient[];
  skippedRecipients?: SkippedRecipient[];
  finalMessage: string;
  mediaReference?: string | null;
}) {
  return updateStore((data) => {
    const recipients = input.recipients ?? [];
    const skippedRecipients = input.skippedRecipients ?? [];
    const plan: SendPlan = {
      id: createToken("plan"),
      campaignBrief: input.campaignBrief,
      senderIdentity: input.senderIdentity,
      validRecipientCount: input.validRecipientCount ?? recipients.length,
      recipients,
      skippedRecipients,
      finalMessage: input.finalMessage,
      mediaReference: normalizeMedia(input.mediaReference),
      decision: "pending",
      createdAt: now()
    };

    data.sendPlans.unshift(plan);

    return {
      decision: "pending",
      sendPlanId: plan.id,
      reviewUrl: `/`,
      sendAuthorizationToken: null,
      expiresAt: null
    };
  });
}

export async function approveSendPlan(input: { sendPlanId: string; decision: "approved" | "rejected" }) {
  return updateStore((data) => {
    const plan = data.sendPlans.find((candidate) => candidate.id === input.sendPlanId);
    if (!plan) {
      throw new Error("Send plan not found");
    }

    plan.decision = input.decision;
    plan.decidedAt = now();

    if (input.decision === "rejected") {
      return {
        decision: "rejected",
        sendAuthorizationToken: null,
        expiresAt: null
      };
    }

    const token = createToken("token");
    const expiresAt = expiresInMinutes(tokenTtlMinutes);
    const payloadHash = hashValue(buildPlanPayload({
      senderIdentity: plan.senderIdentity,
      recipients: plan.recipients,
      skippedRecipients: plan.skippedRecipients,
      finalMessage: plan.finalMessage,
      mediaReference: plan.mediaReference
    }));

    plan.sendAuthorizationToken = token;
    plan.payloadHash = payloadHash;
    plan.expiresAt = expiresAt;
    data.authorizations.push({
      token,
      payloadHash,
      expiresAt,
      sentRecipientIds: [],
      createdAt: now(),
      sendPlanId: plan.id
    });

    return {
      decision: "approved",
      sendAuthorizationToken: token,
      expiresAt
    };
  });
}

export async function sendWhatsAppMessage(input: {
  sendAuthorizationToken: string;
  senderIdentity: string;
  recipient: Recipient;
  message: string;
  mediaReference?: string | null;
}): Promise<WhatsAppSendResult> {
  const mediaReference = normalizeMedia(input.mediaReference);
  const data = await readStore();
  const authorization = data.authorizations.find(
    (candidate) => candidate.token === input.sendAuthorizationToken
  );

  if (!authorization) {
    return { status: "failed", error: "Missing or invalid send authorization token" };
  }

  if (authorization.usedAt) {
    return { status: "failed", error: "Send authorization token has already been fully used" };
  }

  if (new Date(authorization.expiresAt).getTime() <= Date.now()) {
    return { status: "failed", error: "Send authorization token has expired" };
  }

  const plan = data.sendPlans.find((candidate) => candidate.id === authorization.sendPlanId);
  if (!plan || plan.decision !== "approved") {
    return { status: "failed", error: "Approved send plan was not found" };
  }

  const approvedRecipient = plan.recipients.find(
    (recipient) =>
      recipient.recipientId === input.recipient.recipientId && recipient.contactId === input.recipient.contactId
  );
  if (!approvedRecipient) {
    return { status: "failed", error: "Recipient was not part of the approved send plan" };
  }

  if (authorization.sentRecipientIds?.includes(input.recipient.recipientId)) {
    return { status: "failed", error: "Recipient has already been sent with this authorization token" };
  }

  const approvedPlanHash = hashValue(buildPlanPayload({
    senderIdentity: plan.senderIdentity,
    recipients: plan.recipients,
    skippedRecipients: plan.skippedRecipients,
    finalMessage: plan.finalMessage,
    mediaReference: plan.mediaReference
  }));

  if (
    authorization.payloadHash !== approvedPlanHash ||
    plan.senderIdentity !== input.senderIdentity ||
    plan.finalMessage !== input.message ||
    plan.mediaReference !== mediaReference
  ) {
    return { status: "failed", error: "Approved payload hash does not match this send request" };
  }

  const result = await sendWithConfiguredAdapter({
    senderIdentity: input.senderIdentity,
    recipient: input.recipient,
    message: input.message,
    mediaReference
  });

  await updateStore((mutable) => {
    const mutableAuth = mutable.authorizations.find(
      (candidate) => candidate.token === input.sendAuthorizationToken
    );
    if (mutableAuth && result.status === "sent") {
      mutableAuth.sentRecipientIds = Array.from(
        new Set([...(mutableAuth.sentRecipientIds ?? []), input.recipient.recipientId])
      );

      if (mutableAuth.sentRecipientIds.length >= plan.recipients.length) {
        mutableAuth.usedAt = now();
      }
    }

    if (result.status === "sent" && result.threadId) {
      const existingThread = mutable.threads.find((thread) => thread.threadId === result.threadId);
      if (existingThread) {
        existingThread.messages.push({
          role: "business",
          content: input.message,
          createdAt: now(),
          messageId: result.messageId
        });
        existingThread.updatedAt = now();
      } else {
        mutable.threads.push({
          threadId: result.threadId,
          contactId: input.recipient.contactId,
          recipientId: input.recipient.recipientId,
          createdAt: now(),
          updatedAt: now(),
          messages: [
            {
              role: "business",
              content: input.message,
              createdAt: now(),
              messageId: result.messageId
            }
          ]
        });
      }
    }
  });

  return result;
}

export async function listRecentReplies(input: {
  threadId?: string;
  contactId?: string;
  campaignId?: string;
  limit?: number;
}) {
  const data = await readStore();
  const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const threads = data.threads.filter((thread) => {
    if (input.threadId) {
      return thread.threadId === input.threadId;
    }

    if (input.contactId) {
      return thread.contactId === input.contactId;
    }

    return true;
  });

  const messages = threads
    .flatMap((thread) =>
      thread.messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        threadId: thread.threadId
      }))
    )
    .filter((message) => message.role === "customer")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return { messages };
}

export async function recordFollowUp(input: {
  threadId: string;
  contactId: string;
  status: string;
  summary: string;
  nextAction?: string;
}) {
  return updateStore((data) => {
    const followUp: FollowUp = {
      id: createToken("followup"),
      threadId: input.threadId,
      contactId: input.contactId,
      status: input.status,
      summary: input.summary,
      nextAction: input.nextAction,
      createdAt: now()
    };

    data.followUps.unshift(followUp);
    return { ok: true };
  });
}

export async function resolveRecipients(contactIds: string[]) {
  const data = await readStore();
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const skippedRecipients: SkippedRecipient[] = [];

  for (const contactId of contactIds) {
    const contact = data.contacts.find((candidate) => candidate.contactId === contactId);
    if (!contact) {
      skippedRecipients.push({ recipientId: contactId, reason: "Contact not found" });
      continue;
    }

    const skippedReason = getSkippedReason(contact);
    if (skippedReason) {
      skippedRecipients.push({
        recipientId: contact.contactId,
        name: contact.name,
        reason: skippedReason
      });
      continue;
    }

    const recipient = toRecipient(contact);
    if (!recipient) {
      skippedRecipients.push({
        recipientId: contact.contactId,
        name: contact.name,
        reason: "Missing WhatsApp number"
      });
      continue;
    }

    if (seen.has(recipient.recipientId)) {
      skippedRecipients.push({
        recipientId: recipient.recipientId,
        name: recipient.name,
        reason: "Duplicate WhatsApp recipient"
      });
      continue;
    }

    seen.add(recipient.recipientId);
    recipients.push(recipient);
  }

  return { recipients, skippedRecipients };
}

export async function handleTool(tool: ToolName, input: Record<string, unknown>) {
  switch (tool) {
    case "search_contacts":
      return searchContacts({ query: asText(input.query), limit: Number(input.limit) || undefined });
    case "get_contact":
      return getContact({ contactId: asText(input.contactId) });
    case "review_outreach_draft":
      return reviewOutreachDraft({
        campaignBrief: asText(input.campaignBrief),
        audienceSummary: asText(input.audienceSummary),
        draftMessage: asText(input.draftMessage),
        mediaReference: normalizeMedia(input.mediaReference)
      });
    case "review_send_plan":
      return reviewSendPlan({
        campaignBrief: asText(input.campaignBrief),
        senderIdentity: asText(input.senderIdentity),
        validRecipientCount: Number(input.validRecipientCount) || undefined,
        recipients: Array.isArray(input.recipients) ? (input.recipients as Recipient[]) : [],
        skippedRecipients: Array.isArray(input.skippedRecipients)
          ? (input.skippedRecipients as SkippedRecipient[])
          : [],
        finalMessage: asText(input.finalMessage),
        mediaReference: normalizeMedia(input.mediaReference)
      });
    case "send_whatsapp_message":
      return sendWhatsAppMessage({
        sendAuthorizationToken: asText(input.sendAuthorizationToken),
        senderIdentity: asText(input.senderIdentity),
        recipient: input.recipient as Recipient,
        message: asText(input.message),
        mediaReference: normalizeMedia(input.mediaReference)
      });
    case "list_recent_replies":
      return listRecentReplies({
        threadId: asText(input.threadId) || undefined,
        contactId: asText(input.contactId) || undefined,
        campaignId: asText(input.campaignId) || undefined,
        limit: Number(input.limit) || undefined
      });
    case "record_follow_up":
      return recordFollowUp({
        threadId: asText(input.threadId),
        contactId: asText(input.contactId),
        status: asText(input.status),
        summary: asText(input.summary),
        nextAction: asText(input.nextAction) || undefined
      });
    default:
      throw new Error(`Unknown tool: ${tool satisfies never}`);
  }
}
