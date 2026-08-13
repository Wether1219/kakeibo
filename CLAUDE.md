# CLAUDE.md

このファイルはClaude Codeがセッション開始時に自動で読み込むプロジェクト共通コンテキストです。
**ここに書いてある内容は毎回のプロンプトで説明し直さないこと。** 詳細が必要な場合のみ `docs/` 内の該当ファイルを読むこと。

## 言語設定
- 常に日本語で会話・応答する
- コードコメントも日本語で記述する
- エラーメッセージの説明も日本語で行う

## プロジェクト概要
2人世帯向け家計簿Webアプリ（既存Excelマクロブックのリプレイス）。
詳細要件は `docs/01_要件定義書.md` 参照（読むのは実装対象機能の該当節のみでよい）。

## 技術スタック（確定事項・変更しない）
- フロントエンド: React + Vite + TypeScript + Tailwind CSS + Chart.js
- バックエンド: Node.js + Express + TypeScript + Prisma ORM
- DB: MySQL 8.x（Docker Compose、`docker-compose.yml`参照）
- 認証: JWT + bcrypt
- 文字コード: utf8mb4（絵文字アイコン費目のため必須）

## ディレクトリ構成
`docs/04_開発計画書.md` 2章のフォルダ構成に従う。新規ファイルもこの構成を踏襲すること。

## コーディング規約
- テーブル/カラム名: スネークケース。API/TS: キャメルケース
- コミットメッセージ: `feat: 〜 (F03)` `fix: 〜` `docs: 〜` 形式、機能IDを付与
- 1機能=1ブランチ（`feature/f03-transaction-input`のように機能IDを含める）
- 集計ロジック（按分・週次判定・比率計算）は必ず単体テストを書く（`docs/03_詳細設計書.md` 5章のロジック定義に厳密に従う）
- 全APIで `household_id` によるデータ分離を必須とする（他世帯データへのアクセス禁止）

## ドキュメント参照ルール（トークン節約のため厳守）
- テーブル定義が必要な時 → `docs/03_詳細設計書.md` の該当テーブルの節のみ読む（1章全部は読まない）
- API仕様が必要な時 → 同ファイル4章の該当行のみ読む
- 画面仕様が必要な時 → 同ファイル3章の該当画面のみ読む
- 既に読んだ内容は再度読み直さず、自分の実装計画メモとして要約を残す

## 実装フロー（機能ごとに必ずこの順で進める）
1. 対象機能の要件・設計該当箇所を読む（該当節のみ）
2. 実装計画を箇条書きで提示し、着手前に承認を得る（大きな出力は作らない）
3. DBマイグレーション → API → フロントの順に実装
4. 単体テスト作成・実行
5. 完了したらこのCLAUDE.mdの「進捗」セクションを更新する

## 進捗（Claude Codeが実装完了ごとに追記すること）
- [ ] フェーズ0: 環境構築・認証
  - [x] docker-compose.yml / backend・frontend初期構成（package.json, tsconfig, Prisma, Vite+Tailwind）
  - [ ] JWT認証（未着手。現状は`x-household-id`/`x-user-id`ヘッダーによる暫定household_id/user_id取得で代替。認証実装時に`backend/src/middlewares/household.ts`を差し替えること）。`users`テーブルに`email`/`password_hash`/`color_code`（設計書1.2節）は未追加で、認証実装時に追加すること
- [ ] フェーズ1: コア機能（取引入力/収入・先取り貯金入力/ダッシュボード/費目マスタ）
  - [x] 費目マスタ（categoriesテーブル、`/categories` API、SC10画面）実装済み（2026-08-13）
  - [x] 取引入力（transactionsテーブル、`/transactions` CRUD API）実装済み（2026-08-13）。SC03画面（フロント）は未着手
  - [x] 収入・先取り貯金入力（incomes/pre_savingsテーブル、`/incomes`・`/pre-savings` の一覧取得＋一括更新API、SC05画面）実装済み（2026-08-13）。カテゴリのtype整合性チェック（income/pre_saving）・household分離を含む。SC05表示のため`users`テーブルに`display_name`・`household_id`を先行追加し、`GET /users`（household内一覧）も追加。フロントは`App.tsx`に簡易タブナビ（react-router未導入、暫定）で費目マスタ画面と切替表示
  - [x] ダッシュボード（バックエンドのみ）：`GET /summary/monthly` API実装済み（2026-08-13）。`backend/src/services/summaryLogic.ts`に5.1按分（shared端数はcreatedBy側に+1円）・5.2週番号・5.3当月収支サマリ・5.4比率計算（ゼロ除算ガード）を純粋関数として実装し単体テスト済み（`tests/summaryLogic.test.ts`）。`summaryService.ts`でDB集計しAPI化、統合テストは`tests/summary.test.ts`。SC02画面（フロント）は未着手
