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
- キーボード（→・↓・Space＝次ページ、←・↑・Backspace＝前ページ、Escape＝終了）、ホイール（下回転＝次ページ、上回転＝前ページ）、左クリック（mousedown/mousemove/mouseup＝レーザーポインター操作）のイベントハンドラを実装し、`pageNavigator` / `laserPointer` に処理を委譲する。`contextmenu` イベントは`preventDefault()`で抑止する（この時点では右クリックに機能は割り当てない。履歴メニューとの統合はStep 14で行う）。
- **テスト**（Vitest。jsdomでのイベントディスパッチ）: 各キー・ホイール操作で`pageNavigator.next()`/`prev()`が呼ばれること／Escapeでウィンドウクローズ処理が呼ばれること／左クリックのmousedown〜mouseupで`laserPointer`の各関数が呼ばれること／レーザーポインター操作中でもページ送り操作が有効であること。
- **完了条件**: 該当テストgreen。

## Step 9: app.js - 起動フロー統合

- 依存: Step 2, Step 3, Step 6, Step 8
- `get_initial_pdf_path` 呼び出し→パスがあれば取得したバイナリを `pdfViewer.loadPdf` に渡す→`pageNavigator.init`→`pdfViewer.renderPage(1)`→`inputHandler` の初期化、という起動フローを実装する。パスが得られない場合はPDFを読み込まず、ファイル選択ダイアログも表示しない（空白のウィンドウのまま `inputHandler` を初期化する）。ダイアログ表示はStep 15で「ファイルを開く」メニュー項目に切り出す。
- **テスト**（Vitest。Tauriの`invoke`呼び出しをモック）: 引数ありの場合にPDFが表示され`inputHandler.init`が呼ばれること／引数なしの場合はダイアログを呼び出さず`inputHandler.init`のみが呼ばれること。
- **完了条件**: 該当テストgreen。

## Step 10: 起動フロー統合の完了

- 依存: Step 9
- Step 9までの起動フロー統合を完了した状態。以降のファイル履歴機能（Step 11〜15）はこの状態を土台に追加する。

## Step 11: main.rs - `load_history` / `save_history`

- 依存: Step 0
- アプリデータディレクトリの `history.json` を読み込み履歴（ファイルパスの配列、最新が先頭）を返すTauriコマンド `load_history`、および渡された履歴で `history.json` を上書き保存するTauriコマンド `save_history` を実装する。保存先ディレクトリが存在しない場合は作成する。
- **テスト**（`cargo test`）: `history.json` が存在しない場合に `load_history` が空配列を返すこと／`save_history` で書き込んだ内容を `load_history` で読み込むと一致すること／保存先ディレクトリが未作成でも `save_history` が成功すること。
- **完了条件**: 該当テストgreen。

## Step 12: fileHistory.js

- 依存: Step 11
- `load()` / `add(path)` / `getAll()` を実装する。`add(path)` は既存パスがあれば削除してから先頭に追加し（重複排除・繰り上げ）、10件を超える場合は末尾（最古）を削除する。更新のたびに `save_history` を呼び出して永続化する。
- **テスト**（Vitest。`load_history`/`save_history` のinvoke呼び出しをモック）: `load()` で取得した履歴が `getAll()` で返ること／新規パスの `add()` で先頭に追加され `save_history` が呼ばれること／既存パスの `add()` で重複せず先頭に繰り上がること／11件目の異なるパスを `add()` すると最古の項目が削除され10件に保たれること。
- **完了条件**: 該当テストgreen。

## Step 13: historyMenu.js

- 依存: Step 0
- `show(x, y, entries, { onSelectEntry, onOpenFile })` / `hide()` を実装する。メニューの先頭には常に「ファイルを開く」項目を表示し、クリックで `hide()` した上で `onOpenFile()` を呼び出す。続けて履歴一覧を表示する。履歴が0件の場合は「履歴なし」を表示し選択不可とする。履歴項目クリックで `hide()` した上で `onSelectEntry(path)` を呼び出す。
- **テスト**（Vitest。jsdom）: 「ファイルを開く」項目が常に表示されクリックで `onOpenFile` が呼ばれること／`entries` が1件以上ある場合に履歴項目がDOMに表示されること／履歴項目クリックで `onSelectEntry` が呼ばれ、メニューが非表示になること／`entries` が空の場合「履歴なし」が表示され、クリック可能な履歴項目がないこと。
- **完了条件**: 該当テストgreen。

