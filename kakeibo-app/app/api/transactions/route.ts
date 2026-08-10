import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id = 1, date = null, type = 'expense', category = 'その他', amount, memo = null } = body;

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return NextResponse.json({ status: 'error', message: 'amount is required' }, { status: 400 });
    }

    const sql = `INSERT INTO transactions (user_id, date, type, category, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`;
    await db.query(sql, [user_id, date, type, category, amount, memo]);

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message ?? String(err) }, { status: 500 });
  }
}

export async function GET() {
  const [rows] = await db.query(`SELECT * FROM transactions ORDER BY date DESC`);
  return NextResponse.json(rows);
}
