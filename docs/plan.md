-*- coding: utf-8 -*-

# 実装計画書

本書は [spec.md](spec.md) を入力として、関数単位のボトムアップ実装ステップを定める。
各Stepは原則Step 0から順に進め、**完了条件はテストがgreenであること**とする（Step 3のみ手動確認）。

## Step 0: 開発環境構築

- `cargo create-tauri-app` 等でTauri（Vite + Vanilla JSテンプレート）のプロジェクト雛形を作成する。
- ディレクトリ構成を spec.md 1章の通りに整備する（`src/js/*.js`、`tests/`、`tests/fixtures/`）。
- npm依存として `pdf.js`、`@tauri-apps/plugin-dialog`、`vitest` を追加する。
- `tests/fixtures/` に縦長PDF・横長PDF（各数ページ程度）の簡易サンプルを配置する。
- **テスト**: `npm run tauri dev` で空ウィンドウが起動すること。`npm test`（Vitest）が0件のテストで正常終了すること。`cargo test` が正常終了すること。
- **完了条件**: 上記いずれも成功する。

## Step 1: main.rs - `get_initial_pdf_path`

- 依存: Step 0
- コマンドライン引数からPDFファイルパスを取り出す処理を純粋関数として実装し、Tauriコマンド `get_initial_pdf_path` から呼び出す。
- **テスト**（`cargo test`）: 引数ありの場合にパスが返ること／引数なしの場合に`None`が返ること。
- **完了条件**: 該当テストgreen。

## Step 2: main.rs - `read_pdf_file`

- 依存: Step 1
- 指定パスのPDFファイルをバイナリ（`Vec<u8>`）として読み込むTauriコマンドを実装する。存在しない・読み込み失敗時はErrを返す。
- **テスト**（`cargo test`）: `tests/fixtures/` のサンプルPDFを読み込みバイト列が取得できること／存在しないパス指定でErrが返ること。
- **完了条件**: 該当テストgreen。

## Step 3: tauri.conf.json ウィンドウ設定 + ダイアログプラグイン導入

- 依存: Step 0
- `tauri.conf.json` にてメニューバーなし・通常ウィンドウ（リサイズ可・最大化可）・タイトルバーありを設定する。
- `tauri-plugin-dialog` を登録し、フロントエンドからファイル選択ダイアログを呼び出せるようにする。
- **テスト**: 手動確認（アプリ起動時にメニューバー・サイドバーが表示されないこと、ウィンドウがリサイズ・最大化できること、ダイアログ呼び出しでOSのファイル選択画面が開くこと）。
- **完了条件**: 手動確認チェックリストをすべて満たす。

## Step 4: pageNavigator.js

- 依存: Step 0
- `init(totalPages)` / `next()` / `prev()` / `getCurrentPage()` を実装する。
- **テスト**（Vitest）: 通常の前後移動でページ番号が増減すること／先頭ページで`prev()`しても変化しないこと／最終ページで`next()`しても変化しないこと。
- **完了条件**: 該当テストgreen。

## Step 5: pdfViewer.js - `calculateFitScale`

- 依存: Step 0
- ページviewportとウィンドウサイズから、アスペクト比を保ちつつウィンドウ内に収まる最大スケールを算出する純粋関数を実装する。
- **テスト**（Vitest）: 縦長ページ×横長ウィンドウ／横長ページ×縦長ウィンドウ／ページとウィンドウが同一アスペクト比、の各パターンで正しいスケール値が算出されること。
- **完了条件**: 該当テストgreen。

## Step 6: pdfViewer.js - `loadPdf` / `renderPage` / `onResize`

- 依存: Step 5
- pdf.jsを用いてバイナリからPDFドキュメントを読み込み、指定ページをCanvasに描画する処理を実装する。
- **テスト**（Vitest。Canvas描画は`vitest-canvas-mock`等でモック）: `tests/fixtures/` のサンプルPDFを読み込み総ページ数が正しく取得できること／`renderPage`が例外なく完了すること／`onResize`後に再描画が行われること。
- **完了条件**: 該当テストgreen。

## Step 7: laserPointer.js

- 依存: Step 0
- `startStroke` / `addPoint` / `endStroke` によるストローク記録、`render()` によるオーバーレイ描画（直径40〜50px相当の丸、1〜2秒でのフェードアウト・破棄）を実装する。
- **テスト**（Vitest。`vi.useFakeTimers()`等で時間経過をシミュレート）: クリックのみで1点のストロークが記録されること／ドラッグで複数点のストロークが記録されること／`endStroke`後、時間経過に応じて透明度が減衰すること／1〜2秒経過後にストロークが破棄されること。
- **完了条件**: 該当テストgreen。

## Step 8: inputHandler.js

- 依存: Step 4, Step 7
- キーボード（→・↓・Space＝次ページ、←・↑・Backspace＝前ページ、Escape＝終了）、ホイール（下回転＝次ページ、上回転＝前ページ）、右クリック（mousedown/mousemove/mouseup＝レーザーポインター操作）のイベントハンドラを実装し、`pageNavigator` / `laserPointer` に処理を委譲する。`contextmenu` イベントは`preventDefault()`で抑止する。
- **テスト**（Vitest。jsdomでのイベントディスパッチ）: 各キー・ホイール操作で`pageNavigator.next()`/`prev()`が呼ばれること／Escapeでウィンドウクローズ処理が呼ばれること／右クリックのmousedown〜mouseupで`laserPointer`の各関数が呼ばれること／レーザーポインター操作中でもページ送り操作が有効であること。
- **完了条件**: 該当テストgreen。

## Step 9: app.js - 起動フロー統合

- 依存: Step 2, Step 3, Step 6, Step 8
- `get_initial_pdf_path` 呼び出し→パスがあれば `read_pdf_file`、なければダイアログ表示→取得したバイナリを `pdfViewer.loadPdf` に渡す→`pageNavigator.init`→`pdfViewer.renderPage(1)`→`inputHandler` の初期化、という起動フローを実装する。
- **テスト**（Vitest。Tauriの`invoke`呼び出しをモック）: 引数ありの場合にダイアログを経由せずPDFが表示されること／引数なしの場合にダイアログ経由でPDFが表示されること。
- **完了条件**: 該当テストgreen。

## Step 10: 結合・シナリオ確認

- 依存: Step 9
- 全モジュールを結合したアプリケーションに対して、spec.md 5章「テスト設計」の13項目（起動、ページ送り、境界、終了、レーザーポインター、リサイズ、フィット表示）を手動シナリオとして実施する。
- 併せて `npm test` / `cargo test` を通しで実行し、これまでの自動テストがすべてgreenであることを確認する。
- **完了条件**: 自動テストが全てgreen、かつspec.md 5章の13項目すべてが合格する。