## Step 14: inputHandler.js - 履歴メニュー統合

- 依存: Step 8, Step 12, Step 13
- `contextmenu` イベントハンドラを、`preventDefault()` に加えて `fileHistory.getAll()` の結果を `historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile })` に渡して表示するよう拡張する。`onSelectEntry` は選択パスで `app.js` の `openFile(path)`（Step 15）を、`onOpenFile` は `app.js` の `openFileViaDialog()`（Step 15）を呼び出すコールバックとして、それぞれ外部から注入する。
- **テスト**（Vitest。jsdomでのイベントディスパッチ、`fileHistory`/`historyMenu` をモック）: 右クリックで `historyMenu.show` が `fileHistory.getAll()` の結果とともに呼ばれること／`onSelectEntry`・`onOpenFile` コールバックがそれぞれ渡した関数で呼ばれること。
- **完了条件**: 該当テストgreen。

## Step 15: app.js - `openFile` / `openFileViaDialog` への統合とファイル履歴の起動時読込

- 依存: Step 9, Step 12, Step 14
- Step 9で実装した起動フロー（`read_pdf_file` → `pdfViewer.loadPdf` → `pageNavigator.init` → `pdfViewer.renderPage(1)`）を `openFile(path)` 関数として切り出し、成功時に `fileHistory.add(path)` を呼び出すようにする。ファイル選択ダイアログの呼び出しは `openFileViaDialog()` として切り出し、選択されたパスで `openFile(path)` を呼ぶ（キャンセル時は何もしない）。起動時（引数指定時）・「ファイルを開く」・履歴メニュー経由（Step 14）のいずれのPDFオープンも `openFile(path)` を通す。アプリ起動時には `fileHistory.load()` を呼び出して保存済み履歴を読み込み、`inputHandler.init()` には `openFile` と `openFileViaDialog` をコールバックとして渡す。
- **テスト**（Vitest。Tauriの`invoke`/ダイアログ呼び出しをモック）: 起動時に `fileHistory.load()` が呼ばれること／`openFile` 成功時に `fileHistory.add(path)` が呼ばれること／`read_pdf_file` 等が失敗した場合は `fileHistory.add(path)` が呼ばれないこと（既存のエラーハンドリングは維持される）／`openFileViaDialog()` がダイアログで選択されたパスで `openFile` を呼ぶこと／ダイアログがキャンセルされた場合は `openFile` が呼ばれないこと。
- **完了条件**: 該当テストgreen。

## Step 16: 起動・履歴機能統合の完了

- 依存: Step 10, Step 15
- Step 15までのファイル履歴機能統合を完了した状態。以降のウィンドウリサイズ機能（Step 17〜19）はこの状態を土台に追加する。

## Step 17: pdfViewer.js - `getPageAspectRatio`

- 依存: Step 6
- 指定ページ番号（省略時は1）をscale 1で取得し、幅/高さのアスペクト比を返す `getPageAspectRatio(pageNumber)` を実装する。`loadPdf`未実行時に呼び出された場合は例外を投げる。
- **テスト**（Vitest。`tests/fixtures/`の縦長・横長サンプルPDFを使用）: 縦長PDFで1未満の値、横長PDFで1超の値が返ること／`loadPdf`前に呼び出すと例外になること。
- **完了条件**: 該当テストgreen。

## Step 18: windowSizer.js

