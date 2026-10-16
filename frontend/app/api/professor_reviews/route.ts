import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const incomingUrl = new URL(request.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const targetUrl = new URL('/api/v1/courses/search', backendBaseUrl);
  targetUrl.searchParams.set('subject', incomingUrl.searchParams.get('subject') ?? '');
  targetUrl.searchParams.set('courseNumber', incomingUrl.searchParams.get('courseNumber') ?? '');
  targetUrl.searchParams.set('name', incomingUrl.searchParams.get('name') ?? '');
  targetUrl.searchParams.set('professor', incomingUrl.searchParams.get('professor') ?? '');
  targetUrl.searchParams.set('savedOnly', incomingUrl.searchParams.get('savedOnly') ?? 'false');

  const userId = incomingUrl.searchParams.get('user_id');
  if (userId) {
    targetUrl.searchParams.set('user_id', userId);
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
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
      { detail: 'Unable to reach backend courses service.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const targetUrl = new URL('/api/v1/professor-reviews', backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const payload = await request.json();
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.name === 'AbortError'
        ? 'The professor reviews service timed out.'
        : 'Unable to reach the professor reviews service.';
    return NextResponse.json({ detail }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}

