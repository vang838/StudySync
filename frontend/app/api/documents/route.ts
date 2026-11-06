
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL("/api/v1/documents", backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
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
      { detail: "Unable to reach backend documents service." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  try {
    const formData = await request.formData();

    const courseId = formData.get("course_id");
    const title = formData.get("title");
    const file = formData.get("file");

    if (
      typeof courseId !== "string" ||
      !courseId.trim() ||
      typeof title !== "string" ||
      !title.trim() ||
      !(file instanceof File)
    ) {
      return NextResponse.json(
        { detail: "Course, title, and file are required." },
        { status: 400 }
      );
    }

    const uploadData = new FormData();
    uploadData.append("course_id", courseId.trim());
    uploadData.append("title", title.trim());
    uploadData.append("file", file, file.name);

    const targetUrl = new URL("/api/v1/documents", backendBaseUrl);

    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      body: uploadData,
      cache: "no-store",
    });

    const responseText = await response.text();

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);

    return NextResponse.json(
      { detail: "Unable to upload document." },
      { status: 502 }
    );
  }
}