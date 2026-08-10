# kakeibo-app

ローカルで Next.js（TypeScript + App Router）を立ち上げるサンプルプロジェクトです。

セットアップ:

```bash
cd kakeibo-app
npm install
# 環境変数を .env.local に配置（例は ../.env.example を参照）
npm run dev
```

動作確認:

ブラウザで `http://localhost:3000/api/test` にアクセスすると DB テストの結果が返ってきます（DB が稼働していること）。

ブランチ戦略:

- `main` : 本番リリース用
- `dev` : 開発統合ブランチ
- `feature/api` : API 開発
- `feature/frontend` : フロントエンド画面開発
- `feature/db` : DB スキーマ／データベース関連
- `feature/chart` : グラフ表示機能
- `feature/export` : Excel 出力機能
