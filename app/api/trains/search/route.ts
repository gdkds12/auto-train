// web/app/api/trains/search/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Forward the request to the worker service
    const workerResponse = await fetch('http://worker:8000/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json();
      return NextResponse.json(
        { message: errorData.detail || 'Failed to search trains in worker' },
        { status: workerResponse.status }
      );
    }

    const data = await workerResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/trains/search:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 }
    );
  }
}