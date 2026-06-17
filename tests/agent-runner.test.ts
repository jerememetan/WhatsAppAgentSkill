import { describe, expect, it } from "vitest";
import {
  buildDraftApprovalStep,
  buildDraftRejectionStep,
  buildInitialAgentStep,
  buildBlockedNoRecipientsMessage,
  buildApprovedPayload,
  buildDraftMessage,
  buildSendPlanPreview,
  extractPhoneNumbers
} from "@/lib/agent-runner";

describe("agent runner", () => {
  it("extracts unique plus-prefixed phone numbers from a prompt", () => {
    expect(extractPhoneNumbers("do a whatsapp outreach for +8123 and +81234 and +8123")).toEqual([
      "+8123",
      "+81234"
    ]);
  });

  it("builds a short outreach draft", () => {
    expect(buildDraftMessage()).toContain("Would it be worth");
  });

  it("builds the approved export payload from approved inputs", () => {
    expect(
      buildApprovedPayload({
        senderIdentity: "+6591240000",
        recipients: ["+8123", "+81234"],
        message:
          "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?"
      })
    ).toEqual({
      senderIdentity: "+6591240000",
      recipients: [{ phoneNumber: "+8123" }, { phoneNumber: "+81234" }],
      message:
        "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?",
      approved: true
    });
  });

  it("builds a clear blocked message when no phone numbers are found", () => {
    expect(buildBlockedNoRecipientsMessage()).toBe(
      "I could not find any phone numbers in that request."
    );
  });

  it("builds a send-plan preview that preserves the approved draft text", () => {
    expect(
      buildSendPlanPreview({
        senderIdentity: "+6591240000",
        recipients: ["+8123", "+81234"],
        message: "Custom approved copy"
      })
    ).toEqual({
      senderIdentity: "+6591240000",
      recipients: ["+8123", "+81234"],
      message: "Custom approved copy"
    });
  });

  it("builds a blocked initial step when no phone numbers are found", () => {
    expect(buildInitialAgentStep("do a whatsapp outreach for the sales leads")).toEqual({
      status: "blocked_no_recipients",
      chatMessages: [
        "User: do a whatsapp outreach for the sales leads",
        "Agent: I could not find any phone numbers in that request."
      ]
    });
  });

  it("builds a draft-ready initial step when phone numbers are found", () => {
    expect(buildInitialAgentStep("do a whatsapp outreach for +8123 and +81234")).toEqual({
      status: "awaiting_draft_approval",
      recipients: ["+8123", "+81234"],
      draftMessage:
        "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?",
      chatMessages: [
        "User: do a whatsapp outreach for +8123 and +81234",
        "Agent: I found 2 recipient(s) and prepared a draft."
      ]
    });
  });

  it("builds a send-plan-ready step after draft approval", () => {
    expect(
      buildDraftApprovalStep({
        senderIdentity: "+6591240000",
        recipients: ["+8123", "+81234"],
        approvedMessage: "Custom approved copy"
      })
    ).toEqual({
      status: "awaiting_send_plan_approval",
      sendPlanPreview: {
        senderIdentity: "+6591240000",
        recipients: ["+8123", "+81234"],
        message: "Custom approved copy"
      },
      chatMessages: ["Agent: Draft approved. Preparing send plan."]
    });
  });

  it("builds a stopped step after draft rejection", () => {
    expect(buildDraftRejectionStep()).toEqual({
      status: "draft_rejected",
      chatMessages: ["Agent: Draft rejected."]
    });
  });
});
