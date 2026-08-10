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
│       └── dragDrop.js      # ウィンドウへのファイルドラッグ＆ドロップ処理
├── tests/              # フロントエンド単体テスト（Vitest）
│   ├── pdfViewer.test.js
│   ├── pageNavigator.test.js
│   ├── inputHandler.test.js
│   ├── laserPointer.test.js
│   ├── fileHistory.test.js
│   ├── historyMenu.test.js
│   ├── windowSizer.test.js
│   ├── dragDrop.test.js
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
| Tauriコマンド `get_initial_pdf_path` | 起動時引数で渡されたPDFファイルパスを返す（未指定時は`None`） |
| Tauriコマンド `read_pdf_file(path: String)` | 指定パスのPDFファイルをバイナリ（`Vec<u8>`）として読み込み返却。存在しない・読み込み失敗時はエラーを返す |
| Tauriコマンド `load_history()` | アプリデータディレクトリの `history.json` を読み込み、履歴（ファイルパスの配列、最新が先頭）を返す。ファイルが存在しない場合は空配列を返す |
| Tauriコマンド `save_history(history: Vec<String>)` | 渡された履歴（ファイルパスの配列）で `history.json` を上書き保存する。ディレクトリが存在しない場合は作成する |
| ファイル選択ダイアログ | `tauri-plugin-dialog` を使用し、右クリックメニューの「ファイルを開く」選択時にフロントエンドから呼び出す |
| ウィンドウ設定 | `tauri.conf.json` にてメニューバーなし・通常ウィンドウ（リサイズ可・最大化可）・タイトルバーありを設定 |

### 2.2 app.js

- アプリ起動時の初期化処理を行うエントリポイント。
- `get_initial_pdf_path` を呼び出し、パスが得られればそのPDFを読み込む。パスが得られない場合はPDFを読み込まず、空白のウィンドウのまま初期化を完了する（ファイル選択ダイアログは自動表示しない）。
- 各モジュール（`pdfViewer` / `pageNavigator` / `inputHandler` / `laserPointer` / `fileHistory` / `historyMenu` / `windowSizer` / `dragDrop`）を初期化・連携させる。`inputHandler.init()` は起動時にPDFを読み込めたかどうかに関わらず必ず実行し、右クリックメニュー（「ファイルを開く」・履歴）を常に利用可能にする。`dragDrop.init({ onDrop: openFile })` も同様にPDFの読み込み結果に関わらず必ず実行し、ドラッグ＆ドロップでのファイルオープンを常に利用可能にする。
- 起動時に `fileHistory.load()` を呼び出し、保存済み履歴を読み込んでおく。
- `openFile(path)`: PDFを開く一連の処理（`read_pdf_file` → `pdfViewer.loadPdf` → `pdfViewer.getPageAspectRatio(1)` → `windowSizer.fitToAspectRatio(aspectRatio)` → `pageNavigator.init` → `pdfViewer.renderPage(1)`）を共通関数として提供し、成功時に `fileHistory.add(path)` を呼び出す。起動時（引数指定時）・「ファイルを開く」ダイアログ経由・履歴メニュー経由・ドラッグ＆ドロップ経由のいずれのPDFオープンもこの関数を通す。`windowSizer.fitToAspectRatio` が失敗しても`console.error`にログを出力するのみで処理は継続する（ウィンドウリサイズはPDF表示に必須ではないため）。
- `openFileViaDialog()`: `tauri-plugin-dialog` の `open()` でファイル選択ダイアログを表示し、選択された場合のみ `openFile(path)` を呼び出す。ダイアログがキャンセルされた場合（`open()` が `null` を返す場合）は何もしない。`inputHandler` の右クリックメニューの「ファイルを開く」から呼び出される。
- エラーハンドリング:
  - 起動時に引数でPDFパスが指定されており、その `openFile(path)` が失敗（`read_pdf_file`・`pdfViewer.loadPdf` のいずれかが失敗）した場合は、`console.error`にログを出力したうえで画面にエラーメッセージを表示し、`inputHandler.init()` を含む以降の初期化処理は行わない（アプリケーションはクラッシュさせない。再度のファイル選択などのリトライ導線は設けない）。
  - 「ファイルを開く」・履歴メニュー経由の `openFile(path)` が失敗した場合は、画面にエラーメッセージを表示するが、`inputHandler` は初期化済みのため右クリックメニューは引き続き利用できる。
  - いずれの場合も失敗した場合は履歴に追加しない。

### 2.3 pdfViewer.js

