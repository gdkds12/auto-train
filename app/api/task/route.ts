// web/app/api/task/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      accountId,
      depStation,
      arrStation,
      date,
      timeFrom,
      timeTo,
      passengers,
      interval,
      isActive,
      status,
    } = body;

    const task = await prisma.task.create({
      data: {
        accountId: parseInt(accountId),
        depStation,
        arrStation,
        date,
        timeFrom,
        timeTo,
        passengers: parseInt(passengers),
        interval: parseInt(interval),
        isActive: Boolean(isActive),
        status,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { message: 'Failed to create task', error: (error as Error).message },
      { status: 500 }
    );
  }
}
