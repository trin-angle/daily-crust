import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const tasks = await client.getActiveTasks();
  return NextResponse.json(tasks);
}
