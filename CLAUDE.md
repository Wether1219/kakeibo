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
  - [x] 取引入力（transactionsテーブル、`/transactions` CRUD API）実装済み（2026-08-13）。SC03画面（フロント）も実装済み（2026-08-14、`frontend/src/pages/TransactionInput.tsx`）。設計書3.1の2段階費目選択（固定費/変動費→費目）を維持しつつ、①区分→②費目→③対象者→④保存の4タップで完了する構成（金額はテンキー入力のためタップ数に含めない）。「自分」が誰かは認証未実装のため`localStorage`（`kakeibo_current_user_id`）で暫定管理し、対象者トグルの初期値・`x-user-id`ヘッダーに利用（`frontend/src/hooks/useTransactionForm.ts`、JWT認証実装時に置き換えること）。保存後は日付・対象者・金額・メモをリセットし連続入力に対応（区分・費目は直前の選択を維持し再入力を高速化）。Playwrightでdev環境（backend:3001 / frontend:5173）に対し実際にフォーム入力→保存→DB反映まで動作確認済み（コンソールエラーなし）
  - [x] 収入・先取り貯金入力（incomes/pre_savingsテーブル、`/incomes`・`/pre-savings` の一覧取得＋一括更新API、SC05画面）実装済み（2026-08-13）。カテゴリのtype整合性チェック（income/pre_saving）・household分離を含む。SC05表示のため`users`テーブルに`display_name`・`household_id`を先行追加し、`GET /users`（household内一覧）も追加。フロントは`App.tsx`に簡易タブナビ（react-router未導入、暫定）で費目マスタ画面と切替表示
  - [x] ダッシュボード：`GET /summary/monthly` API実装済み（2026-08-13）。`backend/src/services/summaryLogic.ts`に5.1按分（shared端数はcreatedBy側に+1円）・5.2週番号・5.3当月収支サマリ・5.4比率計算（ゼロ除算ガード）を純粋関数として実装し単体テスト済み（`tests/summaryLogic.test.ts`）。`summaryService.ts`でDB集計しAPI化、統合テストは`tests/summary.test.ts`。2026-08-14、SC02使用API対応のため`fixedExpenseByCategory`/`variableExpenseByCategory`の各要素を`{category, [displayName]: amount}`から`{categoryId, icon, name, amounts: {userId: amount}}`形式に変更（世帯人数が可変でもフロント側で対応できるよう）。あわせて`GET /transactions`に`limit`・`sort=date_desc`（それ以外の値は400）を追加（`transactionService.ts`の`listTransactions`に`take`反映）。SC02画面（フロント）実装済み：`frontend/src/pages/SC02_Dashboard.tsx`・`hooks/useDashboard.ts`。`components/YearSelector.tsx`・`MonthSelector.tsx`・`BalanceSummaryCard.tsx`・`ExpensePieCharts.tsx`・`WeeklyBudgetProgress.tsx`・`RecentTransactions.tsx`・`components/charts/`（DoughnutChart/LineChart/StackedBarChart、react-chartjs-2ラッパー）・`constants/categoryColors.ts`（固定費7色・変動費9色パレット）を実装し`App.tsx`の簡易ナビに「ダッシュボード」タブとして組み込み済み