- 依存: Step 0
- `calculateSize(currentWidth, currentHeight, aspectRatio)`：現在の幅・高さから面積を算出し、その面積をなるべく保ちつつ指定アスペクト比となる幅・高さを算出する純粋関数を実装する。
- `fitToAspectRatio(aspectRatio)`：`@tauri-apps/api/window` の `getCurrentWindow()` を用い、最大化中なら `unmaximize()` を呼んだうえで `innerSize()` と `calculateSize` から求めた新サイズを `setSize()` で適用する非同期関数を実装する。
- `src-tauri/capabilities/default.json` の `permissions` に `core:window:allow-inner-size` / `core:window:allow-is-maximized` / `core:window:allow-set-size` / `core:window:allow-unmaximize` を追加する。
- **テスト**（Vitest。`calculateSize`は純粋関数として直接テスト。`fitToAspectRatio`は`@tauri-apps/api/window`をモック）: `calculateSize`が面積をほぼ保ちつつ指定アスペクト比になる幅・高さを返すこと／`fitToAspectRatio`が最大化中に`unmaximize()`を呼んでから`setSize()`を呼ぶこと／最大化していない場合は`unmaximize()`を呼ばないこと。
- **完了条件**: 該当テストgreen。

## Step 19: app.js - `openFile` へのリサイズ統合

- 依存: Step 15, Step 17, Step 18
- `openFile(path)` 内で、`pdfViewer.loadPdf` の後・`pageNavigator.init` の前に `pdfViewer.getPageAspectRatio(1)` → `windowSizer.fitToAspectRatio(aspectRatio)` を呼び出すようにする。`fitToAspectRatio` が失敗しても `console.error` でログを出力するのみとし、PDF表示処理は継続する（エラー表示・履歴記録の抑止は行わない）。
- **テスト**（Vitest。`pdfViewer`/`windowSizer`をモック）: `openFile`成功時に`getPageAspectRatio`の結果で`fitToAspectRatio`が呼ばれること／`fitToAspectRatio`が失敗してもPDFの表示・履歴への追加が継続すること。
- **完了条件**: 該当テストgreen。

## Step 20: リサイズ機能統合の完了

- 依存: Step 16, Step 19
- Step 19までのウィンドウリサイズ機能統合を完了した状態。以降のドラッグ＆ドロップ機能（Step 21〜22）はこの状態を土台に追加する。

## Step 21: dragDrop.js

- 依存: Step 0
- `init({ onDrop })`：`@tauri-apps/api/window` の `getCurrentWindow().onDragDropEvent()` でOSレベルのファイルドラッグ＆ドロップを監視する非同期関数を実装する。イベントの `payload.type` が `"drop"` の場合、`payload.paths` 配列の先頭要素のみを対象に `onDrop(path)` を呼び出す（2件目以降は無視）。`"drop"` 以外（`enter`/`over`/`leave`）では何もしない。
- Tauriのデフォルト設定でOSレベルドラッグ＆ドロップは有効、かつイベント購読は `core:default`（`core:event:default`）で許可済みのため、`tauri.conf.json`・`capabilities/default.json` の変更は不要。
- **テスト**（Vitest。`@tauri-apps/api/window`をモックし、登録したハンドラを直接呼び出して検証）: `type: "drop"`でpathsの先頭パスのみを渡して`onDrop`が呼ばれること／pathsが複数件でも`onDrop`は1回だけ呼ばれること／`type`が`"enter"`/`"over"`/`"leave"`の場合は`onDrop`が呼ばれないこと。
- **完了条件**: 該当テストgreen。

## Step 22: app.js - `dragDrop` の統合

- 依存: Step 15, Step 21
- `start()` 内で、`inputHandler.init()` と同様にPDFの読み込み結果に関わらず必ず `dragDrop.init({ onDrop: openFile })` を呼び出すようにする（起動時にPDFを読み込めた場合・空白のウィンドウの場合のいずれも）。引数指定のPDFオープンが失敗した場合は、既存のエラーハンドリング方針に合わせて `dragDrop.init()` も呼び出さない。
- **テスト**（Vitest。`dragDrop`をモック）: 起動時（引数あり成功時・引数なし時）に`dragDrop.init`が`{ onDrop: openFile }`で呼ばれること／引数ありで`openFile`が失敗した場合は`dragDrop.init`が呼ばれないこと。
- **完了条件**: 該当テストgreen。

## Step 23: ドラッグ＆ドロップ機能統合の完了

