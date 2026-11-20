import { NextResponse } from "next/server";

export async function GET() {
    const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
    const targetUrl = new URL("/api/v1/forum/recent?limit=12", backendBaseUrl);

    try {
        const response = await fetch(targetUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });

        return new NextResponse(await response.text(), {
            status: response.status,
            headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
        });
    } catch {
        return NextResponse.json({ detail: "Unable to load recent discussions." }, { status: 502 });
    }
}