| 関数 | 役割 |
|---|---|
| `loadPdf(binaryData)` | pdf.jsで`Uint8Array`からPDFドキュメントを読み込み、総ページ数を返す |
| `renderPage(pageNumber)` | 指定ページを取得し、ウィンドウサイズに合わせたアスペクト比維持のスケールを計算してCanvasに描画 |
| `calculateFitScale(viewport, windowWidth, windowHeight)` | ページのviewportとウィンドウサイズから、アスペクト比を保ちつつウィンドウ内に収まる最大スケールを算出 |
| `getPageAspectRatio(pageNumber)` | 指定ページ（省略時は1）をscale 1で取得し、幅/高さのアスペクト比を返す。`loadPdf`後にのみ呼び出せる |
| `onResize()` | ウィンドウリサイズ時に現在ページを再描画 |

### 2.4 pageNavigator.js

| 関数 | 役割 |
|---|---|
| `init(totalPages)` | 総ページ数を保持し、現在ページを1に初期化 |
| `next()` | 現在ページが最終ページでなければ+1し再描画をトリガー。最終ページなら何もしない |
| `prev()` | 現在ページが1でなければ-1し再描画をトリガー。1ページ目なら何もしない |
| `getCurrentPage()` | 現在ページ番号を返す |

### 2.5 inputHandler.js

| イベント | 処理内容 |
|---|---|
| `keydown`（→・↓・Space） | `pageNavigator.next()` |
| `keydown`（←・↑・Backspace） | `pageNavigator.prev()` |
| `keydown`（Escape） | アプリ終了（Tauriウィンドウクローズ） |
| `wheel`（下回転） | `pageNavigator.next()` |
| `wheel`（上回転） | `pageNavigator.prev()` |
| `mousedown`（左ボタン） | `laserPointer.startStroke(x, y)`、レーザーポインターモード開始 |
| `mousemove`（左ボタン押下中） | `laserPointer.addPoint(x, y)` |
| `mouseup`（左ボタン） | `laserPointer.endStroke()`、レーザーポインターモード終了・フェードアウト開始 |
| `contextmenu`（右ボタン） | ブラウザ標準コンテキストメニューを`preventDefault()`で抑止したうえで、`fileHistory.getAll()`で履歴一覧を取得し`historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile })`を表示する。`onSelectEntry`には選択パスで`app.js`の`openFile(path)`を呼び出すコールバック、`onOpenFile`には`app.js`の`openFileViaDialog()`を呼び出すコールバックを渡す |

- レーザーポインターモード中も上記のページ送り系イベントは無効化せず、そのまま`pageNavigator`へ委譲する。
- 右ボタンには履歴メニュー表示以外の機能を割り当てない。

### 2.7 fileHistory.js

| 関数 | 役割 |
|---|---|
| `load()` | Tauriコマンド`load_history`を呼び出し、履歴一覧（最新が先頭の文字列配列）を取得して内部状態に保持する |
| `add(path)` | 指定パスを履歴に追加する。既に同じパスが履歴内に存在する場合は既存項目を削除してから先頭に追加する（重複排除・最新への繰り上げ）。追加後、件数が10件を超える場合は末尾（最古）を削除して10件に保つ。更新後の履歴でTauriコマンド`save_history`を呼び出し永続化する |
| `getAll()` | 現在保持している履歴一覧（最新が先頭の文字列配列）を返す |

### 2.8 historyMenu.js

| 関数 | 役割 |
|---|---|
| `show(x, y, entries, { onSelectEntry, onOpenFile })` | 指定座標にポップアップメニューをDOMで表示する。メニューの先頭には常に「ファイルを開く」項目を表示し、クリック時に`hide()`したうえで`onOpenFile()`を呼び出す。続けて履歴一覧を表示する。履歴が0件の場合は「履歴なし」を表示し選択不可とする。履歴項目クリック時は`hide()`したうえで`onSelectEntry(path)`を呼び出す |
| `hide()` | メニューを非表示にして破棄する。メニュー外のクリックでも呼び出される |

### 2.9 windowSizer.js

| 関数 | 役割 |
|---|---|
| `calculateSize(currentWidth, currentHeight, aspectRatio)` | 現在のウィンドウ幅・高さから面積を算出し、その面積をなるべく保ちつつ指定アスペクト比（幅/高さ）となる幅・高さを算出する純粋関数（`height = sqrt(面積 / aspectRatio)`、`width = height * aspectRatio`、四捨五入）。 |
| `fitToAspectRatio(aspectRatio)` | Tauriの`@tauri-apps/api/window`（`getCurrentWindow`）を用いて、現在のウィンドウが最大化中であれば`unmaximize()`を呼び出したうえで、`innerSize()`と`calculateSize`から算出した新サイズを`setSize()`で適用する非同期関数 |

