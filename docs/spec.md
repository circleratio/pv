-*- coding: utf-8 -*-

# アプリケーション仕様書

本書は [requirement.md](requirement.md) を入力として、モジュール設計・処理フロー・データ設計・テスト設計を定める。

## 1. 全体構成

Tauriアプリケーションとして、Rust側（バックエンド）とWeb側（フロントエンド）で構成する。

```
pv/
├── src-tauri/          # Rustバックエンド
│   ├── src/
│   │   └── main.rs     # エントリポイント、コマンドライン引数解析、Tauriコマンド定義（#[cfg(test)]で単体テストを併記）
│   └── tauri.conf.json # ウィンドウ設定（メニューなし、通常ウィンドウ）
├── src/                # フロントエンド（Vanilla JS + HTML/CSS）
│   ├── index.html       # メインHTML（キャンバス配置）
│   ├── style.css
│   └── js/
│       ├── app.js           # エントリポイント・初期化処理
│       ├── pdfViewer.js     # pdf.jsラッパー、ページ描画・フィット計算
│       ├── pageNavigator.js # ページ状態管理・前後移動ロジック
│       ├── inputHandler.js  # キーボード・マウス・ホイールイベント処理
│       ├── laserPointer.js  # レーザーポインター描画・フェードアウト管理
│       ├── fileHistory.js   # ファイル履歴の保持・重複排除・永続化
│       ├── historyMenu.js   # 右クリックで表示する履歴選択メニューのUI
│       ├── windowSizer.js   # PDFのアスペクト比に合わせたウィンドウリサイズ
│       ├── dragDrop.js      # ウィンドウへのファイルドラッグ＆ドロップ処理
│       ├── fullscreen.js    # 全画面モードの状態取得・トグル・解除
│       └── slideListView.js # スライド一覧表示モードのグリッドUI・サムネイル表示
├── tests/              # フロントエンド単体テスト（Vitest）
│   ├── pdfViewer.test.js
│   ├── pageNavigator.test.js
│   ├── inputHandler.test.js
│   ├── laserPointer.test.js
│   ├── fileHistory.test.js
│   ├── historyMenu.test.js
│   ├── windowSizer.test.js
│   ├── dragDrop.test.js
│   ├── fullscreen.test.js
│   ├── slideListView.test.js
│   └── fixtures/       # テスト用の簡易PDFサンプル（縦長・横長各1点程度）
├── package.json
└── vite.config.js
```

フロントエンドは Vite を開発サーバー・ビルドツールとして使用し、pdf.js は npm パッケージとして導入する。フロントエンドの単体テストは Vitest を使用する。Rustバックエンドの単体テストは `cargo test`（`#[cfg(test)]`）を使用する。

## 2. モジュール設計

### 2.1 main.rs（Rustバックエンド）

| 要素 | 役割 |
|---|---|
| `main()` | Tauriアプリ起動。コマンドライン引数（`std::env::args()`）からPDFパスを取得しウィンドウ生成 |
| Tauriコマンド `get_initial_pdf_path` | 起動時引数で渡されたPDFファイルパスを返す（未指定時は`None`）。相対パスの場合は`std::env::current_dir()`を基準に絶対パスへ変換したうえで返す（シンボリックリンクの解決は行わない、単純なパス結合による正規化） |
| Tauriコマンド `read_pdf_file(path: String)` | 指定パスのPDFファイルをバイナリ（`Vec<u8>`）として読み込み返却。存在しない・読み込み失敗時はエラーを返す |
| Tauriコマンド `load_history()` | アプリデータディレクトリの `history.json` を読み込み、履歴（ファイルパスの配列、最新が先頭）を返す。ファイルが存在しない場合は空配列を返す |
| Tauriコマンド `save_history(history: Vec<String>)` | 渡された履歴（ファイルパスの配列）で `history.json` を上書き保存する。ディレクトリが存在しない場合は作成する |
| ファイル選択ダイアログ | `tauri-plugin-dialog` を使用し、右クリックメニューの「ファイルを開く」選択時にフロントエンドから呼び出す |
| ウィンドウ設定 | `tauri.conf.json` にてメニューバーなし・通常ウィンドウ（リサイズ可・最大化可）・タイトルバーありを設定 |

### 2.2 app.js

