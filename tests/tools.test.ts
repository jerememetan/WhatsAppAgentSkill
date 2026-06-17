import { rm } from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  approveDraftReview,
  approveSendPlan,
  resolveRecipients,
  reviewOutreachDraft,
  reviewSendPlan,
  searchContacts,
  sendWhatsAppMessage
} from "@/lib/tools";
import { readStore } from "@/lib/store";

const storePath = path.join(process.cwd(), "data", "store.json");

beforeEach(async () => {
  process.env.WHATSAPP_TRANSPORT = "mock";
  await rm(storePath, { force: true });
});

describe("sales WhatsApp outreach tools", () => {
  it("searches local contacts with sendability metadata", async () => {
    const result = await searchContacts({ query: "acme", limit: 10 });

    expect(result.contacts).toEqual([
      expect.objectContaining({
        contactId: "contact_001",
        name: "Alex Tan",
        whatsapp: "+6591111111",
        doNotContact: false
      })
    ]);
  });

  it("rejects sends without an approved authorization token", async () => {
    const { recipients } = await resolveRecipients(["contact_001"]);

    await expect(
      sendWhatsAppMessage({
        sendAuthorizationToken: "token_missing",
        senderIdentity: "+6591240000",
        recipient: recipients[0],
        message: "Hello",
        mediaReference: null
      })
    ).resolves.toMatchObject({
      status: "failed",
      error: "Missing or invalid send authorization token"
    });
  });

  it("sends through the mock adapter only after draft and send-plan approval", async () => {
    const draft = await reviewOutreachDraft({
      campaignBrief: "Introduce workflow",
      audienceSummary: "Two active contacts",
      draftMessage: "Hi, would it be worth a quick look?",
      mediaReference: null
    });

    const approvedDraft = await approveDraftReview({
      reviewId: draft.reviewId,
      decision: "approved",
      finalMessage: "Hi, would it be worth a quick look?"
    });

    const { recipients, skippedRecipients } = await resolveRecipients([
      "contact_001",
      "contact_002",
      "contact_003"
    ]);

    expect(recipients).toHaveLength(2);
    expect(skippedRecipients).toEqual([
      expect.objectContaining({ recipientId: "contact_003", reason: "Do not contact" })
    ]);

    const pendingPlan = await reviewSendPlan({
      campaignBrief: "Introduce workflow",
      senderIdentity: "+6591240000",
      validRecipientCount: recipients.length,
      recipients,
      skippedRecipients,
      finalMessage: approvedDraft.finalMessage!,
      mediaReference: null
    });

    const approvedPlan = await approveSendPlan({
      sendPlanId: pendingPlan.sendPlanId,
      decision: "approved"
    });

    const firstSend = await sendWhatsAppMessage({
      sendAuthorizationToken: approvedPlan.sendAuthorizationToken!,
      senderIdentity: "+6591240000",
      recipient: recipients[0],
      message: approvedDraft.finalMessage!,
      mediaReference: null
    });

    expect(firstSend).toMatchObject({
      status: "sent",
      error: null
    });
    expect(firstSend.messageId).toContain("mock_");

    const secondSend = await sendWhatsAppMessage({
      sendAuthorizationToken: approvedPlan.sendAuthorizationToken!,
      senderIdentity: "+6591240000",
      recipient: recipients[1],
      message: approvedDraft.finalMessage!,
      mediaReference: null
    });

    expect(secondSend.status).toBe("sent");

    const data = await readStore();
    expect(data.authorizations[0].usedAt).toBeDefined();
    expect(data.followUps).toEqual([]);
  });

  it("rejects a tampered message after send-plan approval", async () => {
    const { recipients, skippedRecipients } = await resolveRecipients(["contact_001"]);
    const pendingPlan = await reviewSendPlan({
      campaignBrief: "Introduce workflow",
      senderIdentity: "+6591240000",
      validRecipientCount: recipients.length,
      recipients,
      skippedRecipients,
      finalMessage: "Approved copy",
      mediaReference: null
    });
    const approvedPlan = await approveSendPlan({
      sendPlanId: pendingPlan.sendPlanId,
      decision: "approved"
    });

    await expect(
      sendWhatsAppMessage({
        sendAuthorizationToken: approvedPlan.sendAuthorizationToken!,
        senderIdentity: "+6591240000",
        recipient: recipients[0],
        message: "Changed copy",
        mediaReference: null
      })
    ).resolves.toMatchObject({
      status: "failed",
      error: "Approved payload hash does not match this send request"
    });
  });
});
