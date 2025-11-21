// web/app/api/accounts/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: {
        id: 'asc',
      },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { message: 'Failed to fetch accounts', error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, username, password } = body;

    // Basic validation
    if (!type || !username || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // In a real app, you should encrypt the password here before saving
    const newAccount = await prisma.account.create({
      data: {
        type,
        username,
        password, // Storing plaintext password for this prototype
      },
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { message: 'Failed to create account', error: (error as Error).message },
      { status: 500 }
    );
  }
}
