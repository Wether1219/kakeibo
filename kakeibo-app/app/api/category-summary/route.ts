import { db } from '@/lib/db';

export async function GET() {
  const [rows] = await db.query(`
    SELECT category,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    GROUP BY category
  `);

  return Response.json(rows);
}
