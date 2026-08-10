-*- coding: utf-8 -*-

# 実装上の知見・検討記録

実装・設計時に検討した対策案や技術的な判断の記録。単発の修正で終わらず、後から経緯を振り返る価値がある事項をここに残す。

## 右クリックメニューが画面端をはみ出す問題（2026年対応）

### 症状
`historyMenu.js`の右クリックメニューは`position: fixed; left/top`をクリック座標にそのまま設定して右方向・下方向に開く実装だったため、画面右端・下端に近い位置で右クリックすると、メニューの右側/下側が画面からはみ出て切れてしまう。

### 検討した対策案

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A（採用） | メニューをDOMに追加した直後に`getBoundingClientRect()`で実際の幅・高さを測定し、右端/下端が`window.innerWidth`/`innerHeight`を超える場合は`left`/`top`をその分だけ左・上にずらす | 実際のコンテンツ幅に応じて正確にクランプできる。ネイティブの右クリックメニューと同じ挙動 | jsdomはレイアウト計算をしないため（`getBoundingClientRect`が既定で全て0を返す）、単体テストには`getBoundingClientRect`のモックが必要 |
| B | 実測せず、CSSの`max-width`（480px）を最大幅とみなして`left = Math.min(x, window.innerWidth - 480)`のように数値計算だけで位置を決める | DOM測定不要で純粋な数値計算のため単体テストが書きやすい | 実際のメニュー幅が480pxより狭い場合（履歴が短い等）に必要以上に左寄せされることがある |
| C | 自前のDOM配置メニューをやめ、`@tauri-apps/api/menu`のネイティブコンテキストメニューに置き換える | 画面端のクランプをOSが自動で行うため本質的な解決になる | 動的な文言切り替え（全画面トグルの表示切替）や既存スタイリングを含め`historyMenu.js`を大きく作り直す必要があり、影響範囲が大きい |

### 採用した対策
案A（実測値でのクランプ）を採用。`src/js/historyMenu.js`の`clampToViewport(menu)`で、メニューをDOM追加後に`getBoundingClientRect()`を測定し、右端・下端がビューポートを超える場合のみ`left`/`top`を再設定する。ビューポートよりメニュー自体が大きい場合は`0px`にクランプする。

### テスト時の注意
jsdomは実レイアウトを計算しないため、`tests/historyMenu.test.js`では`HTMLElement.prototype.getBoundingClientRect`を`vi.spyOn`でモックし、メニューの`style.left`/`style.top`から算出した仮想的な矩形を返すようにしてクランプ挙動を検証している（`mockMenuRect()`ヘルパー）。同様に画面端はみ出し系のUIを追加する際は、この手法を再利用できる。

## PDFを開いた直後に表示が上下逆・左右反転することがある問題（2026年対応）

### 症状
PDFファイルを開くと、直後の表示が上下逆・左右反転で表示されることが時々（非決定的に）起こる。同じファイルを開いても再現したりしなかったりする。

### 調査経緯
`src/js/app.js`の`openFile()`は、PDFを読み込んだ後に以下の順で処理する。

1. `windowSizer.fitToAspectRatio(aspectRatio)` でTauriウィンドウを実際にリサイズする。
2. `pdfViewer.renderPage(1)` で1ページ目を明示的に描画する。

一方、`start()`で一度だけ登録される`window`の`resize`イベントリスナー（`() => pdfViewer.onResize()`）は常時有効で、①のリサイズ自体がこの`resize`イベントを発火させ得る。その結果、`renderPage()`（内部で`pdf.js`の`page.render()`）が**同一の`#pdf-canvas`に対してほぼ同時に2回呼ばれる**ことがある。

`renderPage()`は呼び出しのたびに`canvas.width = viewport.width`を実行するが、これはCanvasの内容と2D描画コンテキストの変換行列を強制的にリセットする副作用を持つ。一方の描画が進行中にもう一方がこのリセットを行うと、進行中の描画が使っていた変換行列とCanvasの実際の状態がズレ、結果として画像が歪んだり座標変換が意図と逆転して見える描画崩れが起こり得る。

`pdfjs-dist`（インストール済み: v4.10.38）自身もこれを危険なパターンとして認識しており、同一Canvasへの並行`render()`を検知すると`"Cannot use the same canvas during multiple render() operations..."`という例外を投げるガードを持つ（`node_modules/pdfjs-dist/build/pdf.mjs`内、`InternalRenderTask.#canvasInUse`）。

「時々」起こる理由は、リサイズイベントの発火タイミングがOS/Webview側の非同期処理に依存し、明示的な`renderPage(1)`呼び出しとのタイミング次第で競合したりしなかったりするため。なお、コマンドライン引数付き起動の一番最初のオープンは`resize`リスナー登録前に完了するため対象外で、右クリックメニュー・履歴・ドラッグ＆ドロップ経由でPDFを開いた場合（2回目以降のオープン全般）で再現しやすい。

なお`spec.md`の3.4節にはかつて「同じページが再描画されるだけで問題は生じない」という記述があったが、これは「同一Canvasへの並行アクセスそのものが危険」という点を見落とした誤った前提だった（修正済み）。

### 対策の実装
`src/js/pdfViewer.js`の`renderPage()`に以下2つの仕組みを追加した。

1. **実行中のRenderTaskの即時キャンセル**: `page.render()`が返す`RenderTask`をモジュール変数`currentRenderTask`に保持し、新しい`renderPage()`呼び出しの先頭で、既存のタスクがあれば`.cancel()`する。`.cancel()`されたタスクは`RenderingCancelledException`で`reject`されるため、`try/catch`で捕捉して無視する（エラーとして扱わない）。
2. **世代カウンタによる後方互換な二重防御**: `.cancel()`だけでは、2つの`renderPage()`呼び出しが**間隔なく連続して**呼ばれた場合（どちらも`await pdfDocument.getPage()`の前でキャンセルチェックを行うため、互いの`currentRenderTask`がまだ設定されておらず素通りしてしまう）に対応できない。そこで`renderGeneration`というモジュール変数をカウンタとして使い、各呼び出し開始時に`const generation = ++renderGeneration`で自分の世代番号を記録し、`await pdfDocument.getPage()`から戻った直後に`generation !== renderGeneration`なら（＝自分より新しい呼び出しに追い越された、＝自分は古い＝呼び出し元は捨てられるべき）Canvasに一切触れずに即座に`return`する。

この2つを組み合わせることで、（a）既に描画中のタスクが新しい呼び出しによって割り込まれるケースと、（b）2つの呼び出しが同時に発生し`getPage()`の解決順序が入れ替わるケースの両方を、例外を投げずに正しく処理できる。

### テスト時の注意
`tests/pdfViewer.test.js`に、`await`を挟まず`renderPage(1)`と`renderPage(2)`を連続で呼び出し、両方のPromiseが`reject`せず`undefined`に`resolve`することを検証するテストを追加した。このテストは実際に世代カウンタなし・`.cancel()`のみの実装では失敗する（`"Cannot use the same canvas..."`で`reject`される）ことを確認済みで、世代カウンタが必要な理由を裏付けている。
