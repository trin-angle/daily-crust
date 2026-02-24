import { NextRequest, NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";
import type { DruidProduct, DruidRegion } from "@/lib/types";

export async function GET(request: NextRequest) {
  const product = request.nextUrl.searchParams.get("product") as DruidProduct | null;
  const region = request.nextUrl.searchParams.get("region") as DruidRegion | null;
  const client = createMCPClient(undefined, product ?? undefined, region ?? undefined);
  const qps = await client.getQueryVelocity();
  return NextResponse.json(qps);
}
