import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  const backendBaseUrl =
    process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const targetUrl = new URL(
    "/api/v1/study-tasks/settings",
    backendBaseUrl,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": request.headers.get("content-type") ?? "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: await request.text(),
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
      { detail: "Unable to reach the study planner settings service." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