- アプリ起動時の初期化処理を行うエントリポイント。
- `get_initial_pdf_path` を呼び出し、パスが得られればそのPDFを読み込む。パスが得られない場合はPDFを読み込まず、空白のウィンドウのまま初期化を完了する（ファイル選択ダイアログは自動表示しない）。
- 各モジュール（`pdfViewer` / `pageNavigator` / `inputHandler` / `laserPointer` / `fileHistory` / `historyMenu` / `windowSizer` / `dragDrop` / `fullscreen`）を初期化・連携させる。`inputHandler.init()` は起動時にPDFを読み込めたかどうかに関わらず必ず実行し、右クリックメニュー（「ファイルを開く」・全画面トグル・履歴）を常に利用可能にする。`dragDrop.init({ onDrop: openFile })` も同様にPDFの読み込み結果に関わらず必ず実行し、ドラッグ＆ドロップでのファイルオープンを常に利用可能にする。
- 起動時に `fileHistory.load()` を呼び出し、保存済み履歴を読み込んでおく。
- `openFile(path)`: PDFを開く一連の処理（`slideListView.isActive()`が真であれば`slideListView.hide()`でスライド一覧表示モードを終了 → `read_pdf_file` → `pdfViewer.loadPdf` → 全画面モードでなければ `pdfViewer.getPageAspectRatio(1)` → `windowSizer.fitToAspectRatio(aspectRatio)` → `pageNavigator.init` → `pdfViewer.renderPage(1)`）を共通関数として提供し、成功時に `fileHistory.add(path)` を呼び出す。起動時（引数指定時）・「ファイルを開く」ダイアログ経由・履歴メニュー経由・ドラッグ＆ドロップ経由のいずれのPDFオープンもこの関数を通すため、スライド一覧表示モード中に新しいPDFを開いた場合も必ず通常表示（1ページ目）に切り替わる（起動時は`slideListView`が非アクティブなためこの分岐は影響しない）。`fullscreen.isFullscreen()` が真の場合はウィンドウリサイズ処理自体を行わず全画面モードを維持する。`windowSizer.fitToAspectRatio`（および`fullscreen.isFullscreen`のチェック）が失敗しても`console.error`にログを出力するのみで処理は継続する（ウィンドウリサイズはPDF表示に必須ではないため）。処理の成否を呼び出し元に伝えるため、成功時は`true`、失敗時は`false`を返す。
- `openFileViaDialog()`: `tauri-plugin-dialog` の `open()` でファイル選択ダイアログを表示し、選択された場合のみ `openFile(path)` を呼び出す。ダイアログがキャンセルされた場合（`open()` が `null` を返す場合）は何もしない。`inputHandler` の右クリックメニューの「ファイルを開く」から呼び出される。`open()`が返すパスはOS側で絶対パスとして解決済みのため、`get_initial_pdf_path`のような追加の絶対パス変換は行わない（ドラッグ＆ドロップで`dragDrop.js`が受け取るパスも同様）。
- `openFileFromHistory(path)`: `openFile(path)` を呼び出し、戻り値が`false`（失敗）であれば `fileHistory.remove(path)` を呼び出してそのエントリを履歴から削除する（`save_history`により永続化される）。`inputHandler` の右クリックメニューの履歴項目クリックから呼び出される（`onSelectEntry`はこの関数を呼ぶ）。
- エラーハンドリング:
  - 起動時に引数でPDFパスが指定されており、その `openFile(path)` が失敗（`read_pdf_file`・`pdfViewer.loadPdf` のいずれかが失敗）した場合は、`console.error`にログを出力したうえで画面にエラーメッセージを表示し、`inputHandler.init()` を含む以降の初期化処理は行わない（アプリケーションはクラッシュさせない。再度のファイル選択などのリトライ導線は設けない）。
  - 「ファイルを開く」・履歴メニュー経由の `openFile(path)` が失敗した場合は、画面にエラーメッセージを表示するが、`inputHandler` は初期化済みのため右クリックメニューは引き続き利用できる。履歴メニュー経由（`openFileFromHistory`）の場合は、上記のとおり該当エントリを履歴から削除する。
  - いずれの場合も失敗した場合は履歴に追加しない。

### 2.3 pdfViewer.js

| 関数 | 役割 |
|---|---|
| `loadPdf(binaryData)` | pdf.jsで`Uint8Array`からPDFドキュメントを読み込み、総ページ数を返す |
| `renderPage(pageNumber)` | 指定ページを取得し、ウィンドウサイズに合わせたアスペクト比維持のスケールを計算してCanvasに描画。同一Canvasへの並行`render()`呼び出しによる表示崩れを防ぐため、（1）呼び出し開始時に実行中の`RenderTask`があれば`cancel()`する、（2）`await pdfDocument.getPage()`から戻った直後に世代カウンタで自分がより新しい呼び出しに追い越されていないか確認し、追い越されていればCanvasに触れず`return`する、という二重の防御を持つ |
| `calculateFitScale(viewport, windowWidth, windowHeight)` | ページのviewportとウィンドウサイズから、アスペクト比を保ちつつウィンドウ内に収まる最大スケールを算出 |
| `getPageAspectRatio(pageNumber)` | 指定ページ（省略時は1）をscale 1で取得し、幅/高さのアスペクト比を返す。`loadPdf`後にのみ呼び出せる |
| `onResize()` | ウィンドウリサイズ時に現在ページを再描画 |
| `renderThumbnail(pageNumber, canvas, maxWidth)` | 指定ページを取得し、幅が`maxWidth`に収まるスケールで指定Canvasに描画する（スライド一覧表示用）。`renderPage`が使う`#pdf-canvas`とは別のCanvasを呼び出しごとに受け取るため、`renderPage`の世代カウンタ／`RenderTask`キャンセル機構は使わない（同一Canvasへの並行アクセスが起きないため衝突しない） |

ウィンドウのアスペクト比は`openFile`時に1ページ目のみを基準に決定する（`getPageAspectRatio(1)`、3.1節参照）。PDF内で2ページ目以降のアスペクト比が1ページ目と異なる場合、`calculateFitScale`によりウィンドウ内に収まるよう縮小されるため、そのページの表示時に余白が生じることがあるが、これは仕様として許容する（ページ送りのたびにウィンドウをリサイズすることはしない）。

### 2.4 pageNavigator.js

| 関数 | 役割 |
|---|---|
| `init(totalPages)` | 総ページ数を保持し、現在ページを1に初期化 |
| `next()` | 現在ページが最終ページでなければ+1し再描画をトリガー。最終ページなら何もしない |
| `prev()` | 現在ページが1でなければ-1し再描画をトリガー。1ページ目なら何もしない |
| `getCurrentPage()` | 現在ページ番号を返す |
| `getTotalPages()` | 総ページ数を返す（`init`前は0） |
| `goTo(pageNumber)` | `pageNumber`を1〜総ページ数にクランプし、現在ページと異なる場合のみ更新して再描画をトリガー（`next`/`prev`と同じ変化検知方針）。スライド一覧表示からのスライド選択に使う |

### 2.5 inputHandler.js