Tauriの権限設定（`src-tauri/capabilities/default.json`）に、ウィンドウリサイズに必要な `core:window:allow-inner-size` / `core:window:allow-is-maximized` / `core:window:allow-set-size` / `core:window:allow-unmaximize` を追加する。

### 2.10 dragDrop.js

| 関数 | 役割 |
|---|---|
| `init({ onDrop })` | Tauriの`@tauri-apps/api/window`（`getCurrentWindow`）の`onDragDropEvent`でOSレベルのファイルドラッグ＆ドロップを監視する非同期関数。イベントの`type`が`"drop"`の場合、`paths`配列の先頭要素（1件目）のみを対象に`onDrop(path)`を呼び出す（複数ファイルが同時にドロップされた場合、2件目以降は無視する）。`type`が`"drop"`以外（`enter`/`over`/`leave`）の場合は何もしない |

Tauriのデフォルト設定では、ウィンドウのOSレベルドラッグ＆ドロップ（`dragDropEnabled`）は有効になっており、`tauri.conf.json`の変更は不要。イベント購読自体は `core:default`（`core:event:default`に含まれる`allow-listen`）で許可されるため、`capabilities/default.json`への追加権限も不要。

### 2.6 laserPointer.js

| 要素 | 役割 |
|---|---|
| オーバーレイCanvas | PDF描画用Canvasの上に重ねて配置し、レーザーポインターの軌跡のみを描画する |
| `startStroke(x, y)` | 新規ストロークを開始し、始点をCanvasローカル座標に変換して記録 |
| `addPoint(x, y)` | ドラッグ中の座標をCanvasローカル座標に変換してストロークに追加 |
| `endStroke()` | ストロークを確定し、フェードアウトアニメーションを開始 |
| `calculateRadius(canvasWidth, canvasHeight)` | オーバーレイCanvasの短辺に対する比率（`RADIUS_RATIO`）から線の太さ（半径換算）を算出する純粋関数。ウィンドウサイズが変わっても相対サイズを維持する |
| `render()` | `requestAnimationFrame`ループで、各ストロークの記録点を`moveTo`/`lineTo`で結んだ1本のオレンジの線として`lineCap: round`で描画（太さは`calculateRadius`の2倍、Canvas短辺の約1.4%相当）。1点のみのストローク（ドラッグなしのクリック）は始点から始点への長さ0の線分となり、丸い線端により点として表示される。経過時間に応じて透明度を下げ、1〜2秒でフェードアウト完了後にストロークを破棄 |

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
   read_pdf_file(path) でバイナリ取得
   │
   ▼
   pdfViewer.loadPdf(binaryData) → 総ページ数取得
   │
   ▼
   pdfViewer.getPageAspectRatio(1) → 1ページ目のアスペクト比取得
   │
   ▼
   windowSizer.fitToAspectRatio(aspectRatio)
   （最大化中なら解除 → 現在の面積を保ってアスペクト比に合わせてリサイズ。失敗してもログのみで継続）
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
inputHandler が方向判定
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
1〜2秒経過後、当該ストロークを破棄（完全に消える）
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

`windowSizer.fitToAspectRatio`（3.1参照）による`setSize()`呼び出しもこの`resize`イベントを発生させうるが、`openFile`内で直後に`renderPage(1)`を明示的に呼び出すため、結果として同じページが再描画されるだけで問題は生じない。

### 3.5 ファイル履歴選択フロー

```
右ボタン contextmenu
   │
   ▼
inputHandler: preventDefault() → fileHistory.getAll()
   │
   ▼
historyMenu.show(x, y, entries, { onSelectEntry, onOpenFile })
   │
   ├─（「ファイルを開く」クリック）→ hide() → onOpenFile() → app.js: openFileViaDialog()
   │        │
   │        ├─ ダイアログでファイル選択 → openFile(path)
   │        └─ ダイアログをキャンセル → 何もしない
   │
   └─（履歴項目クリック）→ hide() → onSelectEntry(path) → app.js: openFile(path)

openFile(path) 内で fileHistory.add(path) が実行され、
開いたファイルが最新の履歴に繰り上がる（新規の場合は先頭に追加）
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
   └─ "drop" → paths配列の先頭パスのみを対象とする（2件目以降は無視）
          │
          ▼
        onDrop(path) → app.js: openFile(path)
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
| 8 | 終了 | Escキー押下 | アプリケーションウィンドウが閉じる |
| 9 | レーザーポインター（クリック） | 左クリックのみ（ドラッグなし）で離す | クリック位置にオレンジの点が表示され、1〜2秒でフェードアウトする |
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
