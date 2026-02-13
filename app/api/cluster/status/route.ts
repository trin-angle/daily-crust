import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const status = await client.getClusterStatus();
  return NextResponse.json(status);
}