- 依存: Step 20, Step 22
- Step 22までのドラッグ＆ドロップ機能統合を完了した状態。以降の全画面モード機能（Step 24〜27）はこの状態を土台に追加する。

## Step 24: fullscreen.js

- 依存: Step 0
- `isFullscreen()`：`@tauri-apps/api/window` の `getCurrentWindow().isFullscreen()` を呼び出す非同期関数を実装する。
- `toggle()`：`isFullscreen()`の結果を反転させて`setFullscreen()`を呼び出す非同期関数を実装する。
- `exit()`：`setFullscreen(false)`を呼び出す非同期関数を実装する。
- `src-tauri/capabilities/default.json` の `permissions` に `core:window:allow-is-fullscreen` / `core:window:allow-set-fullscreen` を追加する。
- **テスト**（Vitest。`@tauri-apps/api/window`をモック）: `isFullscreen()`がモックの戻り値をそのまま返すこと／`toggle()`が全画面中は`setFullscreen(false)`、通常時は`setFullscreen(true)`を呼ぶこと／`exit()`が`setFullscreen(false)`を呼ぶこと。
- **完了条件**: 該当テストgreen。

## Step 25: historyMenu.js - 全画面トグル項目の追加

- 依存: Step 13, Step 24
- `show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen })` に対応する。「ファイルを開く」項目の次に全画面トグル項目を追加し、`isFullscreen`が真なら「全画面を解除」、偽なら「全画面にする」を表示する。クリックで `hide()` した上で `onToggleFullscreen()` を呼び出す。
- **テスト**（Vitest。jsdom）: `isFullscreen: false`のとき「全画面にする」が表示されること／`isFullscreen: true`のとき「全画面を解除」が表示されること／クリックで`onToggleFullscreen`が呼ばれ、メニューが非表示になること。
- **完了条件**: 該当テストgreen。

## Step 26: inputHandler.js - Escapeキー・全画面メニューの統合

- 依存: Step 8, Step 24, Step 25
- `keydown`（Escape）のハンドラを、`fullscreen.isFullscreen()`を確認し、真であれば`fullscreen.exit()`（アプリは終了しない）、偽であれば従来通り`closeWindow()`を呼ぶように変更する。
- `contextmenu` ハンドラで `fullscreen.isFullscreen()` の結果を取得し、`historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen })` に `onToggleFullscreen: () => fullscreen.toggle()` と現在の全画面状態を渡すように拡張する。
- **テスト**（Vitest。jsdomでのイベントディスパッチ、`fullscreen`をモック）: 全画面中にEscapeを押すと`fullscreen.exit()`が呼ばれ`closeWindow`は呼ばれないこと／通常時にEscapeを押すと従来通り`closeWindow`が呼ばれること／右クリックで`historyMenu.show`に現在の`isFullscreen`状態と`onToggleFullscreen`コールバックが渡されること。
- **完了条件**: 該当テストgreen。

## Step 27: app.js - 全画面中のリサイズ抑止

- 依存: Step 19, Step 24
- `openFile(path)` 内のリサイズ処理（`pdfViewer.getPageAspectRatio` → `windowSizer.fitToAspectRatio`）を、`fullscreen.isFullscreen()` が偽の場合のみ実行するように変更する。真の場合はリサイズ処理をスキップし、全画面モードを維持する。
- **テスト**（Vitest。`fullscreen`/`windowSizer`をモック）: 全画面中は`windowSizer.fitToAspectRatio`が呼ばれないこと／通常時は従来通り呼ばれること。
- **完了条件**: 該当テストgreen。

## Step 28: 全画面モード機能統合の完了

- 依存: Step 23, Step 26, Step 27
- Step 27までの全画面モード機能統合を完了した状態。以降のレーザーポインター対象範囲の修正（Step 29）はこの状態を土台に追加する。

## Step 29: inputHandler.js - レーザーポインターをプレゼン画面内のクリックに限定

