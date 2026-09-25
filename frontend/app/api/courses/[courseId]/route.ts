import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const { courseId } = await params;
  const targetUrl = new URL(`/api/v1/courses/${encodeURIComponent(courseId)}`, backendBaseUrl);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach backend courses service.' },
      { status: 502 },
    );
  }
}
