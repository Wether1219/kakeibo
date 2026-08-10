import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const sql = `
    SELECT 
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    WHERE MONTH(date) = MONTH(CURRENT_DATE())
  `;

  const [rows]: any = await db.query(sql);
  const income = Number(rows[0]?.income ?? 0);
  const expense = Number(rows[0]?.expense ?? 0);

  return NextResponse.json({ income, expense, balance: income - expense });
}
