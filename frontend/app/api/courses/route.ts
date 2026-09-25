import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const targetUrl = new URL('/api/v1/courses', backendBaseUrl);

  try {
    const payload = await request.json();
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
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
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach backend courses service.' },
      { status: 502 },
    );
  }
}
