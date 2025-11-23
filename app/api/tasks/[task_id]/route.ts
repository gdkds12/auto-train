import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ task_id: string }> }) {
  const { task_id } = await context.params;
  try {
    const workerResponse = await fetch(`http://worker:8000/tasks/${task_id}`);

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json();
      return NextResponse.json(
        { message: errorData.detail || 'Failed to fetch task status from worker' },
        { status: workerResponse.status }
      );
    }

    const data = await workerResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in /api/tasks/${task_id}:`, error);
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 }
    );
  }
}