- 依存: Step 8, Step 14
- 右クリックメニュー（`#history-menu`）等、`#viewer`外のUI要素を左クリックした場合にレーザーポインターが誤って開始してしまう不具合を修正する。`mousedown`ハンドラに`isOnPresentationSurface(target)`（`target.closest("#viewer")`の有無を判定する純粋関数。`target`が`closest`を持たない場合は`true`を返す）による判定を追加し、`false`の場合は`laserPointer.startStroke`を呼ばない。
- **テスト**（Vitest。jsdomの実DOM要素を用いて`#viewer`内外のクリックを再現）: `#viewer`内の要素での`mousedown`ではレーザーポインターが開始されること／`#history-menu`内の要素での`mousedown`ではレーザーポインターが開始されないこと。
- **完了条件**: 該当テストgreen。

## Step 31: レーザーポインター対象範囲修正の完了

- 依存: Step 28, Step 29
- Step 29までの修正を完了した状態。以降の右クリックメニュー画面端クランプ（Step 32）はこの状態を土台に追加する。

## Step 32: historyMenu.js - 画面端クランプ

- 依存: Step 13
- 右クリックメニューが画面右端・下端をはみ出して切れてしまう不具合を修正する。`show()`内でメニューをDOM追加した直後に`clampToViewport(menu)`を呼び出す。`clampToViewport`は`menu.getBoundingClientRect()`で実測した幅・高さから、右端/下端が`window.innerWidth`/`innerHeight`を超える場合のみ`left`/`top`を左・上にずらす（メニューがビューポートより大きい場合は`0px`にクランプ）。検討した代替案（実測せずCSSの`max-width`値で近似クランプする案、Tauriネイティブメニューへの置き換え案）は[knowledge.md](knowledge.md)に記録する。
- **テスト**（Vitest。jsdomは実レイアウトを計算しないため`HTMLElement.prototype.getBoundingClientRect`をモックして実測値を再現）: メニューがビューポートに収まる場合はクリック位置のまま表示されること／右端・下端をはみ出す場合は左・上にずれて収まること／メニュー自体がビューポートより大きい場合は`0px`にクランプされること。
- **完了条件**: 該当テストgreen。

## Step 33: 右クリックメニュー画面端クランプの完了

- 依存: Step 31, Step 32
- Step 32までの修正を完了した状態。以降のPDF並行描画防御（Step 34）はこの状態を土台に追加する。

## Step 34: pdfViewer.js - PDFオープン時の並行描画防御

- 依存: Step 6
- PDFを開いた直後、まれに表示が上下逆・左右反転して見える不具合を修正する。原因は、`windowSizer.fitToAspectRatio`（Step 19）による`setSize()`が`window`の`resize`イベントを発生させ、`onResize()`経由の`renderPage()`と、`openFile`内で明示的に呼ばれる`renderPage(1)`が同一Canvasに対してほぼ同時に実行されうること（`canvas.width`の再設定がCanvasの内容と2D変換行列をリセットするため、並行時に互いの描画を破壊する）。詳細な調査記録は[knowledge.md](knowledge.md)を参照。
- `renderPage(pageNumber)`に以下2つの防御を追加する。（1）呼び出し開始時に実行中の`RenderTask`（`currentRenderTask`）があれば`cancel()`する（`RenderingCancelledException`での`reject`は無視する）。（2）`renderGeneration`カウンタを導入し、`await pdfDocument.getPage()`から戻った直後に自分の世代が最新でなければCanvasに触れず`return`する（(1)だけでは、間隔なく連続で呼ばれた2回の呼び出しがどちらも`getPage()`の`await`前でキャンセルチェックしてしまい素通りするケースに対応できないため）。
- **テスト**（Vitest。実際のサンプルPDFを使用）: `await`を挟まず`renderPage(1)`・`renderPage(2)`を連続で呼び出しても両方のPromiseが`reject`せず正常に完了すること（世代カウンタなしでは`"Cannot use the same canvas..."`エラーで失敗することを確認済み）。
- **完了条件**: 該当テストgreen。

## Step 35: 結合・シナリオ確認

