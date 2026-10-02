import { NextRequest, NextResponse } from 'next/server';

async function proxyForumRequest(
  request: NextRequest,
  params: Promise<{ courseId: string }>,
  method: 'GET' | 'POST',
) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const incomingUrl = new URL(request.url);
  const { courseId } = await params;
  const targetUrl = new URL(`/api/v1/courses/${encodeURIComponent(courseId)}/forum/posts`, backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        accept: 'application/json',
      },
      body: method === 'POST' ? await request.text() : undefined,
      signal: controller.signal,
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
      { detail: 'Unable to reach backend course forum service.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  return proxyForumRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  return proxyForumRequest(request, params, 'POST');
}
