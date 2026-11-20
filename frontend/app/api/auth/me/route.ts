import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
    const targetUrl = new URL("/api/v1/auth/me", backendBaseUrl);

    try {
        const response = await fetch(targetUrl, {
            headers: {
                accept: "application/json",
                cookie: request.headers.get("cookie") ?? "",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
        });

        return new NextResponse(await response.text(), {
            status: response.status,
            headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
        });
    } catch {
        return NextResponse.json({ detail: "Unable to verify session." }, { status: 502 });
    }
}
