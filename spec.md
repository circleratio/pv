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
│       └── laserPointer.js  # レーザーポインター描画・フェードアウト管理
├── tests/              # フロントエンド単体テスト（Vitest）
│   ├── pdfViewer.test.js
│   ├── pageNavigator.test.js
│   ├── inputHandler.test.js
│   ├── laserPointer.test.js
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
| ファイル選択ダイアログ | `tauri-plugin-dialog` を使用し、PDF未指定時にフロントエンドから呼び出す |
| ウィンドウ設定 | `tauri.conf.json` にてメニューバーなし・通常ウィンドウ（リサイズ可・最大化可）・タイトルバーありを設定 |

### 2.2 app.js

- アプリ起動時の初期化処理を行うエントリポイント。
- `get_initial_pdf_path` を呼び出し、パスが得られればPDF読み込みへ、得られなければファイル選択ダイアログを表示。
- 各モジュール（`pdfViewer` / `pageNavigator` / `inputHandler` / `laserPointer`）を初期化・連携させる。
- エラーハンドリング: ファイル選択・`read_pdf_file`・`pdfViewer.loadPdf` のいずれかが失敗した場合は、`console.error`にログを出力したうえで画面にエラーメッセージを表示し、以降の初期化処理（`pageNavigator.init`等）は行わない（アプリケーションはクラッシュさせない）。再度のファイル選択などのリトライ導線は設けない。

### 2.3 pdfViewer.js

| 関数 | 役割 |
|---|---|
| `loadPdf(binaryData)` | pdf.jsで`Uint8Array`からPDFドキュメントを読み込み、総ページ数を返す |
| `renderPage(pageNumber)` | 指定ページを取得し、ウィンドウサイズに合わせたアスペクト比維持のスケールを計算してCanvasに描画 |
| `calculateFitScale(viewport, windowWidth, windowHeight)` | ページのviewportとウィンドウサイズから、アスペクト比を保ちつつウィンドウ内に収まる最大スケールを算出 |
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
| `mousedown`（右ボタン） | `laserPointer.startStroke(x, y)`、レーザーポインターモード開始 |
| `mousemove`（右ボタン押下中） | `laserPointer.addPoint(x, y)` |
| `mouseup`（右ボタン） | `laserPointer.endStroke()`、レーザーポインターモード終了・フェードアウト開始 |

- レーザーポインターモード中も上記のページ送り系イベントは無効化せず、そのまま`pageNavigator`へ委譲する。
- 右クリックのブラウザ標準コンテキストメニューは`contextmenu`イベントを`preventDefault()`して抑止する。

### 2.6 laserPointer.js

| 要素 | 役割 |
|---|---|
| オーバーレイCanvas | PDF描画用Canvasの上に重ねて配置し、レーザーポインターの丸のみを描画する |
| `startStroke(x, y)` | 新規ストロークを開始し、始点を記録 |
| `addPoint(x, y)` | ドラッグ中の座標をストロークに追加 |
| `endStroke()` | ストロークを確定し、フェードアウトアニメーションを開始 |
| `render()` | `requestAnimationFrame`ループで全ストロークをオレンジの丸（直径約40〜50px相当）で描画。経過時間に応じて透明度を下げ、1〜2秒でフェードアウト完了後にストロークを破棄 |

## 3. 処理フロー

### 3.1 起動フロー

```
main.rs: 起動 → コマンドライン引数解析
   │
   ▼
app.js: get_initial_pdf_path() 呼び出し
   │
   ├─ パスあり → read_pdf_file(path) でバイナリ取得
   │
   └─ パスなし → ファイル選択ダイアログ表示 → 選択されたパスで read_pdf_file(path)
   │
   ▼
pdfViewer.loadPdf(binaryData) → 総ページ数取得
   │
   ▼
pageNavigator.init(totalPages)
   │
   ▼
pdfViewer.renderPage(1) … 1ページ目を表示
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
右ボタン mousedown
   │
   ▼
laserPointer.startStroke(x, y)
   │
   ▼（押下中）
mousemove ごとに laserPointer.addPoint(x, y)
   │
   ▼
右ボタン mouseup
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
| `isActive` | boolean | 右クリック押下中かどうか |
| `strokes` | `Stroke[]` | 描画中・フェードアウト中のストローク一覧 |

`Stroke`構造:

| フィールド | 型 | 説明 |
|---|---|---|
| `points` | `{x: number, y: number}[]` | クリック・ドラッグで記録した座標列（クリックのみの場合は要素数1） |
| `endedAt` | number（timestamp）\| null | `endStroke()`が呼ばれた時刻。フェードアウト計算の起点。押下中は`null` |

## 5. テスト設計

| # | 観点 | テストケース | 期待結果 |
|---|---|---|---|
| 1 | 起動（引数あり） | PDFファイルパスを引数に指定して起動 | 指定PDFの1ページ目が表示される |
| 2 | 起動（引数なし） | 引数なしで起動 | ファイル選択ダイアログが表示され、選択後にPDFが表示される |
| 3 | 起動（不正パス） | 存在しないパスを引数に指定 | エラーとなり、適切にハンドリングされる（クラッシュしない） |
| 4 | ページ送り（前進） | →・↓・Space・ホイール下回転 | 現在ページが+1され再描画される |
| 5 | ページ送り（後退） | ←・↑・Backspace・ホイール上回転 | 現在ページが-1され再描画される |
| 6 | 境界（先頭） | 1ページ目で後退操作 | ページ番号が変化しない |
| 7 | 境界（末尾） | 最終ページで前進操作 | ページ番号が変化しない |
| 8 | 終了 | Escキー押下 | アプリケーションウィンドウが閉じる |
| 9 | レーザーポインター（クリック） | 右クリックのみ（ドラッグなし）で離す | クリック位置にオレンジの丸が表示され、1〜2秒でフェードアウトする |
| 10 | レーザーポインター（ドラッグ） | 右クリック押下したままマウス移動後に離す | 軌跡に沿って複数のオレンジの丸が表示され、それぞれフェードアウトする |
| 11 | レーザーポインター中のページ送り | 右クリック押下中に矢印キーでページ送り | ページが送られ、レーザーポインター表示・モードは継続する |
| 12 | リサイズ | ウィンドウサイズ変更 | PDFページがアスペクト比を保ったまま再フィット表示される |
| 13 | フィット表示 | 縦長／横長それぞれのPDFを表示 | いずれもウィンドウ内に収まり、はみ出しや不要な余白の偏りがない |