- [ ] フェーズ2: 予算・集計（週次予算/年間推移/収支可視化）
  - [x] 週次予算（weekly_budgetsテーブル、`/weekly-budgets`の一覧取得〔実績付き〕＋一括更新API）実装済み（2026-08-13）。テーブルは予算額のみ保持し、実績は`summaryLogic.ts`の`apportionTransactionAmount`（5.1按分・世帯全ユーザー分を合算）と`calculateWeekNumber`（5.2週番号）を再利用してtransactionsから都度集計（`weeklyBudgetService.ts`）。カテゴリのtype整合性チェック（variable_expense）・household分離を含む。`calculateWeekNumber`は月末が日曜の場合に第6週を返しうるためweekNoは1〜6を許容（設計書1.7節「1〜5」はTINYINTコメントであり上限ではない）。GETは月末を含む週まで費目×週の全組み合わせを返す（予算・実績が0件の週も含む、SC06の週表示自動切替に対応）。単体テストは`tests/weeklyBudgets.test.ts`。SC06画面（フロント）は未着手
  - [x] 年間推移（SC07、`GET /summary/annual?year=`）実装済み（2026-08-14）。`summaryService.ts`の`getAnnualSummary`で、`income`/`pre_saving`は各月のincome.amount／preSaving.actualAmountを費目×ユーザー単位で集計、`fixed_expense`/`variable_expense`は既存の`apportionTransactionAmount`で按分してtransactionDateの月に加算し、有効な費目×世帯全ユーザーの組み合わせごとに`months[0..11]`（1月=index0、データなし月は0円）と`annualTotal`を持つ行を返す（`docs/06_画面補足仕様書.md`のレスポンス形式に準拠、`categoryName`はicon+name連結）。単体テストは`tests/summary.test.ts`（12ヶ月全データあり／一部月データなしの0埋めケース）。SC07画面（フロント）実装済み（2026-08-14）：`frontend/src/pages/SC07_AnnualTrend.tsx`（年セレクタ・区分タブ・クロス集計テーブル・費目プルダウン＋人別チェックボックスで系列切替する折れ線グラフ）、`components/CategoryTypeTab.tsx`・`AnnualCrossTable.tsx`（費目列`sticky`固定＋`overflow-x-auto`で横スクロール）、`hooks/useAnnualSummary.ts`、`api/summary.ts`に`fetchAnnualSummary`を追加。`App.tsx`の簡易ナビに「年間推移」タブとして追加。Playwrightでdev環境（backend:3001 / frontend:5174）に対しタブ切替・グラフ表示まで実際に動作確認済み（コンソールエラーなし）。2026-08-14、`components/MonthlySavingsSummary.tsx`を追加し、月々の貯金合計（ユーザー別＋合計、マイナスは赤字）を表示。貯金合計(e)=先取り貯金(b)+余り貯金(d)は展開すると収入(a)−支出(c)と同値（`docs/03_詳細設計書.md`5.3節）のため、API追加なしで既存rows（income/fixed_expense/variable_expense）から単純加減算のみで算出。当初は常時表示だったが、その後「収入」等と同様タブ切替式に変更（`CategoryTypeTab`に`SummaryTabType = CategoryType | 'savings_total'`を追加し「貯金合計」タブを新設、選択時は`AnnualCrossTable`の代わりに`MonthlySavingsSummary`とグラフ用ユーザーチェックボックスのみ表示、費目プルダウンは非表示）。さらに「固定費」「変動費」「先取り貯金」タブの費目選択プルダウンに「合計（全費目）」の選択肢を追加し（`TOTAL_OPTION`センチネル、`SC07_AnnualTrend.tsx`）、選択中区分内の全費目をユーザーごとに合算した月次推移をグラフで確認できるようにした（クロス集計テーブル下部の合計行と同じ集計）。加えて「貯金合計」タブに貯蓄率（`MonthlySavingsSummary.tsx`、ユーザー別行の下に小さめのグレー文字で表示、合計行にも同様）を追加。貯蓄率=貯金合計÷収入×100（`docs/03_詳細設計書.md`5.4節と同じゼロ除算ガード、収入0の月は0%）。年間合計欄の貯蓄率は月別比率の平均ではなく年間貯金合計÷年間収入で算出
