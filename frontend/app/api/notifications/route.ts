import { NextRequest, NextResponse } from "next/server";

async function proxyNotificationRequest(request: NextRequest, method: "GET" | "POST") {
  const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const targetUrl = new URL("/api/v1/notifications", backendBaseUrl);
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
      body: method === "POST" ? await request.text() : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {"content-type": response.headers.get("content-type") ?? "application/json"},
    });
  } catch {
    return NextResponse.json({detail: "Unable to reach backend notifications service."}, {status: 502});
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  return proxyNotificationRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const targetUrl = new URL("/api/v1/notifications", backendBaseUrl);
  let body = "";

  try {
    body = await request.clone().text();
  } catch {
    return new NextResponse(null, {status: 204});
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {"content-type": response.headers.get("content-type") ?? "application/json"},
      });
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      return new NextResponse(null, {status: 204});
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return new NextResponse(null, {status: 204});
}
