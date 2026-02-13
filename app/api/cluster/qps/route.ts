import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const qps = await client.getQueryVelocity();
  return NextResponse.json(qps);
}
