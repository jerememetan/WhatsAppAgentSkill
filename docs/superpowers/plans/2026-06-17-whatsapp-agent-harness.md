# WhatsApp Skill Harness Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chat-style agent demo that takes a user outreach request, shows draft and send-plan approval cards, and outputs approved JSON instead of sending WhatsApp messages.

**Architecture:** Keep the implementation intentionally small. Put the minimal workflow logic in `src/lib/agent-runner.ts`, rewrite `src/components/Dashboard.tsx` around a chat + approval flow, and add only a few focused tests for parsing and payload shaping.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest.

---

## File Structure

- Modify: `src/components/Dashboard.tsx`
- Create: `src/lib/agent-runner.ts`
- Create: `tests/agent-runner.test.ts`

## Implementation Notes

- Do not use real WhatsApp transport in this step.
- Do not use CRM/contact lookup in this step.
- Do not add reply suggestion UI in this step.
- Keep the UI on one page.
- Only split out extra files if necessary for clarity.

### Task 1: Add minimal runner helpers

**Files:**
- Create: `src/lib/agent-runner.ts`
- Create: `tests/agent-runner.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  extractPhoneNumbers,
  buildDraftMessage,
  buildApprovedPayload
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
        message: "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?"
      })
    ).toEqual({
      senderIdentity: "+6591240000",
      recipients: [{ phoneNumber: "+8123" }, { phoneNumber: "+81234" }],
      message: "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?",
      approved: true
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `@/lib/agent-runner`.

- [x] **Step 3: Write minimal implementation**

```typescript
export function extractPhoneNumbers(prompt: string): string[] {
  const matches = prompt.match(/\+\d+/g) ?? [];
  return Array.from(new Set(matches));
}

export function buildDraftMessage(): string {
  return "Hi, I’m reaching out because we help teams run outreach more safely. Would it be worth a quick look?";
}

