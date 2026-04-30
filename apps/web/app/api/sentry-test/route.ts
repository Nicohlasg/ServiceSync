import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("Triggering Sentry server test error and metric...");
  Sentry.metrics.count('server_test_metric', 1);
  throw new Error("Sentry Test Error: Server-side API verification");
}