| イベント | 処理内容 |
|---|---|
| `keydown`（→・↓・Space） | `slideListView.isActive()`が真の間は何もしない。偽であれば`pageNavigator.next()` |
| `keydown`（←・↑・Backspace） | `slideListView.isActive()`が真の間は何もしない。偽であれば`pageNavigator.prev()` |
| `keydown`（Escape） | 他のキーより先に判定する。まず`historyMenu.isOpen()`を確認し、真であれば`historyMenu.hide()`でメニューを閉じるのみとする（全画面解除・スライド一覧表示終了・アプリ終了のいずれも行わない）。偽であれば`slideListView.isActive()`を確認し、真であれば`slideListView.hide()`でスライド一覧表示モードを終了する（アプリは終了しない）。偽であれば従来通り`fullscreen.isFullscreen()`を確認し、真であれば`fullscreen.exit()`で全画面モードを解除する（アプリは終了しない）。いずれも偽であればアプリ終了（Tauriウィンドウクローズ） |
| `wheel`（下回転） | `slideListView.isActive()`が真の間は何もしない。偽であれば`pageNavigator.next()` |
| `wheel`（上回転） | `slideListView.isActive()`が真の間は何もしない。偽であれば`pageNavigator.prev()` |
| `mousedown`（左ボタン） | クリック対象がプレゼン画面（`#viewer`）内である場合のみ、`laserPointer.startStroke(x, y)`、レーザーポインターモード開始。右クリックメニュー等`#viewer`外のUI要素上でのクリックは無視する |
| `mousemove`（左ボタン押下中） | `laserPointer.addPoint(x, y)` |
| `mouseup`（左ボタン） | `laserPointer.endStroke()`、レーザーポインターモード終了・フェードアウト開始 |
| `contextmenu`（右ボタン） | ブラウザ標準コンテキストメニューを`preventDefault()`で抑止したうえで、`fileHistory.getAll()`で履歴一覧、`fullscreen.isFullscreen()`で現在の全画面状態、`pageNavigator.getTotalPages() > 0`でスライド一覧表示可否（`canShowSlideList`）、`slideListView.isActive()`で現在のスライド一覧表示状態を取得し、`historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen, onToggleSlideList, isSlideListActive, canShowSlideList })`を表示する。`onSelectEntry`には選択パスで`app.js`の`openFileFromHistory(path)`を呼び出すコールバック、`onOpenFile`には`app.js`の`openFileViaDialog()`を呼び出すコールバック、`onToggleFullscreen`には`fullscreen.toggle()`を呼び出すコールバック、`onToggleSlideList`には後述の`toggleSlideListView()`を呼び出すコールバックを渡す |

- レーザーポインターモード中も上記のページ送り系イベントは無効化せず、そのまま`pageNavigator`へ委譲する。
- 右ボタンには履歴メニュー表示以外の機能を割り当てない。
- `isOnPresentationSurface(target)`: `target.closest("#viewer")`の有無でプレゼン画面内でのクリックかどうかを判定する純粋関数。`target`が`closest`を持たない場合（DOM要素でない場合）は`true`を返す。`mousedown`ハンドラは、この関数が`false`を返す場合（履歴メニューなど`#viewer`外の要素をクリックした場合）、レーザーポインターを開始しない。スライド一覧表示中のグリッド（`#slide-list-view`、2.12節参照）は`#viewer`の外側にDOM追加されるため、この判定により自動的にレーザーポインター対象外となり、グリッド内タイルへの左クリックはスライド一覧表示の選択操作としてのみ機能する
- `toggleSlideListView()`: `slideListView.isActive()`が真であれば`slideListView.hide()`を呼ぶ。偽であれば`slideListView.show(pageNavigator.getTotalPages(), pageNavigator.getCurrentPage(), { onSelectSlide, onHighlightSlide })`を呼ぶ。`onHighlightSlide(page)`（シングルクリック）は`pageNavigator.goTo(page)`で現在ページを更新するのみでモードは終了しない。`onSelectSlide(page)`（ダブルクリック）は同じく`pageNavigator.goTo(page)`で現在ページを更新したうえで`slideListView.hide()`を呼び、通常表示モードへ戻す。`pageNavigator.goTo(page)`は`init()`時に登録済みの`onChange`コールバック経由で`pdfViewer.renderPage(page)`を呼ぶため、一覧表示モード中にシングルクリックした時点で背後の`#pdf-canvas`は既に更新されており、Esc・再トグル・ダブルクリックのいずれで一覧表示を終了してもその時点のカレントページがそのまま表示される

### 2.7 fileHistory.js

| 関数 | 役割 |
|---|---|
| `load()` | Tauriコマンド`load_history`を呼び出し、履歴一覧（最新が先頭の文字列配列）を取得して内部状態に保持する |
| `add(path)` | 指定パスを履歴に追加する。既に同じパスが履歴内に存在する場合（文字列としての完全一致。大文字小文字・シンボリックリンク等の正規化は行わない）は既存項目を削除してから先頭に追加する（重複排除・最新への繰り上げ）。追加後、件数が10件を超える場合は末尾（最古）を削除して10件に保つ。更新後の履歴でTauriコマンド`save_history`を呼び出し永続化する |
| `remove(path)` | 指定パスと文字列完全一致するエントリを履歴から削除する（存在しない場合は何もしない）。削除後の履歴でTauriコマンド`save_history`を呼び出し永続化する。履歴からの再オープンに失敗した場合に`app.js`から呼び出される |
| `getAll()` | 現在保持している履歴一覧（最新が先頭の文字列配列）を返す |

### 2.8 historyMenu.js

| 関数 | 役割 |
|---|---|
| `show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen, onToggleSlideList, isSlideListActive, canShowSlideList })` | 指定座標にポップアップメニューをDOMで表示する。メニューの先頭には常に「ファイルを開く」項目を表示し、クリック時に`hide()`したうえで`onOpenFile()`を呼び出す。続けて全画面トグル項目を表示する（`isFullscreen`が真なら「全画面を解除」、偽なら「全画面にする」という表示文言にし、クリック時に`hide()`したうえで`onToggleFullscreen()`を呼び出す）。続けてスライド一覧表示トグル項目を表示する（`isSlideListActive`が真なら「スライド一覧表示を解除」、偽なら「スライド一覧表示にする」という表示文言にする。`canShowSlideList`が偽（PDF未読込）の場合はクリック不可のグレーアウト表示にしクリックリスナーを付けない。真の場合はクリック時に`hide()`したうえで`onToggleSlideList()`を呼び出す）。続けて履歴一覧を表示する。履歴が0件の場合は「履歴なし」を表示し選択不可とする。履歴項目クリック時は`hide()`したうえで`onSelectEntry(path)`を呼び出す。DOM追加後に`clampToViewport(menu)`を呼び出し、画面端をはみ出さないよう位置を調整する |
| `clampToViewport(menu)` | `menu.getBoundingClientRect()`で実際の幅・高さを測定し、右端/下端が`window.innerWidth`/`innerHeight`を超える場合のみ`left`/`top`を左・上にずらす（メニュー自体がビューポートより大きい場合は`0px`にクランプする）。検討した代替案は[knowledge.md](knowledge.md)を参照 |
| `hide()` | メニューを非表示にして破棄する。メニュー外のクリックでも呼び出される |
| `isOpen()` | メニューが現在表示中かどうかを返す（モジュール内で保持するメニュー要素の有無で判定）。`inputHandler`のEscapeキー処理から、他の判定に先立って参照される |

