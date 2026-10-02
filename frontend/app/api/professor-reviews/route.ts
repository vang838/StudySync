import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const incomingUrl = new URL(request.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const targetUrl = new URL("/api/v1/professor-reviews", backendBaseUrl);
  const professor = incomingUrl.searchParams.get("professor") ?? "";
  const rating = incomingUrl.searchParams.get("rating");
  const courseId = incomingUrl.searchParams.get("course_id");

  targetUrl.searchParams.set("professor", professor);

  if (rating) {
    targetUrl.searchParams.set("rating", rating);
  }

  if (courseId) {
    targetUrl.searchParams.set("course_id", courseId);
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach backend professor reviews service." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
