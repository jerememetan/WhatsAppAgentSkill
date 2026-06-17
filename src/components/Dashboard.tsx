"use client";

import { useState } from "react";
import {
  buildDraftApprovalStep,
  buildDraftRejectionStep,
  buildInitialAgentStep,
  buildSendPlanApprovalStep,
  buildSendPlanRejectionStep
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
    | "approved_json_ready"
    | "send_plan_rejected"
  >("idle");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [sendPlanPreview, setSendPlanPreview] = useState<{
    senderIdentity: string;
    recipients: string[];
    message: string;
  } | null>(null);
  const [approvedPayload, setApprovedPayload] = useState<object | null>(null);

  function handleSend() {
    const step = buildInitialAgentStep(prompt);
    setMessages(step.chatMessages);
    setStatus(step.status);

    if (step.status === "awaiting_draft_approval") {
      setRecipients(step.recipients);
      setDraftMessage(step.draftMessage);
      setApprovedPayload(null);
      return;
    }

    setRecipients([]);
    setDraftMessage("");
    setSendPlanPreview(null);
    setApprovedPayload(null);
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
    setApprovedPayload(null);
  }

  function handleApproveSendPlan() {
    const step = buildSendPlanApprovalStep({
      senderIdentity,
      recipients,
      approvedMessage: draftMessage
    });

    setMessages((current) => [...current, ...step.chatMessages]);
    setStatus(step.status);
    setApprovedPayload(step.approvedPayload);
  }

  function handleRejectSendPlan() {
    const step = buildSendPlanRejectionStep();
    setMessages((current) => [...current, ...step.chatMessages]);
    setStatus(step.status);
    setApprovedPayload(null);
  }

  const conversation = messages.map((message, index) => {
    const isUser = message.startsWith("User:");
    return {
      id: `${message}-${index}`,
      role: isUser ? "user" : "agent",
      body: message.replace(/^(User|Agent):\s*/, "")
    };
  });

  return (
    <main className="page">
      <section className="chat-shell">
        <header className="chat-topbar">
          <div>
            <span className="pill">Step 1 MVP</span>
            <h1>WhatsApp Skill Harness</h1>
            <p className="muted">A chat-first demo for skill-driven outreach approvals and JSON export.</p>
          </div>
          <label className="field sender-field">
            <span>Sender identity</span>
            <input value={senderIdentity} onChange={(event) => setSenderIdentity(event.target.value)} />
          </label>
        </header>

        <section className="chat-thread" aria-label="Chat">
          {conversation.length ? (
            <>
              {conversation.map((entry) => (
                <article
                  key={entry.id}
                  className={`message-row ${entry.role === "user" ? "message-row-user" : "message-row-agent"}`}
                >
                  <div className="message-meta">{entry.role === "user" ? "You" : "Agent"}</div>
                  <div className={`message-bubble ${entry.role === "user" ? "message-bubble-user" : "message-bubble-agent"}`}>
                    {entry.body}
                  </div>
                </article>
              ))}

              {status === "awaiting_draft_approval" ? (
                <article className="message-row message-row-agent">
                  <div className="message-meta">Agent</div>
                  <section className="approval-card">
                    <div className="approval-card-header">
                      <h2>Draft Review</h2>
                      <span className="approval-tag">{recipients.length} recipients</span>
                    </div>
                    <p className="muted">Review and edit the draft before moving to the send plan.</p>
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
                </article>
              ) : null}

              {status === "awaiting_send_plan_approval" && sendPlanPreview ? (
                <article className="message-row message-row-agent">
                  <div className="message-meta">Agent</div>
                  <section className="approval-card">
                    <div className="approval-card-header">
                      <h2>Send Plan Review</h2>
                      <span className="approval-tag">Ready to export</span>
                    </div>
                    <pre>{JSON.stringify(sendPlanPreview, null, 2)}</pre>
                    <div className="row">
                      <button className="button" onClick={handleApproveSendPlan}>
                        Approve Send Plan
                      </button>
                      <button className="button danger" onClick={handleRejectSendPlan}>
                        Reject
                      </button>
                    </div>
                  </section>
                </article>
              ) : null}

              {status === "approved_json_ready" && approvedPayload ? (
                <article className="message-row message-row-agent">
                  <div className="message-meta">Agent</div>
                  <section className="approval-card">
                    <div className="approval-card-header">
                      <h2>Approved JSON</h2>
                      <span className="approval-tag success-tag">Ready</span>
                    </div>
                    <pre>{JSON.stringify(approvedPayload, null, 2)}</pre>
                  </section>
                </article>
              ) : null}
            </>
          ) : (
            <div className="empty-thread">
              <span className="pill">Agent</span>
              <p>Chat with agent</p>
              <p className="muted">Try: do a whatsapp outreach for +8123 and +81234</p>
            </div>
          )}
        </section>

        <footer className="composer">
          <label className="composer-field">
            <span className="sr-only">Chat with agent</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Chat with agent"
            />
          </label>
          <button className="button composer-send" onClick={handleSend}>
            Send
          </button>
        </footer>
      </section>
    </main>
  );
}
