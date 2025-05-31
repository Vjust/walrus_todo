import { NextRequest, NextResponse } from 'next/server';

// Proxy for Walrus API calls to handle CORS and caching
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = path.join('/');
  const walrusUrl = `${process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL}/${pathString}`;

  try {
    const response = await fetch(walrusUrl, {
      headers: {
        'Accept': request.headers.get('accept') || '*/*',
        'User-Agent': 'WalTodo/1.0',
      },
      // Cache for 1 hour
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Walrus API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Walrus-Cache': 'HIT',
      },
    });
  } catch (error) {
    console.error('[Walrus Proxy Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Walrus' },
      { status: 500 }
    );
  }
}

// Handle POST requests for publishing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = path.join('/');
  const walrusUrl = `${process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL}/${pathString}`;

  try {
    const body = await request.arrayBuffer();
    
    const response = await fetch(walrusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/octet-stream',
        'User-Agent': 'WalTodo/1.0',
      },
      body: body,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Walrus API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Walrus Publisher Error]', error);
    return NextResponse.json(
      { error: 'Failed to publish to Walrus' },
      { status: 500 }
    );
  }
}