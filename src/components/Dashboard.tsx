"use client";

import { useState } from "react";
import {
  buildDraftApprovalStep,
  buildDraftRejectionStep,
  buildInitialAgentStep
} from "@/lib/agent-runner";
import type { StoreData } from "@/lib/types";

type Props = {
  initialData: StoreData;
};

export function Dashboard({ initialData }: Props) {
  const [senderIdentity, setSenderIdentity] = useState("+6591240000");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState<
    | "idle"
    | "blocked_no_recipients"
    | "awaiting_draft_approval"
    | "awaiting_send_plan_approval"
    | "draft_rejected"
  >("idle");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [sendPlanPreview, setSendPlanPreview] = useState<{
    senderIdentity: string;
    recipients: string[];
    message: string;
  } | null>(null);

  function handleSend() {
    const step = buildInitialAgentStep(prompt);
    setMessages(step.chatMessages);
    setStatus(step.status);

    if (step.status === "awaiting_draft_approval") {
      setRecipients(step.recipients);
      setDraftMessage(step.draftMessage);
      return;
    }

    setRecipients([]);
    setDraftMessage("");
    setSendPlanPreview(null);
  }

  function handleApproveDraft() {
    const step = buildDraftApprovalStep({
      senderIdentity,
      recipients,
      approvedMessage: draftMessage
    });

    setMessages((current) => [...current, ...step.chatMessages]);
    setStatus(step.status);
    setSendPlanPreview(step.sendPlanPreview);
  }

  function handleRejectDraft() {
    const step = buildDraftRejectionStep();
    setMessages((current) => [...current, ...step.chatMessages]);
    setStatus(step.status);
    setSendPlanPreview(null);
  }

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Step 1 MVP</span>
        <h1>WhatsApp Skill Harness</h1>
        <p>A chat-first demo for skill-driven outreach approvals and JSON export.</p>
      </section>

      <div className="grid">
        <section className="card stack">
          <h2>Agent Setup</h2>
          <label className="field">
            <span>Sender identity</span>
            <input value={senderIdentity} onChange={(event) => setSenderIdentity(event.target.value)} />
          </label>
          <label className="field">
            <span>Chat with agent</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <button className="button" onClick={handleSend}>
            Send
          </button>
        </section>

        <section className="card stack">
          <h2>Chat</h2>
          {messages.length ? (
            <ul className="list">
              {messages.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No messages yet.</p>
          )}
        </section>

        {status === "awaiting_draft_approval" ? (
          <section className="card stack">
            <h2>Draft Review</h2>
            <p className="muted">{recipients.length} recipient(s) resolved from the prompt.</p>
            <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} />
            <div className="row">
              <button className="button" onClick={handleApproveDraft}>
                Approve Draft
              </button>
              <button className="button danger" onClick={handleRejectDraft}>
                Reject
              </button>
            </div>
          </section>
        ) : null}

        {status === "awaiting_send_plan_approval" && sendPlanPreview ? (
          <section className="card stack">
            <h2>Send Plan Review</h2>
            <pre>{JSON.stringify(sendPlanPreview, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
