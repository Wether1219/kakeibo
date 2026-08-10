import mysql from 'mysql2/promise';

export const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'root',
  database: process.env.DB_NAME ?? 'kakeibo',
  charset: 'utf8mb4',
});

export async function query(sql: string, params?: any[]) {
  const [rows] = await db.query(sql, params);
  return rows;
}
