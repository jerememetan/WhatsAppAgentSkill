import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { emptyStore } from "@/lib/store";

describe("dashboard shell", () => {
  it("renders the prompt-driven chat shell", () => {
    const markup = renderToStaticMarkup(<Dashboard initialData={emptyStore()} />);

    expect(markup).toContain("WhatsApp Skill Harness");
    expect(markup).toContain("Sender identity");
    expect(markup).toContain("Chat with agent");
    expect(markup).toContain("Send");
    expect(markup).toContain("Chat");
  });
});
