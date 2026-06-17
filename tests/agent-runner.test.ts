import { describe, expect, it } from "vitest";
import {
  buildApprovedPayload,
  buildDraftMessage,
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
});
