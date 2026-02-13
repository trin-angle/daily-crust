import { NextRequest, NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";
import type { DruidRegion } from "@/lib/types";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") as DruidRegion | null;
  const client = createMCPClient();
  const qps = await client.getQueryVelocity(region ?? undefined);
  return NextResponse.json(qps);
}
