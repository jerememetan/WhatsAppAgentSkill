import type { Recipient, WhatsAppSendResult } from "./types";

export type WhatsAppAdapterInput = {
  senderIdentity: string;
  recipient: Recipient;
  message: string;
  mediaReference: string | null;
};

type GraphMessageResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

export async function sendViaMockAdapter(input: WhatsAppAdapterInput): Promise<WhatsAppSendResult> {
  return {
    status: "sent",
    threadId: `thread_${input.recipient.contactId}`,
    messageId: `mock_${Date.now()}_${input.recipient.contactId}`,
    error: null
  };
}

export async function sendViaCloudApi(input: WhatsAppAdapterInput): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

  if (!token || !phoneNumberId) {
    return {
      status: "failed",
      error: "WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID."
    };
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.recipient.whatsapp,
      type: "text",
      text: {
        preview_url: false,
        body: input.message
      }
    })
  });

  const json = (await response.json().catch(() => ({}))) as GraphMessageResponse;

  if (!response.ok) {
    return {
      status: "failed",
      error: json.error?.message ?? `WhatsApp Cloud API returned ${response.status}`
    };
  }

  return {
    status: "sent",
    threadId: `thread_${input.recipient.contactId}`,
    messageId: json.messages?.[0]?.id,
    error: null
  };
}

export async function sendWithConfiguredAdapter(input: WhatsAppAdapterInput): Promise<WhatsAppSendResult> {
  if (process.env.WHATSAPP_TRANSPORT === "cloud") {
    return sendViaCloudApi(input);
  }

  return sendViaMockAdapter(input);
}