### 2.9 windowSizer.js

| 関数 | 役割 |
|---|---|
| `calculateSize(currentWidth, currentHeight, aspectRatio, maxWidth, maxHeight)` | 現在のウィンドウ幅・高さから面積を算出し、その面積をなるべく保ちつつ指定アスペクト比（幅/高さ）となる幅・高さを算出する純粋関数（`height = sqrt(面積 / aspectRatio)`、`width = height * aspectRatio`、四捨五入）。算出結果が`maxWidth`または`maxHeight`を超える場合は、アスペクト比を保ったまま`width <= maxWidth かつ height <= maxHeight`となる最大サイズに縮小する |
| `fitToAspectRatio(aspectRatio)` | Tauriの`@tauri-apps/api/window`（`getCurrentWindow`）を用いて、現在のウィンドウが最大化中であれば`unmaximize()`を呼び出したうえで、`innerSize()`・`currentMonitor()`（現在表示中のディスプレイの`size`を`maxWidth`/`maxHeight`として使用）と`calculateSize`から算出した新サイズを`setSize()`で適用する非同期関数 |

Tauriの権限設定（`src-tauri/capabilities/default.json`）に、ウィンドウリサイズに必要な `core:window:allow-inner-size` / `core:window:allow-is-maximized` / `core:window:allow-set-size` / `core:window:allow-unmaximize` / `core:window:allow-current-monitor` を追加する。

### 2.10 dragDrop.js

| 関数 | 役割 |
|---|---|
| `init({ onDrop })` | Tauriの`@tauri-apps/api/window`（`getCurrentWindow`）の`onDragDropEvent`でOSレベルのファイルドラッグ＆ドロップを監視する非同期関数。イベントの`type`が`"drop"`の場合、`paths`配列の先頭要素（1件目。配列内の順序はTauri/OSがイベントとして渡す順序をそのまま用い、アプリ側では並べ替えない）のみを対象とする（2件目以降は無視する）。その1件が拡張子`.pdf`（大文字小文字を区別しない）でない場合は何もせず`onDrop`を呼び出さない。`.pdf`であれば`onDrop(path)`を呼び出す。`type`が`"drop"`以外（`enter`/`over`/`leave`）の場合は何もしない |

Tauriのデフォルト設定では、ウィンドウのOSレベルドラッグ＆ドロップ（`dragDropEnabled`）は有効になっており、`tauri.conf.json`の変更は不要。イベント購読自体は `core:default`（`core:event:default`に含まれる`allow-listen`）で許可されるため、`capabilities/default.json`への追加権限も不要。

### 2.11 fullscreen.js

| 関数 | 役割 |
|---|---|
| `isFullscreen()` | Tauriの`@tauri-apps/api/window`（`getCurrentWindow`）の`isFullscreen()`を呼び出し、現在のウィンドウが全画面モードかどうかを返す非同期関数 |
| `toggle()` | `isFullscreen()`で現在の状態を取得し、`setFullscreen(!現在の状態)`で全画面⇔通常を切り替える非同期関数 |
| `exit()` | `setFullscreen(false)`を呼び出し、全画面モードを解除する非同期関数（既に通常モードの場合も安全に呼び出せる） |

Tauriの権限設定（`src-tauri/capabilities/default.json`）に、全画面切り替えに必要な `core:window:allow-is-fullscreen` / `core:window:allow-set-fullscreen` を追加する。

`exit()`・`toggle()`による全画面解除時は、`windowSizer`を呼び出さない（全画面モード中に開いたPDFのアスペクト比に基づくリサイズは行わない）。`setFullscreen(false)`はOS標準の挙動として全画面に入る前のウィンドウサイズへ自動的に復帰するため、追加のリサイズ処理は不要。

### 2.6 laserPointer.js

| 要素 | 役割 |
|---|---|
| オーバーレイCanvas | PDF描画用Canvasの上に重ねて配置し、レーザーポインターの軌跡のみを描画する |
| `startStroke(x, y)` | 新規ストロークを開始し、始点をCanvasローカル座標に変換して記録 |
| `addPoint(x, y)` | ドラッグ中の座標をCanvasローカル座標に変換してストロークに追加 |
| `endStroke()` | ストロークを確定し、フェードアウトアニメーションを開始 |
| `calculateRadius(canvasWidth, canvasHeight)` | オーバーレイCanvasの短辺に対する比率（`RADIUS_RATIO`）から線の太さ（半径換算）を算出する純粋関数。ウィンドウサイズが変わっても相対サイズを維持する |
| `render()` | `requestAnimationFrame`ループで、各ストロークの記録点を`moveTo`/`lineTo`で結んだ1本のオレンジの線として`lineCap: round`で描画（太さは`calculateRadius`の2倍、Canvas短辺の約1.4%相当）。1点のみのストローク（ドラッグなしのクリック）は始点から始点への長さ0の線分となり、丸い線端により点として表示される。経過時間に応じて透明度を下げ、約1秒（`FADE_DURATION_MS`）でフェードアウト完了後にストロークを破棄 |

### 2.12 slideListView.js

