import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  {params}: {params: Promise<{notificationId: string}>},
) {
  const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const {notificationId} = await params;
  const targetUrl = new URL(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, backendBaseUrl);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {"content-type": response.headers.get("content-type") ?? "application/json"},
    });
  } catch {
    return NextResponse.json({detail: "Unable to reach backend notifications service."}, {status: 502});
  }
}