- [ ] フェーズ3: 資産管理・Excel移行
  - [x] Excelデータ移行スクリプト（`backend/src/migration/`）実装済み（2026-08-13）。docs/03_詳細設計書.md 6章に従い、費目マスタ→incomes→pre_savings→transactions→weekly_budgetsの順でテーブルごとに1関数（`importCategories.ts`等）を実装。CLIは`npm run migrate:excel -- <xlsmパス> <household_id>`（`runImport.ts`）。費目名セルは正規表現でアイコン/名前を分離（`splitIconName`、`excelUtil.ts`）。各月シートの年・月はシート名ではなくB1/B3セルの値を使用。取引の日付未入力行はスキップ（テンプレートの空行のため）。固定費・変動費で費目名が重複した場合は固定費側を優先マッピング（重複は現状未発生）。資産管理（assets/asset_balances）はテーブル未設計のためスコープ外・フェーズ3着手時に別途対応
  - [x] 移行テスト（`backend/tests/excelMigration.test.ts`）：アップロード雛形（`backend/tests/fixtures/雛形_家計簿_第1_4版.xlsm`、費目名以外ほぼ空欄のテンプレート）を全12ヶ月移行し、件数（費目24・収入120・先取り貯金96・週次予算480）と、年間推移シートの収入・固定費・変動費セル値をDB集計値（月次シートのSUMIFS式と同じ集計条件をJSで再現）と全月・全費目で突合。テンプレートが空データのため実質0円同士の一致検証に留まるが、加えて27年1月シートの一部セルに実データを模した値をメモリ上で書き込み、移行・集計ロジックが非ゼロ値でも元Excelの計算式（固定費=本人分のみ、変動費=本人分+「両方」分/2）通りに動くことを検証済み
  - [x] 資産管理（assets/asset_balancesテーブル、`/assets`のCRUD＋`/asset-balances`の一覧取得〔人別小計・世帯合計付き〕＋一括更新API）実装済み（2026-08-14）。docs/03_詳細設計書.md 1.8/1.9節に厳密に従いPrismaスキーマ追加（`AssetGroup` enum、`Asset`・`AssetBalance`モデル、マイグレーション`20260814134838_add_assets`）。`backend/src/services/assetService.ts`（口座CRUD、`ownerUserId`がhousehold内ユーザーであることを検証）・`assetBalanceService.ts`（`bulkUpsertAssetBalances`はweeklyBudgetServiceと同じbefore/after対付きupsertパターン、`listAssetBalances`は指定年の資産×1〜12月残高一覧に加え名義人別小計・世帯合計を算出して返す）。`routes/assets.ts`・`routes/assetBalances.ts`を追加しapp.tsに`/api/v1/assets`・`/api/v1/asset-balances`として登録。単体テストは`tests/assets.test.ts`・`tests/assetBalances.test.ts`（household分離・人別小計計算・他世帯assetId指定の拒否を含む、13件全通過）。SC09画面（フロント）実装済み（2026-08-14）：`frontend/src/pages/SC09_AssetManagement.tsx`（YearSelector＋`AssetGroupTab`〔現金・預貯金/証券・株式/保険〕＋`AssetBalanceTable`＋資産推移積み上げ棒グラフ）。`AssetBalanceTable`はセルクリック→input表示→blur/Enterで確定→`useAssetBalances`フック（`frontend/src/hooks/useAssetBalances.ts`）内で口座×月ごとに500msデバウンスして`PUT /asset-balances/bulk`を呼ぶ実装（保存中セルはスピナー代わりに「保存中...」テキスト表示、保存成功後に一覧を再取得して人別小計・合計行の集計値を更新）。人別小計・合計行はAPIレスポンスの集計値をそのまま表示し入力不可。名称列は`sticky`固定＋テーブル全体`overflow-x-auto`でスマホ横スクロール対応。`AddAssetModal`（名称/名義/詳細/用途/積立額、名義は`GET /users`で取得した世帯内ユーザーから選択）を追加し口座追加に対応。`frontend/src/api/assets.ts`・`assetBalances.ts`を新規追加、`App.tsx`の簡易ナビに「資産管理」タブとして組み込み済み。バックエンドAPI（口座追加・残高一括更新・人別小計/合計集計）はcurlで動作確認済み、フロントは`tsc --noEmit`・`vite build`が通ることを確認済み（Playwright等ブラウザでの実動作確認は未実施）。2026-08-14、口座の削除機能を追加：`AssetBalanceTable`の各行に「削除」ボタンを追加し、`window.confirm`後に`frontend/src/api/assets.ts`の`deactivateAsset()`（`PUT /assets/:id`に`isActive:false`を送る、既存の更新APIを流用した論理削除）を呼び出し、成功後に残高一覧を再取得する実装（`SC09_AssetManagement.tsx`）。バックエンドは新規エンドポイント追加なし。curlで削除後に`GET /asset-balances`から対象口座が消えることを確認済み