- 依存: Step 33, Step 34
- 全モジュールを結合したアプリケーションに対して、spec.md 5章「テスト設計」の37項目（起動、ページ送り、境界、終了、レーザーポインター、リサイズ、フィット表示、ファイル履歴、空白ウィンドウからのオープン、PDFオープン時のウィンドウリサイズ、ドラッグ＆ドロップ、全画面モード、右クリックメニューの画面端クランプ、PDFオープン時の並行描画防御）を手動シナリオとして実施する。
- 併せて `npm test` / `cargo test` を通しで実行し、これまでの自動テストがすべてgreenであることを確認する。
- **完了条件**: 自動テストが全てgreen、かつspec.md 5章の37項目すべてが合格する。

## Step 36: pageNavigator.js - `getTotalPages` / `goTo`

- 依存: Step 35
- 総ページ数を返す `getTotalPages()` と、指定ページに移動する `goTo(pageNumber)`（1〜総ページ数にクランプし、現在ページと異なる場合のみ更新して`onPageChange`を呼ぶ）を実装する。
- **テスト**（Vitest）: `init`後に`getTotalPages()`が総ページ数を返すこと／`goTo()`で範囲内のページへ移動し`onChange`が呼ばれること／範囲外の値を指定すると1または総ページ数にクランプされること／現在ページと同じ値を指定した場合は`onChange`が呼ばれないこと。
- **完了条件**: 該当テストgreen。

## Step 37: pdfViewer.js - `renderThumbnail`

- 依存: Step 6
- 指定ページを、幅が`maxWidth`に収まるスケールで指定Canvasに描画する`renderThumbnail(pageNumber, canvas, maxWidth)`を実装する。`renderPage`の世代カウンタ／キャンセル機構（呼び出しごとに同一の`#pdf-canvas`を奪い合う場合の防御）は、呼び出しごとに独立したCanvasを受け取るため使用しない。
- **テスト**（Vitest。`tests/fixtures/`の縦長・横長サンプルPDFを使用）: 指定した`maxWidth`に応じてCanvasの`width`/`height`がアスペクト比を保って設定されること／例外なく完了すること。
- **完了条件**: 該当テストgreen。

## Step 38: slideListView.js

- 依存: Step 37
- `isActive()` / `show(totalPages, currentPage, { onSelectSlide })` / `hide()` を実装する。`show()`は既存表示を`hide()`したうえで、ページ番号ラベルとサムネイル用`<canvas>`を持つタイルを`totalPages`件生成し（`currentPage`のタイルには`.current`クラスを付与）、各タイルの`dblclick`で`onSelectSlide(pageNumber)`を呼ぶ。タイル追加ごとに`pdfViewer.renderThumbnail()`を並行で呼び出し、失敗時は`console.error`のみで継続する。
- **テスト**（Vitest。jsdom、`pdfViewer.renderThumbnail`をモック）: `show()`で`totalPages`件のタイルとページ番号が生成されること／各タイルに対し`renderThumbnail`が呼ばれること／`currentPage`に一致するタイルに`current`クラスが付くこと／タイルの`dblclick`で`onSelectSlide(pageNumber)`が呼ばれること／`isActive()`が`show()`後に真、`hide()`後に偽になること／`show()`を再度呼ぶと前回表示が入れ替わること。
- **完了条件**: 該当テストgreen。

## Step 39: historyMenu.js - スライド一覧表示トグル項目の追加

- 依存: Step 25, Step 38
- `show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen, onToggleSlideList, isSlideListActive, canShowSlideList })`に対応する。全画面トグル項目の次にスライド一覧表示トグル項目を追加し、`isSlideListActive`に応じて文言を切り替える（真: 「スライド一覧表示を解除」、偽: 「スライド一覧表示にする」）。`canShowSlideList`が偽の場合はクリック不可のグレーアウト表示にしクリックリスナーを付けない。真の場合はクリックで`hide()`したうえで`onToggleSlideList()`を呼ぶ。
- **テスト**（Vitest。jsdom）: `isSlideListActive`の真偽に応じた文言が表示されること／クリックで`onToggleSlideList`が呼ばれメニューが閉じること／`canShowSlideList: false`のとき項目が`disabled`表示になりクリックしても何も起きないこと。
- **完了条件**: 該当テストgreen。

