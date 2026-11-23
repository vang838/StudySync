import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  if (!/^[0-9a-f]{32}$/.test(conversationId)) {
    return NextResponse.json({ detail: 'Invalid conversation ID.' }, { status: 400 });
  }

  const backendBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
  const targetUrl = new URL(`/api/v1/chat/conversations/${conversationId}`, backendBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    return NextResponse.json({ detail: 'Unable to load conversation.' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
