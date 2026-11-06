import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_AUTH_ACTIONS = new Set([
  'signup',
  'login',
  'forgotpassword',
  'resetpassword',
  'logout',
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!ALLOWED_AUTH_ACTIONS.has(action)) {
    return NextResponse.json({ detail: 'Unsupported auth action.' }, { status: 404 });
  }

  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const targetUrl = new URL(`/api/v1/auth/${action}`, backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const payload = await request.text();
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        accept: 'application/json',
      },
      body: payload,
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
      { detail: 'Unable to reach backend auth service.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
