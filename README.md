# XR / AR / VR Showcase

VR / XR / AR の作品サンプル、事例、デモ、制作メモを蓄積するための独立プロジェクトです。単なる一覧ではなく、`収集 -> 検証 -> アーカイブ` の流れもここで持てるようにします。

## 目的

- シェーダー中心のデイリー集とは分けて、空間体験・インタラクション・作品事例を整理する
- 気になった事例をまず収集し、検証の途中段階も残せるようにする
- 作品カード一覧と個別ページを静的生成する
- GitHub Pages や Cloudflare Pages に載せやすい構成にする

## 構成

- `data/projects.json`
  - 公開アーカイブに出す作品データ本体
- `data/project-template.json`
  - 1件分の入力テンプレート
- `data/collection-queue.json`
  - 収集中・検証中の候補メモ
- `data/collection-template.json`
  - 候補メモ1件分の入力テンプレート
- `scripts/build-site.mjs`
  - 一覧ページと個別ページを生成
- `index.html`
  - 作品一覧トップ
- `items/*.html`
  - 各作品の個別ページ

## 使い方

データを編集:

```bash
open data/projects.json
```

サイト生成:

```bash
npm run build
```

## 収集と検証の流れ

おすすめの運用段階:

1. `data/collection-queue.json`
   気になった作品、記事、デモ、作者ページをまず入れる
2. `verification_status`
   `collected / reviewing / verified / archived` で管理する
3. `data/projects.json`
   公開したいものだけ整理して載せる

つまり、このプロジェクトは `収集メモ置き場` と `公開アーカイブ` を分ける前提です。

## データ項目

主な項目:

- `id`
- `title`
- `titleEn`
- `summary`
- `summaryEn`
- `platform`
- `engine`
- `tags`
- `creator`
- `year`
- `demoUrl`
- `sourceUrl`
- `references`
- `stage`
- `verificationStatus`
- `lastChecked`
- `notes`
- `status`

## 次にやると良いこと

- GitHub Pages 用 workflow を追加
- 作品を `XR / AR / VR / WebXR / installation` などでタグ整理
- 「見て良かった理由」「真似したい技術」「自分ならどう変えるか」を notes に入れる
- collection queue から公開候補へ移す基準を決める
