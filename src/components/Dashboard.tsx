"use client";

import { useState } from "react";
import type { StoreData } from "@/lib/types";

type Props = {
  initialData: StoreData;
};

export function Dashboard({ initialData }: Props) {
  const [senderIdentity, setSenderIdentity] = useState("+6591240000");
  const [prompt, setPrompt] = useState("");
  const [chatLog] = useState<string[]>([]);

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
          <button className="button">Send</button>
        </section>

        <section className="card stack">
          <h2>Chat</h2>
          {chatLog.length ? (
            <ul className="list">
              {chatLog.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No messages yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
