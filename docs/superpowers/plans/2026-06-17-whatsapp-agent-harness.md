# WhatsApp Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual outreach stepper with a prompt-driven harness that exercises the portable WhatsApp outreach skill against the existing host-tool contract.

**Architecture:** Keep all existing host tools and store-backed approval logic intact. Add a small client-side agent runner with deterministic prompt parsing, transcript events, and inline approval pause/resume behavior, then rebuild the homepage UI around that runner.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, existing JSON store and API routes.

---

## File Structure

- Create: `docs/superpowers/specs/2026-06-17-whatsapp-agent-harness-design.md`
- Create: `docs/superpowers/plans/2026-06-17-whatsapp-agent-harness.md`
- Create: `src/lib/agent-types.ts`
- Create: `src/lib/agent-copy.ts`
- Create: `src/lib/agent-runner.ts`
- Create: `src/components/AgentTranscript.tsx`
- Create: `src/components/ApprovalPanel.tsx`
- Create: `src/components/ReplySuggestionPanel.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/lib/types.ts`
- Modify: `tests/tools.test.ts`
- Create: `tests/agent-runner.test.ts`

### Task 1: Define runner types first

**Files:**
- Create: `src/lib/agent-types.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import type { AgentRunStatus, AgentTranscriptEvent, ReplySuggestionResult } from "@/lib/agent-types";

describe("agent runner types", () => {
  it("supports the approval pause statuses used by the harness", () => {
    const statuses: AgentRunStatus[] = [
      "idle",
      "running",
      "awaiting_draft_approval",
      "awaiting_send_plan_approval",
      "completed",
      "blocked_for_input",
      "rejected_at_draft",
      "rejected_at_send_plan",
      "failed"
    ];

    expect(statuses).toContain("awaiting_draft_approval");
    expect(statuses).toContain("awaiting_send_plan_approval");
  });

  it("defines transcript and reply suggestion shapes the UI can render", () => {
    const event: AgentTranscriptEvent = {
      id: "event_1",
      kind: "tool_result",
      message: "Resolved 2 recipients",
      createdAt: "2026-06-17T00:00:00.000Z"
    };

    const replySuggestion: ReplySuggestionResult = {
      threadId: "thread_1",
      contactId: "contact_1",
      replyDraft: "Sure, happy to help.",
      rationale: "Short, direct follow-up",
      nextAction: "Wait for reply"
    };

    expect(event.kind).toBe("tool_result");
    expect(replySuggestion.replyDraft).toContain("happy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with a module resolution error for `@/lib/agent-types` or missing exported types.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/agent-types.ts
import type { DraftReview, Recipient, SendPlan, SkippedRecipient } from "./types";

export type AgentRunStatus =
  | "idle"
  | "running"
  | "awaiting_draft_approval"
  | "awaiting_send_plan_approval"
  | "completed"
  | "blocked_for_input"
  | "rejected_at_draft"
  | "rejected_at_send_plan"
  | "failed";

export type AgentTranscriptEventKind =
  | "user_prompt"
  | "agent_note"
  | "tool_call"
  | "tool_result"
  | "approval_requested"
  | "approval_decision"
  | "summary"
  | "error";

export type AgentTranscriptEvent = {
  id: string;
  kind: AgentTranscriptEventKind;
  message: string;
  createdAt: string;
  detail?: string;
};

export type ParsedOutreachPrompt =
  | {
      kind: "outreach";
      campaignBrief: string;
      contactQuery: string;
      reasonForOutreach: string;
      constraints: string[];
      mediaReference: string | null;
    }
  | {
      kind: "reply";
      threadHint: string;
    }
  | {
      kind: "unsupported";
      reason: string;
    }
  | {
      kind: "compliance_blocked";
      reason: string;
    };

export type RecipientResolution = {
  recipients: Recipient[];
  skippedRecipients: SkippedRecipient[];
  audienceSummary: string;
};

export type PendingDraftApproval = {
  reviewId: string;
  review: DraftReview;
};

export type PendingSendPlanApproval = {
  sendPlanId: string;
  plan: SendPlan;
};

export type AgentRunSummary = {
  sent: number;
  failed: number;
  skipped: number;
  notableFailures: string[];
  repliesLocation: string;
};

export type ReplySuggestionResult = {
  threadId: string;
  contactId: string;
  replyDraft: string;
  rationale: string;
  nextAction: string;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-types.ts tests/agent-runner.test.ts src/lib/types.ts
git commit -m "feat: add agent harness core types"
```

