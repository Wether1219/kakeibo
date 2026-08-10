import './globals.css';

export const metadata = {
  title: '家計簿アプリ',
  description: '簡易家計簿アプリ（Next.js + MySQL）',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header style={{ padding: 20, borderBottom: '1px solid #eee' }}>
          <h1>家計簿アプリ</h1>
        </header>
        <main style={{ padding: 20 }}>{children}</main>
      </body>
    </html>
  );
}
