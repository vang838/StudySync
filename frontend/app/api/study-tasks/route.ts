import { NextRequest, NextResponse } from "next/server";

const backendBaseUrl =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

async function forward(
  request: NextRequest,
  method: "GET" | "POST",
) {
  const targetUrl = new URL("/api/v1/study-tasks", backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const body = method === "POST" ? await request.text() : undefined;
    const response = await fetch(targetUrl.toString(), {
      method,
      headers: {
        accept: "application/json",
        cookie: request.headers.get("cookie") ?? "",
        ...(body !== undefined
          ? {
              "content-type":
                request.headers.get("content-type") ?? "application/json",
            }
          : {}),
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = response.status === 204 ? null : await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach the study tasks service." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function POST(request: NextRequest) {
  return forward(request, "POST");
}
