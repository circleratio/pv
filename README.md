# pv

PDFをプレゼン用に表示するシンプルなビューアです。詳しい仕様は [docs/requirement.md](docs/requirement.md) を参照してください。

## インストール・ビルド

```sh
npm install
npm run tauri build
```

ビルドされた実行ファイルは `src-tauri/target/release/pv`（Windowsは`pv.exe`）に生成されます。

## 使い方

```sh
pv [PDFファイル]
```

- PDFファイルを指定せずに起動した場合は、PDFを読み込まない空白のウィンドウが表示されます（右クリックからファイルを開けます）。

### 操作方法

| 操作 | 内容 |
|---|---|
| →・↓・Space | 次のページ |
| ←・↑・Backspace | 前のページ |
| マウスホイール（下回転／上回転） | 次／前のページ |
| Esc | 終了 |
| 左クリック押しっぱなし＋ドラッグ | レーザーポインター（オレンジの線で軌跡を強調表示） |
| 右クリック | 「ファイルを開く」（ファイル選択ダイアログ）とファイル履歴（最大10件、ローカルに保存）のメニューを表示 |

ウィンドウはリサイズ・最大化に対応し、PDFページはアスペクト比を保ったまま表示されます。

## 開発

```sh
npm install
npm run tauri dev
```

## テスト

```sh
npm test          # フロントエンド単体テスト（Vitest）
cd src-tauri && cargo test  # Rustバックエンド単体テスト
```

## 開発環境

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
