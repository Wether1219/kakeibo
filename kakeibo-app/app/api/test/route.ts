import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [rows] = await db.query('SELECT 1 + 1 AS result');
  return NextResponse.json(rows);
}