| 関数 | 役割 |
|---|---|
| `isActive()` | スライド一覧表示モードが現在表示中かどうかを返す（モジュール内で保持するコンテナ要素の有無で判定） |
| `show(totalPages, currentPage, { onSelectSlide, onHighlightSlide })` | 既存の表示があれば`hide()`したうえで、`#slide-list-view`をルートとするグリッドコンテナを`document.body`に追加する。ページ1〜`totalPages`ごとに、ページ番号ラベルとサムネイル描画用`<canvas>`を含むタイル（`.slide-list-tile`）を生成し、`currentPage`に一致するタイルには`.current`クラスを付けて現在位置をハイライトする。各タイルの`click`（シングルクリック）では、`.current`クラスを現在ハイライト中のタイルから外し、クリックされたタイルへ付け替えたうえで`onHighlightSlide(pageNumber)`を呼ぶ（モードは終了しない）。各タイルの`dblclick`では、同様に`.current`クラスを付け替えたうえで`onSelectSlide(pageNumber)`を呼ぶ。タイル追加のたびに`pdfViewer.renderThumbnail(pageNumber, canvas, THUMBNAIL_MAX_WIDTH)`を`await`せず並行で呼び出し、失敗時は`console.error`にログを出力するのみで他タイルの表示は継続する |
| `hide()` | コンテナ要素をDOMから削除し、内部状態を非表示に戻す。表示していない状態での呼び出しも安全（no-op） |

`slideListView.js`は表示専用のUIモジュールであり、`pdfViewer.js`（サムネイル描画）に依存する。ページの現在位置や総ページ数は呼び出し元（`inputHandler.js`）が`pageNavigator`から取得して渡す。シングルクリックの`onHighlightSlide`とダブルクリックの`onSelectSlide`はいずれも「カレントページを更新する」という同じ効果を呼び出し元に要求するが、`onSelectSlide`はそれに加えてモード終了（`hide()`）を伴う点が異なる（詳細は2.5節・3.8節参照）。ブラウザの`dblclick`はその直前に`click`を2回発火させるため、`onHighlightSlide`が同じページ番号で複数回呼ばれることがあるが、`pageNavigator.goTo()`は現在ページと同じ値の場合は何もしないため副作用はない。

## 3. 処理フロー

### 3.1 起動フロー

```
main.rs: 起動 → コマンドライン引数解析
   │
   ▼
app.js: fileHistory.load() で保存済み履歴を読み込み
   │
   ▼
app.js: get_initial_pdf_path() 呼び出し
   │
   ├─ パスあり → openFile(path) 実行
   │      ├─ 成功 → inputHandler.init() → dragDrop.init() → 1ページ目が表示された状態で操作可能に
   │      └─ 失敗 → エラーメッセージ表示、以降の初期化（inputHandler.init()・dragDrop.init()含む）は行わない
   │
   └─ パスなし → PDFを読み込まず、空白のウィンドウのまま inputHandler.init() → dragDrop.init() を実行
          （右クリックメニューから「ファイルを開く」・履歴選択、ウィンドウへのドラッグ＆ドロップが可能）

openFile(path) の内部:
   slideListView.isActive() を確認 → 真であれば slideListView.hide() でスライド一覧表示モードを終了
   │
   ▼
   read_pdf_file(path) でバイナリ取得
   │
   ▼
   pdfViewer.loadPdf(binaryData) → 総ページ数取得
   │
   ▼
   fullscreen.isFullscreen() を確認
   │
   ├─ 真（全画面モード中） → リサイズ処理をスキップ（全画面を維持）
   │
   └─ 偽 → pdfViewer.getPageAspectRatio(1) → 1ページ目のアスペクト比取得
          │
          ▼
          windowSizer.fitToAspectRatio(aspectRatio)
          （最大化中なら解除 → 現在の面積を保ってアスペクト比に合わせてリサイズ。
           算出サイズが現在のディスプレイを超える場合はアスペクト比を保ったまま画面に収まる最大サイズにクランプ。
           失敗してもログのみで継続）
   │
   ▼
   pageNavigator.init(totalPages)
   │
   ▼
   pdfViewer.renderPage(1) … 1ページ目を、リサイズ後のウィンドウに余白なく表示
   │
   ▼
   fileHistory.add(path) → save_history で永続化
```

### 3.2 ページ送りフロー

```
キー入力 / ホイール入力
   │
   ▼
inputHandler: slideListView.isActive() を確認
   │
   ├─ 真（スライド一覧表示中） → 何もしない（3.8節参照）
   │
   └─ 偽 → 方向判定
          │
          ├─ 次ページ方向 → pageNavigator.next()
          └─ 前ページ方向 → pageNavigator.prev()
          │
          ▼
        ページ番号に変化があれば pdfViewer.renderPage(currentPage)
        （境界（最初/最後）で変化がない場合は再描画しない）
```

### 3.3 レーザーポインターフロー

```
左ボタン mousedown
   │
   ▼
laserPointer.startStroke(x, y)
   │
   ▼（押下中）
mousemove ごとに laserPointer.addPoint(x, y)
   │
   ▼
左ボタン mouseup
   │
   ▼
laserPointer.endStroke()
   │
   ▼
requestAnimationFrame ループで透明度を減衰させながら描画
   │
   ▼
約1秒経過後、当該ストロークを破棄（完全に消える）
```

### 3.4 リサイズフロー

```
window の resize イベント
   │
   ▼
pdfViewer.onResize()
   │
   ▼
現在ページを新しいウィンドウサイズに合わせて再計算・再描画
（レーザーポインターのオーバーレイCanvasもサイズを追従させる）
```

`windowSizer.fitToAspectRatio`（3.1参照）による`setSize()`呼び出しもこの`resize`イベントを発生させうるため、`openFile`内で直後に呼び出す`renderPage(1)`と`onResize()`経由の`renderPage()`が同一Canvasに対してほぼ同時に呼ばれることがある。`pdfViewer.renderPage()`はこの並行呼び出しに対する防御（実行中の`RenderTask`のキャンセルおよび世代カウンタによる古い呼び出しの破棄。詳細は2.3節・[knowledge.md](knowledge.md)を参照）を持つため、表示が乱れることなく最新の呼び出しの結果のみが描画される。

### 3.5 ファイル履歴選択フロー