- [ ] フェーズ4: 変更履歴・エクスポート・仕上げ
  - [x] 変更履歴（audit_logsテーブル、`GET /audit-logs`）実装済み（2026-08-13）。`backend/src/services/auditLogService.ts`の`recordAuditLog`/`recordAuditLogs`（bulk用）で記録し、`diff_json`は`{ before, after }`形式（該当なしはundefined）。既存の各`serializeXxx`関数を再利用しBigInt/Decimalを安全にJSON化。household分離・`?targetTable=&limit=`（デフォルト50・上限200）に対応
  - [x] 既存のPUT/POST/DELETE系APIに監査ログ記録処理を追加（2026-08-13）：`categories`（POST/PUT/DELETE）、`transactions`（POST/PUT/DELETE）、`incomes`・`pre-savings`・`weekly-budgets`（PUT /bulk、upsert前の既存行をまとめて取得しitem毎にcreate/update判定）。`audit_logs.user_id`がNOT NULLのため、これまで操作者IDを受け取っていなかった`categories`の全操作・`incomes`/`pre-savings`/`weekly-budgets`のbulk・`transactions`のPUT/DELETEに`userMiddleware`（`x-user-id`必須）を追加（既存テストは`x-user-id`ヘッダー付与＋ユーザーfixture追加で対応済み）。単体テストは`backend/tests/auditLogs.test.ts`
  - [x] CSV/Excelエクスポート（F15、`GET /export?format=csv|xlsx`）実装済み（2026-08-14）。`backend/src/services/exportService.ts`でhousehold単位のデータを取得しcsv文字列/xlsxバッファを生成、`backend/src/routes/export.ts`でファイル返却（householdMiddlewareのみ、更新系ではないためuserMiddleware不要）。xlsxは既存依存の`xlsx`パッケージ（移行スクリプトと共用）でマルチシート（費目マスタ／取引／収入／先取り貯金／週次予算）を生成。csvはマルチシート非対応のため取引一覧のみ出力（費目名・対象者名を人が読める形に変換、UTF-8 BOM付与でExcel文字化け対策）。assetsは未実装のためスコープ外。単体テストは`backend/tests/export.test.ts`（他世帯データが出力されないことを含む）。あわせてSC03（取引入力画面）の3タップ要件を設計レビューし、設計書3.1の2段階費目選択のままでは3タップを超えると判明したため、4タップ構成に方針変更のうえフェーズ1でSC03画面を実装（詳細は上記フェーズ1の該当行を参照）
  - [x] 費目マスタ管理のバグ修正（2026-08-14）：無効化（論理削除、`is_active=false`）した費目と同じ区分・名前で再追加しようとすると`@@unique([householdId, type, name])`制約に阻まれ409エラーになっていた（MySQLは部分ユニークインデックス非対応のため無効化済み行が制約を占有し続けるのが原因）。`categoryService.ts`の`createCategory`を修正し、同名の無効化済み費目が存在する場合はそれを再有効化（`isActive: true`、アイコンは指定があれば更新、idは維持）する仕様に変更。監査ログはこの場合`update`として記録（`routes/categories.ts`）。`backend/tests/categories.test.ts`にテスト追加、既存72件含め全テスト通過確認済み
  - [x] 費目マスタ管理のバグ修正（2026-08-14）：「費目マスタ管理」を最初の画面として開く（取引入力画面を一度も使わない）と費目を追加できない不具合を修正。`categories`等の更新系API（POST/PUT/DELETE）が必須とする`x-user-id`ヘッダーは、これまで`localStorage`の`kakeibo_current_user_id`にのみ依存しており、このキーは取引入力画面（`useTransactionForm.ts`）で対象者を明示的に切り替えたときしか書き込まれていなかったため未設定になりうるのが原因（バックエンドの401をフロントが握りつぶし「費目の追加に失敗しました」という汎用エラーになっていた）。`frontend/src/api/users.ts`に`ensureCurrentUserId()`（未設定なら世帯の先頭ユーザーを取得しlocalStorageへ保存）を追加し、`categories.ts`・`incomes.ts`・`preSavings.ts`・`weeklyBudgets.ts`の更新系関数（create/update/deactivate、bulk系）から呼び出すよう修正（同じ実装パターンだったincomes/preSavings/weeklyBudgetsも同時に修正）。PlaywrightでlocalStorageを空の状態から「費目マスタ管理」タブに直接遷移し費目追加が成功することを確認済み（コンソールエラーなし）

### 補足（2026-08-13時点）
- 開発用MySQLコンテナ（`kakeibo-mysql`）に、現行設計と不整合な旧`categories`/`transactions`テーブル（`household_id`なし、ダミーデータ16件）が残存していたため削除済み。バックアップは開発者のスクラッチ領域に保存（リポジトリ外）。今後同様の旧データが必要な場合は要相談。
- `kakeibo_user`にシャドウDB作成用の`CREATE, DROP, ALTER, REFERENCES, INDEX`グローバル権限を付与済み（`prisma migrate dev`に必要）。
- `users`テーブルは認証機能未実装のため`households`と同様の最小限スタブだったが、2026-08-13にSC05表示用の`display_name`・`household_id`を追加済み（`email`/`password_hash`/`color_code`はJWT認証実装時に追加）。
- 開発用DBのhousehold_id=1に、SC05動作確認用のダミーデータ（ユーザー2名「たいよう」「みらの」、収入費目「給与」、先取り貯金費目「積立NISA」）を投入済み。本番投入データではないため、認証実装時など必要に応じて削除・差し替えて問題ない。