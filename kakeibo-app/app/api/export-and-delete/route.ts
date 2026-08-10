import { db } from '@/lib/db';

function escapeCsvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(header: string[], rows: Record<string, unknown>[]) {
  const lines = [header.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    const values = header.map((field) => escapeCsvValue(row[field] ?? ''));
    lines.push(values.join(','));
  }
  return lines.join('\r\n');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get('month');

  let query = 'SELECT id, user_id, DATE_FORMAT(date, "%Y-%m-%d") AS date, type, category, amount, memo FROM transactions';
  const params: any[] = [];
  if (month) {
    query += ' WHERE DATE_FORMAT(date, "%Y-%m") = ?';
    params.push(month);
  }
  query += ' ORDER BY date DESC';

  const [rows] = await db.query(query, params) as any[];

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ message: 'No data to export' }), { status: 204, headers: { 'Content-Type': 'application/json' } });
  }

  const header = ['id', 'user_id', 'date', 'type', 'category', 'amount', 'memo'];
  const csvText = buildCsv(header, rows);
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(',');

  try {
    await db.beginTransaction();
    await db.query(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
    await db.commit();
  } catch (error) {
    await db.rollback();
    console.error('Export succeeded but delete failed:', error);
    return new Response(JSON.stringify({ message: 'Export succeeded but delete failed', error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(csvBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      'Content-Length': String(csvBuffer.length)
    }
  });
}
