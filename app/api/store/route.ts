import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import {
  approveDraftReview,
  approveSendPlan,
  recordFollowUp,
  resolveRecipients,
  reviewSendPlan,
  sendWhatsAppMessage
} from "@/lib/tools";

export async function GET() {
  const data = await readStore();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "approveDraft") {
      return NextResponse.json(
        await approveDraftReview({
          reviewId: String(body.reviewId ?? ""),
          decision: body.decision === "rejected" ? "rejected" : "approved",
          finalMessage: typeof body.finalMessage === "string" ? body.finalMessage : undefined
        })
      );
    }

    if (action === "createSendPlanFromContacts") {
      const contactIds = Array.isArray(body.contactIds) ? body.contactIds.map(String) : [];
      const { recipients, skippedRecipients } = await resolveRecipients(contactIds);

      return NextResponse.json(
        await reviewSendPlan({
          campaignBrief: String(body.campaignBrief ?? ""),
          senderIdentity: String(body.senderIdentity ?? ""),
          validRecipientCount: recipients.length,
          recipients,
          skippedRecipients,
          finalMessage: String(body.finalMessage ?? ""),
          mediaReference: typeof body.mediaReference === "string" ? body.mediaReference : null
        })
      );
    }

    if (action === "approveSendPlan") {
      return NextResponse.json(
        await approveSendPlan({
          sendPlanId: String(body.sendPlanId ?? ""),
          decision: body.decision === "rejected" ? "rejected" : "approved"
        })
      );
    }

    if (action === "sendPlan") {
      const data = await readStore();
      const sendPlanId = String(body.sendPlanId ?? "");
      const plan = data.sendPlans.find((candidate) => candidate.id === sendPlanId);

      if (!plan?.sendAuthorizationToken) {
        return NextResponse.json({ error: "Approved send plan with token not found" }, { status: 400 });
      }

      const results = [];
      for (const recipient of plan.recipients) {
        const result = await sendWhatsAppMessage({
          sendAuthorizationToken: plan.sendAuthorizationToken,
          senderIdentity: plan.senderIdentity,
          recipient,
          message: plan.finalMessage,
          mediaReference: plan.mediaReference
        });
        results.push({ recipient, ...result });

        if (result.status === "sent" && result.threadId) {
          await recordFollowUp({
            threadId: result.threadId,
            contactId: recipient.contactId,
            status: "sent",
            summary: `Sent approved outreach to ${recipient.name}`,
            nextAction: "Watch for reply"
          });
        }
      }

      return NextResponse.json({
        sent: results.filter((result) => result.status === "sent").length,
        failed: results.filter((result) => result.status === "failed").length,
        skipped: plan.skippedRecipients.length,
        results
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Store action failed" },
      { status: 400 }
    );
  }
}
