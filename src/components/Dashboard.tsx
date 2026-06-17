"use client";

import { useMemo, useState } from "react";
import type { StoreData } from "@/lib/types";

type SendResult = {
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    recipient: { name: string; whatsapp: string };
    status: string;
    messageId?: string;
    error: string | null;
  }>;
};

type Props = {
  initialData: StoreData;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }

  return json;
}

export function Dashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [campaignBrief, setCampaignBrief] = useState("Introduce our WhatsApp outreach workflow");
  const [audienceSummary, setAudienceSummary] = useState("Active contacts with WhatsApp numbers");
  const [senderIdentity, setSenderIdentity] = useState("+6591240000");
  const [draftMessage, setDraftMessage] = useState(
    "Hi, I’m reaching out because we help teams run safer WhatsApp outreach with human approvals. Would it be worth a quick look?"
  );
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(["contact_001", "contact_002"]);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestDraft = data.draftReviews[0];
  const latestPlan = data.sendPlans[0];
  const approvedDraft = data.draftReviews.find((review) => review.decision === "approved");

  const validContacts = useMemo(
    () => data.contacts.filter((contact) => !contact.doNotContact && contact.whatsapp),
    [data.contacts]
  );

  async function refresh() {
    const response = await fetch("/api/store", { cache: "no-store" });
    setData((await response.json()) as StoreData);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Mock sends by default</span>
        <h1>WhatsApp Outreach MVP</h1>
        <p>
          A minimal host app for the sales WhatsApp outreach contract. Every send is gated by
          draft review, send-plan review, and a scoped payload hash.
        </p>
      </section>

      {error ? <div className="card danger-text">Error: {error}</div> : null}

      <div className="grid">
        <section className="card stack">
          <h2>1. Contacts</h2>
          <p className="muted">Pick contacts for a simple local send plan. Opted-out contacts are shown but skipped.</p>
          <ul className="list">
            {data.contacts.map((contact) => (
              <li key={contact.contactId}>
                <label className="row">
                  <input
                    checked={selectedContactIds.includes(contact.contactId)}
                    disabled={Boolean(contact.doNotContact || !contact.whatsapp)}
                    onChange={(event) => {
                      setSelectedContactIds((current) =>
                        event.target.checked
                          ? [...current, contact.contactId]
                          : current.filter((id) => id !== contact.contactId)
                      );
                    }}
                    style={{ width: "auto" }}
                    type="checkbox"
                  />
                  <strong>{contact.name}</strong>
                  <span className="muted">{contact.companyName}</span>
                </label>
                <div className="muted">
                  {contact.whatsapp ?? "No WhatsApp"} {contact.doNotContact ? " - do not contact" : ""}
                </div>
              </li>
            ))}
          </ul>
          <p className="muted">{validContacts.length} locally sendable seed contacts.</p>
        </section>

        <section className="card stack">
          <h2>2. Draft Review</h2>
          <label className="field">
            <span>Campaign brief</span>
            <input value={campaignBrief} onChange={(event) => setCampaignBrief(event.target.value)} />
          </label>
          <label className="field">
            <span>Audience summary</span>
            <input value={audienceSummary} onChange={(event) => setAudienceSummary(event.target.value)} />
          </label>
          <label className="field">
            <span>Draft message</span>
            <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} />
          </label>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await postJson("/api/tools/review_outreach_draft", {
                  campaignBrief,
                  audienceSummary,
                  draftMessage,
                  mediaReference: null
                });
              })
            }
          >
            Submit Draft For Review
          </button>
          {latestDraft ? (
            <div className="stack">
              <p>
                Latest draft: <strong>{latestDraft.decision}</strong>
              </p>
              <textarea
                value={latestDraft.finalMessage ?? latestDraft.draftMessage}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    draftReviews: current.draftReviews.map((review) =>
                      review.id === latestDraft.id ? { ...review, finalMessage: event.target.value } : review
                    )
                  }))
                }
              />
              <div className="row">
                <button
                  className="button"
                  disabled={busy || latestDraft.decision !== "pending"}
                  onClick={() =>
                    run(async () => {
                      await postJson("/api/store", {
                        action: "approveDraft",
                        reviewId: latestDraft.id,
                        decision: "approved",
                        finalMessage: latestDraft.finalMessage ?? latestDraft.draftMessage
                      });
                    })
                  }
                >
                  Approve Draft
                </button>
                <button
                  className="button danger"
                  disabled={busy || latestDraft.decision !== "pending"}
                  onClick={() =>
                    run(async () => {
                      await postJson("/api/store", {
                        action: "approveDraft",
                        reviewId: latestDraft.id,
                        decision: "rejected"
                      });
                    })
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card stack">
          <h2>3. Send Plan Review</h2>
          <label className="field">
            <span>Sender identity</span>
            <input value={senderIdentity} onChange={(event) => setSenderIdentity(event.target.value)} />
          </label>
          <button
            className="button"
            disabled={busy || !approvedDraft}
            onClick={() =>
              run(async () => {
                await postJson("/api/store", {
                  action: "createSendPlanFromContacts",
                  campaignBrief,
                  senderIdentity,
                  contactIds: selectedContactIds,
                  finalMessage: approvedDraft?.finalMessage ?? approvedDraft?.draftMessage,
                  mediaReference: null
                });
              })
            }
          >
            Create Send Plan
          </button>
          {latestPlan ? (
            <div className="stack">
              <p>
                Latest send plan: <strong>{latestPlan.decision}</strong>
              </p>
              <p className="muted">
                {latestPlan.recipients.length} recipients, {latestPlan.skippedRecipients.length} skipped
              </p>
              <pre>{JSON.stringify(latestPlan, null, 2)}</pre>
              <div className="row">
                <button
                  className="button"
                  disabled={busy || latestPlan.decision !== "pending"}
                  onClick={() =>
                    run(async () => {
                      await postJson("/api/store", {
                        action: "approveSendPlan",
                        sendPlanId: latestPlan.id,
                        decision: "approved"
                      });
                    })
                  }
                >
                  Approve Send Plan
                </button>
                <button
                  className="button danger"
                  disabled={busy || latestPlan.decision !== "pending"}
                  onClick={() =>
                    run(async () => {
                      await postJson("/api/store", {
                        action: "approveSendPlan",
                        sendPlanId: latestPlan.id,
                        decision: "rejected"
                      });
                    })
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card stack">
          <h2>4. Approved Send</h2>
          <p className="muted">
            Sending requires the approved token and exact payload hash. With default env, this records mock
            WhatsApp message IDs only.
          </p>
          <button
            className="button"
            disabled={busy || latestPlan?.decision !== "approved" || !latestPlan.sendAuthorizationToken}
            onClick={() =>
              run(async () => {
                const result = await postJson<SendResult>("/api/store", {
                  action: "sendPlan",
                  sendPlanId: latestPlan?.id
                });
                setSendResult(result);
              })
            }
          >
            Send Approved Plan
          </button>
          {sendResult ? <pre>{JSON.stringify(sendResult, null, 2)}</pre> : null}
        </section>
      </div>
    </main>
  );
}
