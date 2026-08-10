import { db } from '@/lib/db';

export async function GET() {
  const [rows] = await db.query(`
    SELECT 
      DATE_FORMAT(date, '%Y-%m') AS month,
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    GROUP BY month
    ORDER BY month
  `);

  return Response.json(rows);
}
