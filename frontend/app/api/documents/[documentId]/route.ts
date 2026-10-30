import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const incomingUrl = new URL(request.url);
  const { documentId } = await params;
  const previewMode = incomingUrl.searchParams.get("preview") === "true";
  const targetUrl = new URL(
    `/api/v1/documents/${encodeURIComponent(documentId)}/download`,
    backendBaseUrl,
  );
  targetUrl.searchParams.set("preview", previewMode ? "true" : "false");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        accept: "*/*",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition":
          response.headers.get("content-disposition") ??
          (previewMode ? "inline" : "attachment"),
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach backend documents service." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const incomingUrl = new URL(request.url);
  const { documentId } = await params;
  const targetUrl = new URL(
    `/api/v1/documents/${encodeURIComponent(documentId)}`,
    backendBaseUrl
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "DELETE",
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const incomingUrl = new URL(request.url);
  const { documentId } = await params;
  const targetUrl = new URL(
    `/api/v1/documents/${encodeURIComponent(documentId)}/publish`,
    backendBaseUrl
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const body = await request.text();
    const response = await fetch(targetUrl.toString(), {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body,
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
