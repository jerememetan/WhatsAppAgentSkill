import { NextResponse } from "next/server";
import { handleTool, type ToolName } from "@/lib/tools";

const toolNames = new Set<ToolName>([
  "search_contacts",
  "get_contact",
  "review_outreach_draft",
  "review_send_plan",
  "send_whatsapp_message",
  "list_recent_replies",
  "record_follow_up"
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> }
) {
  const { tool } = await context.params;

  if (!toolNames.has(tool as ToolName)) {
    return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 404 });
  }

  try {
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await handleTool(tool as ToolName, input);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tool request failed" },
      { status: 400 }
    );
  }
}
