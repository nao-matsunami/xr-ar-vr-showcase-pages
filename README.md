# XR / AR / VR Daily Samples

毎日の XR / AR / VR / WebXR リサーチから生成した `自作サンプル` を蓄積し、GitHub Pages で公開するための最小構成です。役割は `空間体験 / XR 向け表現 / インタラクション試作` 寄りのデイリー実験集です。

このプロジェクトでは、外部の既存デモをそのまま作品カードとして並べません。既存事例はあくまで参考資料として調べ、自分の試作は `outputs/` と `reports/` に日付単位で保存します。

## 含まれるもの

- `outputs/`
  - 日付ごとの自作サンプル HTML
- `days/`
  - 日付ごとの詳細ページ
- `pages/`
  - 一覧の2ページ目以降
- `index.html`
  - サンプル一覧トップページ
- `reports/`
  - 日次レポート本文を日付ページへ載せるための JSON
- `scripts/build-gallery.mjs`
  - `outputs/` と `reports/` を走査して `index.html` / `days/` / `pages/` を再生成
- `scripts/upsert-report.mjs`
  - `reports/YYYY-MM-DD.json` を保存してから一覧再生成し、必要なら publish まで実行
- `.github/workflows/deploy-pages.yml`
  - GitHub Pages へ自動デプロイする workflow
- `.nojekyll`
  - GitHub Pages の Jekyll 処理を無効化

## ローカルで一覧を再生成

```bash
npm run build
```

または:

```bash
node scripts/build-gallery.mjs
```

GitHub Pages 公開用リポジトリへ反映する場合:

```bash
npm run publish:pages
```

## 毎朝の自動レポートをサイトへ反映する

日次レポート JSON を保存し、そのまま一覧再生成と GitHub Pages 公開まで流す場合:

```bash
node scripts/upsert-report.mjs --file reports/2026-07-07.json --publish
```

## 参考資料の扱い

既存の公式デモや作例は、公開アーカイブには直接並べず、必要なら内部メモとして残します。

- `research/external-references.json`
  - 以前確認した外部サンプルの退避メモ

## 運用方針

- 公開面には `自作サンプル` だけを載せる
- 外部事例はレポート本文の参考リンクとして扱う
- 毎日 1 本でも小さい試作を `outputs/` に追加する
- `reports/YYYY-MM-DD.json` で、その日の意図と技術メモを残す
