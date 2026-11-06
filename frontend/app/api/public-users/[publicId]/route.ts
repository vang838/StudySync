import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const targetUrl = new URL(`/api/v1/users/public/${encodeURIComponent(publicId)}`, backendBaseUrl);
  try {
    const response = await fetch(targetUrl, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {"content-type": response.headers.get("content-type") ?? "application/json"},
    });
  } catch {
    return NextResponse.json({detail: "Unable to reach backend users service."}, {status: 502});
  }
}