- [ ] フェーズ2: 予算・集計（週次予算/年間推移/収支可視化）
  - [x] 週次予算（weekly_budgetsテーブル、`/weekly-budgets`の一覧取得〔実績付き〕＋一括更新API）実装済み（2026-08-13）。テーブルは予算額のみ保持し、実績は`summaryLogic.ts`の`apportionTransactionAmount`（5.1按分・世帯全ユーザー分を合算）と`calculateWeekNumber`（5.2週番号）を再利用してtransactionsから都度集計（`weeklyBudgetService.ts`）。カテゴリのtype整合性チェック（variable_expense）・household分離を含む。`calculateWeekNumber`は月末が日曜の場合に第6週を返しうるためweekNoは1〜6を許容（設計書1.7節「1〜5」はTINYINTコメントであり上限ではない）。GETは月末を含む週まで費目×週の全組み合わせを返す（予算・実績が0件の週も含む、SC06の週表示自動切替に対応）。単体テストは`tests/weeklyBudgets.test.ts`。SC06画面（フロント）は未着手
- [ ] フェーズ3: 資産管理・Excel移行
  - [x] Excelデータ移行スクリプト（`backend/src/migration/`）実装済み（2026-08-13）。docs/03_詳細設計書.md 6章に従い、費目マスタ→incomes→pre_savings→transactions→weekly_budgetsの順でテーブルごとに1関数（`importCategories.ts`等）を実装。CLIは`npm run migrate:excel -- <xlsmパス> <household_id>`（`runImport.ts`）。費目名セルは正規表現でアイコン/名前を分離（`splitIconName`、`excelUtil.ts`）。各月シートの年・月はシート名ではなくB1/B3セルの値を使用。取引の日付未入力行はスキップ（テンプレートの空行のため）。固定費・変動費で費目名が重複した場合は固定費側を優先マッピング（重複は現状未発生）。資産管理（assets/asset_balances）はテーブル未設計のためスコープ外・フェーズ3着手時に別途対応
  - [x] 移行テスト（`backend/tests/excelMigration.test.ts`）：アップロード雛形（`backend/tests/fixtures/雛形_家計簿_第1_4版.xlsm`、費目名以外ほぼ空欄のテンプレート）を全12ヶ月移行し、件数（費目24・収入120・先取り貯金96・週次予算480）と、年間推移シートの収入・固定費・変動費セル値をDB集計値（月次シートのSUMIFS式と同じ集計条件をJSで再現）と全月・全費目で突合。テンプレートが空データのため実質0円同士の一致検証に留まるが、加えて27年1月シートの一部セルに実データを模した値をメモリ上で書き込み、移行・集計ロジックが非ゼロ値でも元Excelの計算式（固定費=本人分のみ、変動費=本人分+「両方」分/2）通りに動くことを検証済み
- [ ] フェーズ4: 変更履歴・エクスポート・仕上げ

### 補足（2026-08-13時点）
- 開発用MySQLコンテナ（`kakeibo-mysql`）に、現行設計と不整合な旧`categories`/`transactions`テーブル（`household_id`なし、ダミーデータ16件）が残存していたため削除済み。バックアップは開発者のスクラッチ領域に保存（リポジトリ外）。今後同様の旧データが必要な場合は要相談。
- `kakeibo_user`にシャドウDB作成用の`CREATE, DROP, ALTER, REFERENCES, INDEX`グローバル権限を付与済み（`prisma migrate dev`に必要）。
- `users`テーブルは認証機能未実装のため`households`と同様の最小限スタブだったが、2026-08-13にSC05表示用の`display_name`・`household_id`を追加済み（`email`/`password_hash`/`color_code`はJWT認証実装時に追加）。
- 開発用DBのhousehold_id=1に、SC05動作確認用のダミーデータ（ユーザー2名「たいよう」「みらの」、収入費目「給与」、先取り貯金費目「積立NISA」）を投入済み。本番投入データではないため、認証実装時など必要に応じて削除・差し替えて問題ない。