import { NextRequest, NextResponse } from 'next/server';

// Error tracking endpoint for client-side errors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { errors } = body;

    // Log errors (in production, this would send to Sentry or similar)
    console.error('[Client Error Batch]', {
      timestamp: new Date().toISOString(),
      count: errors.length,
      errors: errors,
    });

    // In production, forward to Sentry
    if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
      // Sentry error forwarding logic would go here
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Monitoring API Error]', error);
    return NextResponse.json(
      { error: 'Failed to process error batch' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  };

  return NextResponse.json(health);
}