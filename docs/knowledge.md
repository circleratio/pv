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
