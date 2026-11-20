import { NextRequest, NextResponse } from "next/server";

async function proxyPreferencesRequest(request: NextRequest, method: "GET" | "PUT") {
  const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const targetUrl = new URL("/api/v1/notifications/preferences", backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: method === "PUT" ? await request.text() : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {"content-type": response.headers.get("content-type") ?? "application/json"},
    });
  } catch {
    return NextResponse.json({detail: "Unable to reach backend notification settings."}, {status: 502});
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  return proxyPreferencesRequest(request, "GET");
}

export async function PUT(request: NextRequest) {
  return proxyPreferencesRequest(request, "PUT");
}
