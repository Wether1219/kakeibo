import { db } from '@/lib/db';

export async function GET() {
  const [rows] = await db.query('SELECT * FROM categories');
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { user_id, name } = body;

  await db.query(
    `INSERT INTO categories (user_id, name) VALUES (?, ?)`,
    [user_id, name]
  );

  return Response.json({ status: 'ok' });
}