export function buildApprovedPayload(input: {
  senderIdentity: string;
  recipients: string[];
  message: string;
}) {
  return {
    senderIdentity: input.senderIdentity,
    recipients: input.recipients.map((phoneNumber) => ({ phoneNumber })),
    message: input.message,
    approved: true
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "feat: add minimal whatsapp skill runner helpers"
```

### Task 2: Cover the blocked no-recipient case

**Files:**
- Modify: `src/lib/agent-runner.ts`
- Modify: `tests/agent-runner.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { extractPhoneNumbers } from "@/lib/agent-runner";

describe("agent runner empty-recipient handling", () => {
  it("returns no recipients when the prompt contains no plus-prefixed numbers", () => {
    expect(extractPhoneNumbers("do a whatsapp outreach for the sales leads")).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL if the parser incorrectly returns values for non-phone text.

- [x] **Step 3: Write minimal implementation**

```typescript
export function extractPhoneNumbers(prompt: string): string[] {
  const matches = prompt.match(/\+\d+/g) ?? [];
  return Array.from(new Set(matches));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "test: cover missing recipient extraction case"
```

### Task 3: Rewrite the dashboard into the Step 1 chat flow

**Files:**
- Modify: `src/components/Dashboard.tsx`
commit -m "test: cover missing recipient extraction case
- [x] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildApprovedPayload } from "@/lib/agent-runner";

describe("approved payload flow", () => {
  it("preserves the edited draft text into the final JSON payload", () => {
    const payload = buildApprovedPayload({
      senderIdentity: "+6591240000",
      recipients: ["+8123"],
      message: "Custom approved copy"
    });

    expect(payload.message).toBe("Custom approved copy");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS if already covered; if so, proceed because the UI work is now the missing implementation layer.

- [x] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";
import { buildApprovedPayload, buildDraftMessage, extractPhoneNumbers } from "@/lib/agent-runner";
import type { StoreData } from "@/lib/types";

export function Dashboard({ initialData }: { initialData: StoreData }) {
  const [senderIdentity, setSenderIdentity] = useState("+6591240000");
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState<string[]>([]);
  const [status, setStatus] = useState<
    | "idle"
    | "awaiting_draft_approval"
    | "awaiting_send_plan_approval"
    | "approved_json_ready"
    | "draft_rejected"
    | "send_plan_rejected"
    | "blocked_no_recipients"
  >("idle");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [approvedJson, setApprovedJson] = useState<object | null>(null);

  function runAgent() {
    const numbers = extractPhoneNumbers(prompt);
    setChatLog((current) => [...current, `User: ${prompt}`]);

    if (!numbers.length) {
      setStatus("blocked_no_recipients");
      setChatLog((current) => [...current, "Agent: I could not find any phone numbers in that request."]);
      return;
    }

    setRecipients(numbers);
    const nextDraft = buildDraftMessage();
    setDraftMessage(nextDraft);
    setChatLog((current) => [...current, `Agent: I found ${numbers.length} recipient(s) and prepared a draft.`]);
    setStatus("awaiting_draft_approval");
    setApprovedJson(null);
  }

  function approveDraft() {
    setChatLog((current) => [...current, "Agent: Draft approved. Preparing send plan."]);
    setStatus("awaiting_send_plan_approval");
  }

  function rejectDraft() {
    setChatLog((current) => [...current, "Agent: Draft rejected."]);
    setStatus("draft_rejected");
  }

  function approveSendPlan() {
    setApprovedJson(
      buildApprovedPayload({
        senderIdentity,
        recipients,
        message: draftMessage
      })
    );
    setChatLog((current) => [...current, "Agent: Send plan approved. JSON payload is ready."]);
    setStatus("approved_json_ready");
  }

  function rejectSendPlan() {
    setChatLog((current) => [...current, "Agent: Send plan rejected."]);
    setStatus("send_plan_rejected");
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>WhatsApp Skill Harness</h1>
        <label className="field">
          <span>Sender identity</span>
          <input value={senderIdentity} onChange={(event) => setSenderIdentity(event.target.value)} />
        </label>
        <label className="field">
          <span>Chat with agent</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button className="button" onClick={runAgent}>
          Send
        </button>
      </section>

      <section className="card stack">
        <h2>Chat</h2>
        <ul className="list">
          {chatLog.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      </section>

      {status === "awaiting_draft_approval" ? (
        <section className="card stack">
          <h2>Draft Review</h2>
          <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} />
          <div className="row">
            <button className="button" onClick={approveDraft}>
              Approve Draft
            </button>
            <button className="button danger" onClick={rejectDraft}>
              Reject
            </button>
          </div>
        </section>
      ) : null}

      {status === "awaiting_send_plan_approval" ? (
        <section className="card stack">
          <h2>Send Plan Review</h2>
          <pre>
            {JSON.stringify(
              {
                senderIdentity,
                recipients,
                message: draftMessage
              },
              null,
              2
            )}
          </pre>
          <div className="row">
            <button className="button" onClick={approveSendPlan}>
              Approve Send Plan
            </button>
            <button className="button danger" onClick={rejectSendPlan}>
              Reject
            </button>
          </div>
        </section>
      ) : null}

      {status === "approved_json_ready" && approvedJson ? (
        <section className="card stack">
          <h2>Approved JSON</h2>
          <pre>{JSON.stringify(approvedJson, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: add step 1 chat to approval to json flow"
```

### Task 4: Verify the small slice

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/lib/agent-runner.ts`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.tsx src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "chore: verify step 1 whatsapp skill harness"
```

## Self-Review

- Spec coverage:
  - chat prompt entry: covered by Task 3
  - draft approval card: covered by Task 3
  - send-plan approval card: covered by Task 3
  - approved JSON export: covered by Tasks 1 and 3
  - no-recipient block: covered by Task 2 and Task 3
- Placeholder scan:
  - removed broader harness abstractions and future-facing tasks
  - kept implementation focused on the Step 1 slice only
- Type consistency:
  - `extractPhoneNumbers`, `buildDraftMessage`, and `buildApprovedPayload` are introduced early and reused consistently
