import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const incomingUrl = new URL(request.url);
  const { userId } = await params;
  const targetUrl = new URL(`/api/v1/users/${encodeURIComponent(userId)}`, backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
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
      { detail: 'Unable to reach backend users service.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const { userId } = await params;
  const targetUrl = new URL(`/api/v1/users/${encodeURIComponent(userId)}`, backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const body = await request.text();
    const response = await fetch(targetUrl.toString(), {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': request.headers.get('content-type') ?? 'application/json',
      },
      body,
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
      { detail: 'Unable to reach backend users service.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