```
右ボタン contextmenu
   │
   ▼
inputHandler: preventDefault() → fileHistory.getAll()
   │
   ▼
inputHandler: fullscreen.isFullscreen() で現在の全画面状態、
              pageNavigator.getTotalPages() > 0 でスライド一覧表示可否（canShowSlideList）、
              slideListView.isActive() で現在のスライド一覧表示状態を取得
   │
   ▼
historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen,
                                   onToggleSlideList, isSlideListActive, canShowSlideList })
   │
   ├─（「ファイルを開く」クリック）→ hide() → onOpenFile() → app.js: openFileViaDialog()
   │        │
   │        ├─ ダイアログでファイル選択 → openFile(path)
   │        └─ ダイアログをキャンセル → 何もしない
   │
   ├─（全画面トグル項目クリック）→ hide() → onToggleFullscreen() → fullscreen.toggle()
   │
   ├─（スライド一覧表示トグル項目クリック）→ hide() → onToggleSlideList() → toggleSlideListView()（3.8節参照）
   │
   └─（履歴項目クリック）→ hide() → onSelectEntry(path) → app.js: openFileFromHistory(path)

openFile(path) 内で fileHistory.add(path) が実行され、
開いたファイルが最新の履歴に繰り上がる（新規の場合は先頭に追加）

openFileFromHistory(path) は openFile(path) の戻り値が false（失敗）の場合、
fileHistory.remove(path) を呼び出し、そのエントリを履歴から削除する
（ファイルが移動・削除されている等で再オープンに失敗した場合の後始末）
```

### 3.6 ドラッグ＆ドロップフロー

```
OSレベルのファイルドロップ（tauri:// drag-drop イベント）
   │
   ▼
dragDrop: event.payload.type === "drop" を判定
   │
   ├─ "drop"以外（enter/over/leave） → 何もしない
   │
   └─ "drop" → paths配列の先頭パスのみを対象とする（2件目以降は無視。順序はOS/Tauri任せ）
          │
          ▼
        拡張子が.pdfか判定
          │
          ├─ .pdf以外 → 何もしない（onDropを呼び出さない）
          │
          └─ .pdf → onDrop(path) → app.js: openFile(path)
```

### 3.7 Escapeキー・全画面フロー

```
keydown（Escape）
   │
   ▼
inputHandler: historyMenu.isOpen() を確認
   │
   ├─ 真（右クリックメニュー表示中） → historyMenu.hide() でメニューを閉じるのみ
   │                                   （全画面解除・スライド一覧表示終了・アプリ終了のいずれも行わない）
   │
   └─ 偽 → slideListView.isActive() を確認
          │
          ├─ 真（スライド一覧表示中） → slideListView.hide() でスライド一覧表示を終了（アプリは終了しない）
          │
          └─ 偽 → fullscreen.isFullscreen() を確認
                 │
                 ├─ 真（全画面モード中） → fullscreen.exit() で全画面を解除（アプリは終了しない）
                 │
                 └─ 偽 → closeWindow() でアプリを終了
```

### 3.8 スライド一覧表示フロー

```
右クリックメニューの「スライド一覧表示にする」/「スライド一覧表示を解除」選択
   │
   ▼
inputHandler: toggleSlideListView()
   │
   ├─ slideListView.isActive() が真 → slideListView.hide() で通常表示に戻る
   │
   └─ slideListView.isActive() が偽 → slideListView.show(
          pageNavigator.getTotalPages(), pageNavigator.getCurrentPage(),
          { onSelectSlide, onHighlightSlide })
          │
          ▼
        全ページ分のタイル（番号＋サムネイル用canvas）を生成し、
        pdfViewer.renderThumbnail() を各タイルへ並行で呼び出して描画

グリッド内のタイルを click（シングルクリック）
   │
   ▼
タイル側の.currentクラスをクリックされたタイルへ付け替え（ハイライト移動）
   │
   ▼
onHighlightSlide(pageNumber)
   │
   ▼
pageNavigator.goTo(pageNumber) … 現在ページ更新（変化時のみ#pdf-canvasを再描画）
   │
   ▼
スライド一覧表示は終了しない（グリッド表示を継続）

グリッド内のタイルを dblclick
   │
   ▼
（.currentクラスの付け替えは上記と同様）
   │
   ▼
onSelectSlide(pageNumber)
   │
   ▼
pageNavigator.goTo(pageNumber) … 現在ページ更新（変化時のみ再描画）
   │
   ▼
slideListView.hide() … 通常表示（#viewer）に戻る。直前のシングルクリックで
既に#pdf-canvasが更新済みのため、その時点のカレントページがそのまま表示される

スライド一覧表示中は、矢印キー・スペース・BS・ホイールによるページ送りは無効
（3.2節参照）。Escapeでの終了は3.7節参照（この場合もカレントページが表示される）。
右クリックメニューは表示中も引き続き利用可能。

スライド一覧表示中に右クリックメニューから「ファイルを開く」・履歴選択、
またはドラッグ＆ドロップで新しいPDFを開いた場合（3.1節・3.5節・3.6節の
openFile(path)を参照）は、slideListView.hide()によりスライド一覧表示
モードを終了したうえで、開いた新PDFの1ページ目を通常表示する。
このときのウィンドウリサイズは3.1節のopenFile(path)内のfullscreen.isFullscreen()
判定に従うため、全画面モード中であればリサイズは行われず全画面モードが
維持される（スライド一覧表示モードの終了のみが行われる）。
```

## 4. データ設計

### 4.1 AppState（app.js内で保持）

| フィールド | 型 | 説明 |
|---|---|---|
| `pdfDocument` | pdf.js `PDFDocumentProxy` | 読み込み済みPDFドキュメント |
| `currentPage` | number（1始まり） | 現在表示中のページ番号 |
| `totalPages` | number | PDFの総ページ数 |
| `canvasElement` | HTMLCanvasElement | PDF描画先Canvas |
| `overlayCanvasElement` | HTMLCanvasElement | レーザーポインター描画用オーバーレイCanvas |

### 4.2 LaserPointerState（laserPointer.js内で保持）

| フィールド | 型 | 説明 |
|---|---|---|
| `isActive` | boolean | 左クリック押下中かどうか |
| `strokes` | `Stroke[]` | 描画中・フェードアウト中のストローク一覧 |

`Stroke`構造:

| フィールド | 型 | 説明 |
|---|---|---|
| `points` | `{x: number, y: number}[]` | クリック・ドラッグで記録した座標列（クリックのみの場合は要素数1） |
| `endedAt` | number（timestamp）\| null | `endStroke()`が呼ばれた時刻。フェードアウト計算の起点。押下中は`null` |

### 4.3 HistoryState（fileHistory.js内で保持）

| フィールド | 型 | 説明 |
|---|---|---|
| `entries` | `string[]` | 履歴として保持しているPDFファイルの絶対パス一覧（先頭が最新、最大10件） |

永続化データ（`history.json`、アプリデータディレクトリ配下）は`entries`と同一形式（ファイルパスの配列、最新が先頭、最大10件）のJSONとする。

## 5. テスト設計

| # | 観点 | テストケース | 期待結果 |
|---|---|---|---|
| 1 | 起動（引数あり） | PDFファイルパスを引数に指定して起動 | 指定PDFの1ページ目が表示される |
| 2 | 起動（引数なし） | 引数なしで起動 | ファイル選択ダイアログは表示されず、PDFを読み込まない空白のウィンドウが表示される |
| 3 | 起動（不正パス） | 存在しないパスを引数に指定 | エラーとなり、適切にハンドリングされる（クラッシュしない） |
| 4 | ページ送り（前進） | →・↓・Space・ホイール下回転 | 現在ページが+1され再描画される |
| 5 | ページ送り（後退） | ←・↑・Backspace・ホイール上回転 | 現在ページが-1され再描画される |
| 6 | 境界（先頭） | 1ページ目で後退操作 | ページ番号が変化しない |
| 7 | 境界（末尾） | 最終ページで前進操作 | ページ番号が変化しない |
| 8 | 終了 | 通常モード（全画面でない状態）でEscキー押下 | アプリケーションウィンドウが閉じる |
| 9 | レーザーポインター（クリック） | 左クリックのみ（ドラッグなし）で離す | クリック位置にオレンジの点が表示され、約1秒でフェードアウトする |
| 10 | レーザーポインター（ドラッグ） | 左クリック押下したままマウス移動後に離す | 移動の軌跡に沿ってオレンジの線が表示され、フェードアウトする |
| 11 | レーザーポインター中のページ送り | 左クリック押下中に矢印キーでページ送り | ページが送られ、レーザーポインター表示・モードは継続する |
| 12 | リサイズ | ウィンドウサイズ変更 | PDFページがアスペクト比を保ったまま再フィット表示される |
| 13 | フィット表示 | 縦長／横長それぞれのPDFを表示 | いずれもウィンドウ内に収まり、はみ出しや不要な余白の偏りがない |
| 14 | ファイル履歴（新規記録） | 未履歴のPDFファイルを開く | 履歴の先頭に追加され、`history.json`に永続化される |
| 15 | ファイル履歴（重複オープン） | 履歴に既にあるファイルを再度開く | 履歴が重複せず、そのファイルの履歴が最新（先頭）に繰り上がる |
| 16 | ファイル履歴（上限） | 履歴が10件ある状態で11個目の別ファイルを開く | 最も古い履歴が削除され、件数が10件に維持される |
| 17 | ファイル履歴（右クリック表示） | 履歴が1件以上ある状態で右クリック | 「ファイルを開く」と履歴一覧を含むメニューが表示され、標準コンテキストメニューは表示されない |
| 18 | ファイル履歴（選択オープン） | 履歴メニューから項目を選択 | 選択したファイルが開かれ、メニューが閉じる |
| 19 | ファイル履歴（空） | 履歴が0件の状態で右クリック | 「ファイルを開く」と「履歴なし」が表示され、履歴側に選択可能な項目はない |
| 20 | ファイル履歴（永続化） | PDFファイルを開いた後アプリを再起動 | 再起動後も履歴が保持されている |
| 21 | 空白ウィンドウからのオープン | 引数なしで起動し、右クリックの「ファイルを開く」からPDFを選択 | ダイアログでPDFを選択すると1ページ目が表示され、履歴に記録される |
| 22 | 空白ウィンドウからのキャンセル | 引数なしで起動し、右クリックの「ファイルを開く」からダイアログをキャンセル | 空白ウィンドウのまま変化せず、エラー表示もされない |
| 23 | PDFオープン時のリサイズ（縦長） | 通常ウィンドウ（横長）の状態で縦長PDFを開く | ウィンドウが縦長PDFのアスペクト比に合わせてリサイズされ、表示に余白がほぼできない |
| 24 | PDFオープン時のリサイズ（横長） | 通常ウィンドウの状態で横長PDFを開く | ウィンドウが横長PDFのアスペクト比に合わせてリサイズされ、表示に余白がほぼできない |
| 25 | PDFオープン時のリサイズ（最大化中） | ウィンドウを最大化した状態でPDFを開く | 最大化が解除され、アスペクト比に合わせたウィンドウサイズになる |
| 26 | PDFオープン時のリサイズ（面積維持） | 任意のウィンドウサイズでPDFを開く | リサイズ後のウィンドウ面積が、リサイズ前とおおむね同じになる |
| 27 | ドラッグ＆ドロップ（単一ファイル） | PDFファイル1件をウィンドウにドラッグ＆ドロップ | そのPDFが開かれ、1ページ目が表示され、履歴に記録される |
| 28 | ドラッグ＆ドロップ（複数ファイル） | PDFファイル複数件を同時にウィンドウにドラッグ＆ドロップ | 先頭の1件のみが開かれる |
| 29 | ドラッグ＆ドロップ（空白ウィンドウ） | 引数なしで起動した空白のウィンドウにPDFファイルをドラッグ＆ドロップ | そのPDFが開かれる |
| 30 | 全画面トグル（メニュー文言） | 通常モードで右クリック→全画面モードで右クリック | 通常モードでは「全画面にする」、全画面モードでは「全画面を解除」がメニューに表示される |
| 31 | 全画面トグル（有効化） | 右クリックメニューから「全画面にする」を選択 | ウィンドウが全画面表示になる |
| 32 | 全画面トグル（解除） | 全画面モード中に右クリックメニューから「全画面を解除」を選択 | ウィンドウが通常表示に戻る |
| 33 | 全画面中のEsc | 全画面モード中にEscキーを押す | 全画面モードが解除され、アプリケーションは終了しない |
| 34 | 全画面中のPDFオープン | 全画面モード中に「ファイルを開く」・履歴・ドラッグ＆ドロップのいずれかでPDFを開く | 全画面モードが維持され、ウィンドウのリサイズ（アスペクト比合わせ）は行われない |
| 35 | レーザーポインター対象外（右クリックメニュー） | 右クリックでメニューを表示し、メニュー項目を左クリックで選択 | レーザーポインターは表示されず、選択した操作（ファイルを開く／全画面トグル／履歴オープン）のみが行われる |
| 36 | 右クリックメニューの画面端クランプ | ウィンドウ右端・下端に近い位置で右クリック | メニュー全体が画面内に収まり、右側・下側が切れない |
| 37 | PDFオープン時の並行描画防御 | `renderPage()`を`await`を挟まず連続で2回呼び出す（PDFオープン時のリサイズによる`resize`イベント発火と、`openFile`内の明示的な描画呼び出しの競合を模擬） | 例外が発生せず両方の呼び出しが正常に完了し、表示が乱れない（上下逆・左右反転等の描画崩れが起きない） |
| 38 | スライド一覧表示への切り替え | PDFを開いた状態で右クリック→「スライド一覧表示にする」を選択 | 全スライド分のページ番号とサムネイルがグリッドで表示される |
| 39 | スライド一覧表示（サムネイル） | スライド一覧表示中 | 各スライドのサムネイルがそのページ内容を反映して表示される |
| 40 | スライド一覧表示からの選択 | スライド一覧表示中に任意のスライドをダブルクリック | そのスライドの通常表示に遷移し、スライド一覧表示が終了する |
| 41 | スライド一覧表示中のページ送り無効化 | スライド一覧表示中に矢印キー・ホイールを操作 | ページ送りは発生せず、スライド一覧表示が維持される |
| 42 | スライド一覧表示中のEsc | スライド一覧表示中にEscキーを押す | 通常表示モードに戻り、アプリケーションは終了しない |
| 43 | スライド一覧表示の再トグルでの終了 | スライド一覧表示中に右クリック→「スライド一覧表示を解除」を選択 | 直前のカレントスライドの通常表示に戻る |
| 44 | PDF未読込時のスライド一覧表示無効化 | 引数なしで起動し（PDF未読込のまま）右クリック | 「スライド一覧表示にする」項目が選択不可（グレーアウト）で表示される |
| 45 | 全画面中のスライド一覧表示 | 全画面モード中に「スライド一覧表示にする」を選択し、Escキーを1回押す | まずスライド一覧表示のみが終了し全画面モードは維持される（もう一度Escを押すと全画面が解除される） |
| 46 | スライド一覧表示のシングルクリック | スライド一覧表示中に任意のスライドをシングルクリック | そのスライドのタイルがカレントとしてハイライトされ、スライド一覧表示は終了しない |
| 47 | シングルクリック後のEscでの終了 | スライド一覧表示中に別スライドをシングルクリックしたのちEscキーを押す | ダブルクリックしていなくても、シングルクリックで選択したスライドの通常表示に戻る |
| 48 | シングルクリック後の再トグルでの終了 | スライド一覧表示中に別スライドをシングルクリックしたのち右クリック→「スライド一覧表示を解除」を選択 | シングルクリックで選択したスライドの通常表示に戻る |
| 49 | スライド一覧表示中の新規PDFオープン | スライド一覧表示中に右クリックメニューの「ファイルを開く」（または履歴・ドラッグ＆ドロップ）で別のPDFを開く | スライド一覧表示モードが終了し、開いた新PDFの1ページ目が通常表示される |
| 50 | スライド一覧表示中のレーザーポインター無効化 | スライド一覧表示中にグリッド内タイルを左クリック（押下・移動） | レーザーポインターは表示されず、シングルクリックとしてのタイル選択（ハイライト移動）のみが行われる |
| 51 | 右クリックメニュー表示中のEsc | 右クリックメニューを表示した状態でEscキーを押す | メニューが閉じるのみで、全画面解除・スライド一覧表示終了・アプリ終了のいずれも発生しない |
| 52 | 起動引数の相対パス正規化 | カレントディレクトリからの相対パスを引数に指定して起動 | 指定PDFが正しく開かれ、履歴には絶対パスで記録される |
| 53 | ファイル履歴（大文字小文字違いの扱い） | パスの大文字小文字表記のみが異なる同一ファイルを再度開く | パス文字列が完全一致しないため、履歴には別エントリとして追加される（重複排除されない） |
| 54 | ファイル履歴（再オープン失敗時の削除） | 履歴にあるファイルを移動・削除したうえで、そのファイルを履歴メニューから開く | エラーメッセージが表示され、そのエントリが履歴から削除される（`history.json`にも反映される） |
| 55 | ドラッグ＆ドロップ（非PDFファイル） | PDF以外の拡張子のファイルをウィンドウにドラッグ＆ドロップ | 何も開かれず、エラー表示もされない（現在の表示状態が維持される） |
| 56 | ページごとにアスペクト比が異なるPDF | 1ページ目と2ページ目でアスペクト比が異なるPDFを開き、2ページ目に送る | ウィンドウは1ページ目基準のサイズのまま変化せず、2ページ目はアスペクト比を保ったまま縮小表示され余白が生じる（エラーにはならない） |
| 57 | PDFオープン時のリサイズ（画面クランプ） | 画面サイズに対して極端に横長・縦長なアスペクト比のPDFを開く | 算出サイズが画面を超える場合、アスペクト比を保ったまま画面に収まる最大サイズにクランプされ、ウィンドウが画面外にはみ出さない |
| 58 | 全画面解除後のウィンドウサイズ | 全画面モード中に（画面リサイズ前と異なるアスペクト比の）PDFを開いたのち、全画面を解除する | 開いたPDFのアスペクト比に基づくリサイズは行われず、全画面に入る前の通常ウィンドウサイズにそのまま戻る |
