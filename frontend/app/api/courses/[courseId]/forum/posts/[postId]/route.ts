import { NextRequest, NextResponse } from 'next/server';

async function proxyForumPostMutation(
  request: NextRequest,
  params: Promise<{ courseId: string; postId: string }>,
  method: 'GET' | 'PUT' | 'DELETE',
) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  const incomingUrl = new URL(request.url);
  const { courseId, postId } = await params;
  const targetUrl = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId)}/forum/posts/${encodeURIComponent(postId)}`,
    backendBaseUrl,
  );
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
      body: method === 'PUT' ? await request.text() : undefined,
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
  { params }: { params: Promise<{ courseId: string; postId: string }> },
) {
  return proxyForumPostMutation(request, params, 'GET');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; postId: string }> },
) {
  return proxyForumPostMutation(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; postId: string }> },
) {
  return proxyForumPostMutation(request, params, 'DELETE');
}