## Step 40: inputHandler.js - スライド一覧表示モードの統合

- 依存: Step 36, Step 38, Step 39
- `handleKeydown`のEscapeハンドリングを、`slideListView.isActive()`を最優先で確認し真であれば`slideListView.hide()`を呼ぶよう変更する（偽であれば従来の全画面判定に進む）。Escape以外のページ送りキー、および`handleWheel`は、`slideListView.isActive()`が真の間は何もしないよう変更する。`handleContextmenu`で`pageNavigator.getTotalPages() > 0`（`canShowSlideList`）と`slideListView.isActive()`（`isSlideListActive`）を算出し、`historyMenu.show()`に`onToggleSlideList`と合わせて渡す。新規関数`toggleSlideListView()`を実装する（`slideListView.isActive()`なら`hide()`、そうでなければ`pageNavigator`の総ページ数・現在ページで`slideListView.show()`し、`onSelectSlide`で`pageNavigator.goTo(page)`後に`slideListView.hide()`する）。
- **テスト**（Vitest。jsdomでのイベントディスパッチ、`pageNavigator`/`slideListView`をモック）: スライド一覧表示中は矢印キー・ホイールで`pageNavigator.next/prev`が呼ばれないこと／スライド一覧表示中のEscapeで`slideListView.hide()`が呼ばれ`closeWindow`・`fullscreen.exit`が呼ばれないこと／`contextmenu`で`historyMenu.show`に`onToggleSlideList`・`isSlideListActive`・`canShowSlideList`が正しく渡ること／`onToggleSlideList`実行時、非アクティブなら`slideListView.show`が`pageNavigator`の総ページ数・現在ページで呼ばれ、アクティブなら`slideListView.hide`が呼ばれること／`onSelectSlide`経由で`pageNavigator.goTo`と`slideListView.hide`が呼ばれること。
- **完了条件**: 該当テストgreen。

## Step 41: スライド一覧表示モード統合の完了

- 依存: Step 40
- Step 40までの実装を土台に、spec.md 5章のテストケース38〜45を手動シナリオとして実施する。併せて`npm test`を通しで実行し、すべての自動テストがgreenであることを確認する。
- **完了条件**: 自動テストが全てgreen、かつspec.md 5章のケース38〜45すべてが合格する。

## Step 42: slideListView.js / inputHandler.js - シングルクリックでのカレントスライド変更

- 依存: Step 41
- `slideListView.show()`のコールバックに`onHighlightSlide`を追加する。各タイルの`click`（シングルクリック）で、`.current`クラスを現在ハイライト中のタイルからクリックされたタイルへ付け替えたうえで`onHighlightSlide(pageNumber)`を呼ぶ（`hide()`は呼ばない）。
- `inputHandler.js`の`toggleSlideListView()`を、`slideListView.show()`に`onHighlightSlide: (page) => pageNavigator.goTo(page)`を追加で渡すよう変更する（`onSelectSlide`は既存どおり`pageNavigator.goTo(page)`に加えて`slideListView.hide()`を呼ぶ）。
- **テスト**（Vitest）: `slideListView.test.js` — タイルの`click`で`onHighlightSlide(pageNumber)`が呼ばれること／`.current`クラスがクリックしたタイルへ移動し、以前のタイルからは外れること／`click`だけでは`isActive()`が真のまま維持されること。`inputHandler.test.js` — `toggleSlideListView`実行時に`slideListView.show`へ`onHighlightSlide`が渡ること／`onHighlightSlide(page)`実行で`pageNavigator.goTo(page)`が呼ばれ`slideListView.hide()`は呼ばれないこと。
- **完了条件**: 該当テストgreen。

## Step 43: シングルクリック対応の完了

- 依存: Step 42
- Step 42までの実装を土台に、spec.md 5章のテストケース46〜48を手動シナリオとして実施する。併せて`npm test`を通しで実行し、すべての自動テストがgreenであることを確認する。
- **完了条件**: 自動テストが全てgreen、かつspec.md 5章のケース46〜48すべてが合格する。
