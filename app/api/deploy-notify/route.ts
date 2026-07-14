import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appConfig = await getAppConfig();
  const authHeader = request.headers.get("authorization");

  if (appConfig.cronSecret && authHeader !== `Bearer ${appConfig.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const version = body.version || "unknown";

  await sendNotification(`Deployed ${version}`);

  return NextResponse.json({ success: true });
}
