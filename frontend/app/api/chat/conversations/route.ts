import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const backendBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
  const targetUrl = new URL('/api/v1/chat/conversations', backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  for (const key of ['limit', 'offset']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) targetUrl.searchParams.set(key, value);
  }

  try {
    const sessionToken = request.cookies.get('studysync_session')?.value;
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(sessionToken ? { cookie: `studysync_session=${sessionToken}` } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ detail: 'Unable to load chat history.' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
