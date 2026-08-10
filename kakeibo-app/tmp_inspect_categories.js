const mysql = require('mysql2/promise');

const rowsToLog = (rows) => rows.map((row) => ({
  id: row.id,
  name: row.name,
  hexUtf8: Buffer.from(row.name, 'utf8').toString('hex'),
  hexBinary: Buffer.from(row.name, 'binary').toString('hex'),
}));

(async () => {
  for (const cfg of [
    { charset: 'binary', label: 'binary' },
    { charset: 'utf8mb4', label: 'utf8mb4' },
  ]) {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'root',
      database: 'kakeibo',
      charset: cfg.charset,
    });
    const [rows] = await conn.query('SELECT id, name FROM categories WHERE id >= 33 ORDER BY id');
    console.log('---', cfg.label, '---');
    console.log(JSON.stringify(rowsToLog(rows), null, 2));
    await conn.end();
  }
})().catch((err) => { console.error(err); process.exit(1); });
