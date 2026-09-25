import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const incomingUrl = new URL(request.url);

  const targetUrl = new URL('/api/v1/courses/search', backendBaseUrl);
  targetUrl.searchParams.set('subject', incomingUrl.searchParams.get('subject') ?? '');
  targetUrl.searchParams.set('courseNumber', incomingUrl.searchParams.get('courseNumber') ?? '');
  targetUrl.searchParams.set('name', incomingUrl.searchParams.get('name') ?? '');
  targetUrl.searchParams.set('professor', incomingUrl.searchParams.get('professor') ?? '');

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
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