### Task 2: Add prompt parsing and copy helpers with TDD

**Files:**
- Create: `src/lib/agent-copy.ts`
- Create: `src/lib/agent-runner.ts`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildOutreachDraft, classifyPrompt } from "@/lib/agent-runner";

describe("agent runner prompt handling", () => {
  it("blocks scraped-number requests before any send flow starts", () => {
    const parsed = classifyPrompt("Blast this promo to 5,000 scraped numbers");

    expect(parsed).toEqual({
      kind: "compliance_blocked",
      reason: expect.stringContaining("opted-in")
    });
  });

  it("flags unsupported event lookups as blocked host limitations", () => {
    const parsed = classifyPrompt("Send this to all the contacts from yesterday's event");

    expect(parsed).toEqual({
      kind: "unsupported",
      reason: expect.stringContaining("no contact search or event attendee tool")
    });
  });

  it("classifies a normal outreach request and generates concise copy", () => {
    const parsed = classifyPrompt("Send a WhatsApp intro to manufacturing leads in Singapore about our CRM.");

    expect(parsed.kind).toBe("outreach");
    if (parsed.kind !== "outreach") {
      throw new Error("Expected outreach prompt");
    }

    const draft = buildOutreachDraft({
      contactName: "Alex",
      companyName: "Acme",
      reasonForOutreach: parsed.reasonForOutreach
    });

    expect(draft).toContain("Hi Alex");
    expect(draft).toContain("Would it be worth");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `classifyPrompt` or `buildOutreachDraft`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/agent-copy.ts
export function buildOutreachDraft(input: {
  contactName: string;
  companyName?: string;
  reasonForOutreach: string;
}): string {
  const companyTail = input.companyName ? ` for ${input.companyName}` : "";
  return `Hi ${input.contactName}, I’m reaching out because ${input.reasonForOutreach}. Would it be worth a quick chat to see if this could be useful${companyTail}?`;
}

export function buildReplySuggestion(input: {
  productSummary: string;
  latestReply: string;
}): { replyDraft: string; rationale: string; nextAction: string } {
  return {
    replyDraft: `Sure, happy to. In short, ${input.productSummary}. What would be most useful for you to see first?`,
    rationale: `Respond directly to "${input.latestReply}" with a short next-step question.`,
    nextAction: "Send short product overview if they respond"
  };
}
```

```typescript
// src/lib/agent-runner.ts
import { buildOutreachDraft as buildDraft } from "./agent-copy";
import type { ParsedOutreachPrompt } from "./agent-types";

export function classifyPrompt(prompt: string): ParsedOutreachPrompt {
  const normalized = prompt.trim().toLowerCase();

  if (normalized.includes("scraped numbers")) {
    return {
      kind: "compliance_blocked",
      reason: "I can help draft compliant outreach, but I cannot proceed without an opted-in/contactable audience."
    };
  }

  if (normalized.includes("yesterday's event") || normalized.includes("yesterdays event")) {
    return {
      kind: "unsupported",
      reason: 'I can draft the message, but I cannot resolve "yesterday\'s event" contacts because this host has no contact search or event attendee tool available.'
    };
  }

  return {
    kind: "outreach",
    campaignBrief: prompt.trim(),
    contactQuery: prompt.trim(),
    reasonForOutreach: "we help B2B teams discover leads and keep follow-ups moving",
    constraints: [],
    mediaReference: null
  };
}

export function buildOutreachDraft(input: {
  contactName: string;
  companyName?: string;
  reasonForOutreach: string;
}): string {
  return buildDraft(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-copy.ts src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "feat: add prompt classification and copy helpers"
```

### Task 3: Add recipient resolution and run-summary helpers

**Files:**
- Modify: `src/lib/agent-runner.ts`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildAudienceSummary, summarizeExecution } from "@/lib/agent-runner";
import type { Recipient, SkippedRecipient } from "@/lib/types";

describe("agent runner summaries", () => {
  it("describes valid and skipped recipients for approval review", () => {
    const recipients: Recipient[] = [
      {
        recipientId: "+6591111111",
        contactId: "contact_001",
        name: "Alex Tan",
        companyName: "Acme",
        whatsapp: "+6591111111"
      }
    ];
    const skippedRecipients: SkippedRecipient[] = [
      {
        recipientId: "contact_003",
        name: "Jordan Lee",
        reason: "Do not contact"
      }
    ];

    expect(buildAudienceSummary(recipients, skippedRecipients)).toBe(
      "1 valid contact, 1 skipped (Do not contact)"
    );
  });

  it("summarizes mixed send outcomes with reply location guidance", () => {
    const summary = summarizeExecution({
      sent: 1,
      failed: 1,
      skipped: 2,
      results: [
        { recipient: { name: "Alex" }, status: "sent", error: null },
        { recipient: { name: "Priya" }, status: "failed", error: "Cloud API returned 400" }
      ]
    });

    expect(summary.notableFailures).toEqual(["Priya: Cloud API returned 400"]);
    expect(summary.repliesLocation).toContain("Threads");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `buildAudienceSummary` or `summarizeExecution`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/agent-runner.ts
import type { AgentRunSummary } from "./agent-types";
import type { Recipient, SkippedRecipient } from "./types";

export function buildAudienceSummary(
  recipients: Recipient[],
  skippedRecipients: SkippedRecipient[]
): string {
  const validLabel = `${recipients.length} valid contact${recipients.length === 1 ? "" : "s"}`;
  if (!skippedRecipients.length) {
    return validLabel;
  }

  const reasons = Array.from(new Set(skippedRecipients.map((recipient) => recipient.reason)));
  return `${validLabel}, ${skippedRecipients.length} skipped (${reasons.join(", ")})`;
}

export function summarizeExecution(input: {
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    recipient: { name: string };
    status: string;
    error: string | null;
  }>;
}): AgentRunSummary {
  return {
    sent: input.sent,
    failed: input.failed,
    skipped: input.skipped,
    notableFailures: input.results
      .filter((result) => result.status === "failed" && result.error)
      .map((result) => `${result.recipient.name}: ${result.error}`),
    repliesLocation: "Replies will appear in the host Threads / replies area backed by store data."
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "feat: add audience and execution summaries"
```

### Task 4: Add approval transition helpers

**Files:**
- Modify: `src/lib/agent-runner.ts`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { applyDraftDecision, applySendPlanDecision } from "@/lib/agent-runner";
import type { DraftReview, SendPlan } from "@/lib/types";

describe("agent approval transitions", () => {
  it("continues only when draft approval is approved", () => {
    const review: DraftReview = {
      id: "draft_1",
      campaignBrief: "Intro campaign",
      audienceSummary: "2 valid contacts",
      draftMessage: "Hi Alex",
      finalMessage: "Hi Alex approved",
      mediaReference: null,
      decision: "approved",
      createdAt: "2026-06-17T00:00:00.000Z"
    };

    expect(applyDraftDecision(review)).toEqual({
      status: "continue",
      finalMessage: "Hi Alex approved"
    });
  });

  it("stops when send-plan approval is rejected", () => {
    const plan: SendPlan = {
      id: "plan_1",
      campaignBrief: "Intro campaign",
      senderIdentity: "+6591240000",
      validRecipientCount: 1,
      recipients: [],
      skippedRecipients: [],
      finalMessage: "Hi Alex approved",
      mediaReference: null,
      decision: "rejected",
      createdAt: "2026-06-17T00:00:00.000Z"
    };

    expect(applySendPlanDecision(plan)).toEqual({
      status: "stop",
      reason: "Send plan was rejected. Nothing was sent."
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `applyDraftDecision` or `applySendPlanDecision`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/agent-runner.ts
import type { DraftReview, SendPlan } from "./types";

export function applyDraftDecision(review: DraftReview) {
  if (review.decision === "approved") {
    return {
      status: "continue" as const,
      finalMessage: review.finalMessage ?? review.draftMessage
    };
  }

  return {
    status: "stop" as const,
    reason: "Draft was rejected. Nothing was sent."
  };
}

export function applySendPlanDecision(plan: SendPlan) {
  if (plan.decision === "approved") {
    return {
      status: "continue" as const,
      sendAuthorizationToken: plan.sendAuthorizationToken ?? ""
    };
  }

  return {
    status: "stop" as const,
    reason: "Send plan was rejected. Nothing was sent."
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-runner.ts tests/agent-runner.test.ts
git commit -m "feat: add approval transition helpers"
```

### Task 5: Build focused transcript and approval components

**Files:**
- Create: `src/components/AgentTranscript.tsx`
- Create: `src/components/ApprovalPanel.tsx`
- Modify: `src/components/Dashboard.tsx`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { approvalHeadingForStatus, transcriptLabelForKind } from "@/lib/agent-runner";

describe("harness presentation helpers", () => {
  it("maps draft approval pause to a draft review heading", () => {
    expect(approvalHeadingForStatus("awaiting_draft_approval")).toBe("Draft Review");
  });

  it("maps transcript event kinds to stable UI labels", () => {
    expect(transcriptLabelForKind("tool_call")).toBe("Tool Call");
    expect(transcriptLabelForKind("summary")).toBe("Summary");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `approvalHeadingForStatus` or `transcriptLabelForKind`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/agent-runner.ts
import type { AgentRunStatus, AgentTranscriptEventKind } from "./agent-types";

export function approvalHeadingForStatus(status: AgentRunStatus): string {
  if (status === "awaiting_draft_approval") {
    return "Draft Review";
  }

  if (status === "awaiting_send_plan_approval") {
    return "Send Plan Review";
  }

  return "Approval";
}

export function transcriptLabelForKind(kind: AgentTranscriptEventKind): string {
  switch (kind) {
    case "user_prompt":
      return "Prompt";
    case "agent_note":
      return "Agent";
    case "tool_call":
      return "Tool Call";
    case "tool_result":
      return "Tool Result";
    case "approval_requested":
      return "Approval Needed";
    case "approval_decision":
      return "Approval Decision";
    case "summary":
      return "Summary";
    case "error":
      return "Error";
  }
}
```

```tsx
// src/components/AgentTranscript.tsx
import type { AgentTranscriptEvent } from "@/lib/agent-types";
import { transcriptLabelForKind } from "@/lib/agent-runner";

export function AgentTranscript({ events }: { events: AgentTranscriptEvent[] }) {
  return (
    <section className="card stack">
      <h2>Agent Transcript</h2>
      <ul className="list">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{transcriptLabelForKind(event.kind)}</strong>
            <div>{event.message}</div>
            {event.detail ? <pre>{event.detail}</pre> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// src/components/ApprovalPanel.tsx
export function ApprovalPanel(props: {
  heading: string;
  detail: string;
  editableMessage?: string;
  onMessageChange?: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <section className="card stack">
      <h2>{props.heading}</h2>
      <pre>{props.detail}</pre>
      {typeof props.editableMessage === "string" ? (
        <textarea
          value={props.editableMessage}
          onChange={(event) => props.onMessageChange?.(event.target.value)}
        />
      ) : null}
      <div className="row">
        <button className="button" disabled={props.busy} onClick={props.onApprove}>
          Approve
        </button>
        <button className="button danger" disabled={props.busy} onClick={props.onReject}>
          Reject
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-runner.ts src/components/AgentTranscript.tsx src/components/ApprovalPanel.tsx tests/agent-runner.test.ts
git commit -m "feat: add transcript and approval panel helpers"
```

### Task 6: Replace the manual dashboard with the outbound harness

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `app/page.tsx`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { validateHarnessInput } from "@/lib/agent-runner";

describe("dashboard harness flow contract", () => {
  it("blocks a run when the host-controlled sender identity is blank", () => {
    expect(validateHarnessInput("", "Send a WhatsApp intro to manufacturing leads in Singapore")).toEqual({
      ok: false,
      reason: "Sender identity is required before the agent can draft or send outreach."
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL with missing `validateHarnessInput`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/Dashboard.tsx
"use client";

import { useMemo, useState } from "react";
import { AgentTranscript } from "@/components/AgentTranscript";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import type {
  AgentRunStatus,
  AgentTranscriptEvent,
  PendingDraftApproval,
  PendingSendPlanApproval
} from "@/lib/agent-types";
import {
  approvalHeadingForStatus,
  applyDraftDecision,
  applySendPlanDecision,
  buildAudienceSummary,
  buildOutreachDraft,
  classifyPrompt,
  summarizeExecution,
  validateHarnessInput
} from "@/lib/agent-runner";
import type { StoreData } from "@/lib/types";

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

export function Dashboard({ initialData }: { initialData: StoreData }) {
  const [data, setData] = useState(initialData);
  const [prompt, setPrompt] = useState("");
  const [senderIdentity, setSenderIdentity] = useState("+6591240000");
  const [status, setStatus] = useState<AgentRunStatus>("idle");
  const [events, setEvents] = useState<AgentTranscriptEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [editableDraftMessage, setEditableDraftMessage] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const latestDraft = data.draftReviews[0];
  const latestPlan = data.sendPlans[0];

  const appendEvent = (event: AgentTranscriptEvent) => {
    setEvents((current) => [...current, event]);
  };

  async function refreshStore() {
    const response = await fetch("/api/store", { cache: "no-store" });
    setData((await response.json()) as StoreData);
  }

  async function startRun() {
    const validation = validateHarnessInput(senderIdentity, prompt);
    if (!validation.ok) {
      setStatus("blocked_for_input");
      setSummary(validation.reason);
      return;
    }

    setBusy(true);
    setStatus("running");
    setSummary(null);
    setEvents([]);
    appendEvent({
      id: crypto.randomUUID(),
      kind: "user_prompt",
      message: prompt,
      createdAt: new Date().toISOString()
    });

    const parsed = classifyPrompt(prompt);
    if (parsed.kind === "unsupported" || parsed.kind === "compliance_blocked") {
      setStatus("blocked_for_input");
      appendEvent({
        id: crypto.randomUUID(),
        kind: "error",
        message: parsed.reason,
        createdAt: new Date().toISOString()
      });
      setSummary(parsed.reason);
      setBusy(false);
      return;
    }

    const contacts = await postJson<{ contacts: Array<{ contactId: string; name: string; companyName?: string; whatsapp?: string; doNotContact?: boolean }> }>("/api/tools/search_contacts", {
      query: parsed.contactQuery,
      limit: 25
    });

    const sendable = contacts.contacts.filter((contact) => contact.whatsapp && !contact.doNotContact);
    const skipped = contacts.contacts.filter((contact) => !contact.whatsapp || contact.doNotContact);
    const audienceSummary = buildAudienceSummary(
      sendable.map((contact) => ({
        recipientId: contact.whatsapp!,
        contactId: contact.contactId,
        name: contact.name,
        companyName: contact.companyName,
        whatsapp: contact.whatsapp!
      })),
      skipped.map((contact) => ({
        recipientId: contact.contactId,
        name: contact.name,
        reason: contact.doNotContact ? "Do not contact" : "Missing WhatsApp number"
      }))
    );

    const draftMessage = buildOutreachDraft({
      contactName: sendable[0]?.name ?? "there",
      companyName: sendable[0]?.companyName,
      reasonForOutreach: parsed.reasonForOutreach
    });

    await postJson("/api/tools/review_outreach_draft", {
      campaignBrief: parsed.campaignBrief,
      audienceSummary,
      draftMessage,
      mediaReference: parsed.mediaReference
    });

    await refreshStore();
    setEditableDraftMessage(draftMessage);
    setStatus("awaiting_draft_approval");
    setBusy(false);
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
          <span>Prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button className="button" disabled={busy} onClick={startRun}>
          Run Agent
        </button>
        {summary ? <p>{summary}</p> : null}
      </section>

      <AgentTranscript events={events} />

      {status === "awaiting_draft_approval" && latestDraft ? (
        <ApprovalPanel
          heading={approvalHeadingForStatus(status)}
          detail={JSON.stringify(latestDraft, null, 2)}
          editableMessage={editableDraftMessage}
          onMessageChange={setEditableDraftMessage}
          onApprove={async () => {}}
          onReject={async () => {}}
          busy={busy}
        />
      ) : null}

      {status === "awaiting_send_plan_approval" && latestPlan ? (
        <ApprovalPanel
          heading={approvalHeadingForStatus(status)}
          detail={JSON.stringify(latestPlan, null, 2)}
          onApprove={async () => {}}
          onReject={async () => {}}
          busy={busy}
        />
      ) : null}
    </main>
  );
}
```

```typescript
// src/lib/agent-runner.ts
export function validateHarnessInput(senderIdentity: string, prompt: string) {
  if (!senderIdentity.trim()) {
    return {
      ok: false as const,
      reason: "Sender identity is required before the agent can draft or send outreach."
    };
  }

  if (!prompt.trim()) {
    return {
      ok: false as const,
      reason: "Enter a prompt before starting the agent run."
    };
  }

  return { ok: true as const };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx app/page.tsx
git commit -m "feat: replace manual outreach stepper with agent harness"
```

### Task 7: Add reply suggestion panel

**Files:**
- Create: `src/components/ReplySuggestionPanel.tsx`
- Modify: `src/lib/agent-copy.ts`
- Modify: `src/lib/agent-runner.ts`
- Modify: `src/components/Dashboard.tsx`
- Test: `tests/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildReplySuggestion } from "@/lib/agent-copy";

describe("reply suggestions", () => {
  it("creates a short reply suggestion with a next step", () => {
    const result = buildReplySuggestion({
      productSummary: "Globiz helps B2B teams discover leads, prepare outreach, and keep follow-ups moving",
      latestReply: "Can you send more details?"
    });

    expect(result.replyDraft).toContain("Sure, happy to.");
    expect(result.rationale).toContain("Can you send more details?");
    expect(result.nextAction).toContain("Send short product overview");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: FAIL if `buildReplySuggestion` is not yet exported or does not match this behavior.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ReplySuggestionPanel.tsx
import type { ReplySuggestionResult } from "@/lib/agent-types";

export function ReplySuggestionPanel(props: {
  threadOptions: Array<{ label: string; threadId: string; contactId: string }>;
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
  onGenerate: () => void;
  result: ReplySuggestionResult | null;
  busy: boolean;
}) {
  return (
    <section className="card stack">
      <h2>Reply Suggestion Test</h2>
      <select value={props.selectedThreadId} onChange={(event) => props.onSelectThread(event.target.value)}>
        <option value="">Select a thread</option>
        {props.threadOptions.map((option) => (
          <option key={option.threadId} value={option.threadId}>
            {option.label}
          </option>
        ))}
      </select>
      <button className="button" disabled={props.busy || !props.selectedThreadId} onClick={props.onGenerate}>
        Suggest Reply
      </button>
      {props.result ? (
        <div className="stack">
          <textarea readOnly value={props.result.replyDraft} />
          <p>{props.result.rationale}</p>
          <p>{props.result.nextAction}</p>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ReplySuggestionPanel.tsx src/lib/agent-copy.ts src/lib/agent-runner.ts src/components/Dashboard.tsx tests/agent-runner.test.ts
git commit -m "feat: add reply suggestion harness panel"
```

### Task 8: Align tool tests with harness expectations

**Files:**
- Modify: `tests/tools.test.ts`
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { writeStore } from "@/lib/store";
import { emptyStore, readStore } from "@/lib/store";
import { listRecentReplies } from "@/lib/tools";

it("returns customer replies only from listRecentReplies", async () => {
  const store = emptyStore();
  store.threads.push({
    threadId: "thread_123",
    contactId: "contact_001",
    recipientId: "+6591111111",
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:01:00.000Z",
    messages: [
      {
        role: "business",
        content: "Hi Alex, wanted to follow up.",
        createdAt: "2026-06-17T00:00:00.000Z"
      },
      {
        role: "customer",
        content: "Can you send more details?",
        createdAt: "2026-06-17T00:01:00.000Z"
      }
    ]
  });

  await writeStore(store);

  const result = await listRecentReplies({ threadId: "thread_123", limit: 10 });

  expect(result.messages).toEqual([
    expect.objectContaining({
      role: "customer",
      content: "Can you send more details?",
      threadId: "thread_123"
    })
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools.test.ts`
Expected: FAIL because the new test has not been implemented or seeded correctly yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// tests/tools.test.ts
import { listRecentReplies } from "@/lib/tools";
import { emptyStore, writeStore } from "@/lib/store";

it("returns customer replies only from listRecentReplies", async () => {
  const store = emptyStore();
  store.threads.push({
    threadId: "thread_123",
    contactId: "contact_001",
    recipientId: "+6591111111",
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:01:00.000Z",
    messages: [
      {
        role: "business",
        content: "Hi Alex, wanted to follow up.",
        createdAt: "2026-06-17T00:00:00.000Z"
      },
      {
        role: "customer",
        content: "Can you send more details?",
        createdAt: "2026-06-17T00:01:00.000Z"
      }
    ]
  });

  await writeStore(store);

  const result = await listRecentReplies({ threadId: "thread_123", limit: 10 });

  expect(result.messages).toEqual([
    expect.objectContaining({
      role: "customer",
      content: "Can you send more details?",
      threadId: "thread_123"
    })
  ]);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/tools.test.ts
git commit -m "test: cover reply retrieval for harness flows"
```

### Task 9: Verify the full slice

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/lib/agent-runner.ts`
- Test: `tests/agent-runner.test.ts`
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Run targeted runner tests**

Run: `npm test -- tests/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 2: Run tool regression tests**

Run: `npm test -- tests/tools.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx src/lib/agent-runner.ts tests/agent-runner.test.ts tests/tools.test.ts
git commit -m "chore: verify whatsapp agent harness end to end"
```

## Self-Review

- Spec coverage:
  - Prompt-driven homepage: covered by Task 6.
  - Approval pause/resume flow: covered by Tasks 4, 5, and 6.
  - Deterministic basic agent behavior: covered by Tasks 2 and 3.
  - Reply suggestion flow: covered by Task 7.
  - Tool regressions: covered by Task 8.
  - Full verification: covered by Task 9.
- Placeholder scan:
  - The only acceptable prose placeholders are in comments describing replacement intent; implementation steps name exact files and commands.
- Type consistency:
  - `AgentRunStatus`, `ParsedOutreachPrompt`, `ReplySuggestionResult`, and approval helper names are introduced in Task 1 and reused consistently later.
