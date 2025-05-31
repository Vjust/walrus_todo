import { NextResponse } from 'next/server';

// Cron job health check endpoint
export async function GET() {
  try {
    // Perform health checks
    const checks = {
      database: await checkDatabase(),
      walrus: await checkWalrusConnection(),
      sui: await checkSuiConnection(),
      memory: checkMemoryUsage(),
      timestamp: new Date().toISOString(),
    };

    const allHealthy = Object.values(checks).every(
      (check) => typeof check === 'boolean' ? check : true
    );

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
    });
  } catch (error) {
    console.error('[Health Check Error]', error);
    return NextResponse.json(
      { status: 'error', error: 'Health check failed' },
      { status: 500 }
    );
  }
}

async function checkDatabase(): Promise<boolean> {
  // Check database connection
  // This would connect to your database and verify it's accessible
  return true;
}

async function checkWalrusConnection(): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL}/v1/status`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function checkSuiConnection(): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUI_RPC_URL}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sui_getLatestCheckpointSequenceNumber',
          params: [],
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

function checkMemoryUsage(): { heapUsed: number; heapTotal: number; rss: number } {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
  };
}