# AI Build Challenge

ChatGPTで企画し、Codexで実装しながら、30日間で15作品の公開を目指す個人開発チャレンジのサイトです。このリポジトリでは、すべての作品を1つのNext.jsサイトとして管理します。

## チャレンジの目的

- AIと協働する個人開発のプロセスを実践し、記録する
- 小さな作品を継続的に企画・実装・検証・公開する
- 30日間で15作品を公開する

## 使用技術

- Next.js（App Router）
- React
- TypeScript
- CSS
- Three.js（WebGPURenderer）
- ESLint
- Vitest
- npm

外部UIライブラリ、認証、データベース、外部API、アクセス解析は使用していません。

## セットアップ

Node.js 24 LTS と npm を使用します。

```bash
npm install
npm run dev
```

開発サーバー起動後、`http://localhost:3000` を開いてください。

## npmスクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動します |
| `npm run lint` | ESLintを実行します |
| `npm run typecheck` | TypeScriptの型検査を実行します |
| `npm run test` | Vitestを非対話モードで実行します |
| `npm run build` | 本番用ビルドを作成します |

## 作品一覧

現在の作品数: **9件**

### 01 画像比率リサイズ計算機

元画像の縦横比を保ったまま、変更後の幅または高さを計算するWebツールです。

- GitHub上のパス: [`app/works/01-aspect-ratio-resizer/`](app/works/01-aspect-ratio-resizer/)
- 公開先ルート: `/works/01-aspect-ratio-resizer`
- 作品URL: https://ai-build-challenge.vercel.app/works/01-aspect-ratio-resizer

### 02 文字数・読了時間カウンター

文章の文字数、行数、日本語の概算読了時間をブラウザ上で確認するWebツールです。

- GitHub上のパス: [`app/works/02-text-length-counter/`](app/works/02-text-length-counter/)
- 公開先ルート: `/works/02-text-length-counter`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/02-text-length-counter

### 03 WCAGコントラストチェッカー

前景色と背景色からコントラスト比を計算し、WCAG 2.2の文字とUI部品の適合目安を確認するWebツールです。

- GitHub上のパス: [`app/works/03-wcag-contrast-checker/`](app/works/03-wcag-contrast-checker/)
- 公開先ルート: `/works/03-wcag-contrast-checker`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/03-wcag-contrast-checker

### 04 ポモドーロ・ミニ

作業時間と休憩時間を円形ダイヤルで設定し、集中と休憩を切り替えられるシンプルなポモドーロタイマーです。

- GitHub上のパス: [`app/works/04-pomodoro-mini/`](app/works/04-pomodoro-mini/)
- 公開先ルート: `/works/04-pomodoro-mini`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/04-pomodoro-mini

### 05 レスポンシブカードグリッド設計ツール

カードの最小幅、gap、最大列数、左右余白、カード数から、任意幅での列数とカード幅、切り替わり幅、実装用HTML・CSSを生成するWebツールです。

- GitHub上のパス: [`app/works/05-responsive-grid-planner/`](app/works/05-responsive-grid-planner/)
- 公開先ルート: `/works/05-responsive-grid-planner`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/05-responsive-grid-planner

### 06 SVG Motion Studio

SVG本体を変更せず、同じ内蔵アイコンまたは任意のSVGで12種類のCSSモーションを比較・調整してHTML・CSSを生成するWebツールです。

- GitHub上のパス: [`app/works/06-svg-motion-studio/`](app/works/06-svg-motion-studio/)
- 公開先ルート: `/works/06-svg-motion-studio`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/06-svg-motion-studio
- 主な機能: 同一SVGで12種類を一括比較、Speed・Strength・Triggerの簡易調整、詳細設定、任意SVGの安全検証、原文保持、HTML・CSSコピー、reduced-motion対応

### 07 Low Poly Tree Explorer

低ポリゴンの3Dツリーを回転・ズーム・分解表示して触って楽しめるインタラクティブ3D作品です。

- GitHub上のパス: [`app/works/07-low-poly-tree-explorer/`](app/works/07-low-poly-tree-explorer/)
- 公開先ルート: `/works/07-low-poly-tree-explorer`
- 作品URL（mainマージ後）: https://ai-build-challenge.vercel.app/works/07-low-poly-tree-explorer
- 主な機能: 低ポリツリーのOrbit・Zoom・Explode・Reset・自動回転、WebGPURendererとWebGL 2フォールバック、キーボード・タッチ・reduced-motion対応

### 08 Low Poly Rover Garage

12種類の低ポリパーツをGARAGEで組み替え、同じローバーを小さなTEST YARDへ持ち込んで坂・起伏・丸太・箱・岩・ジャンプ台の走行感を確認する3Dツールです。

- GitHub上のパス: [`app/works/08-low-poly-rover-garage/`](app/works/08-low-poly-rover-garage/)
- 公開予定URL: https://ai-build-challenge.vercel.app/works/08-low-poly-rover-garage
- 主な機能: Front・Cabin・Rear各4モジュール、64通りの組み合わせ、Orbit・Zoom・Reset・Auto rotate、Rapierの4輪ray-cast vehicle、TEST YARDのPause・Recover、PCキーボード・スマートフォンpointer操作
- 使用技術: Three.js WebGPURenderer、`@dimforge/rapier3d-compat` 0.19.3、CSS Modules、Vitest

### 09 THE THINKER — LIGHT STUDY

オーギュスト・ロダン《考える人》のデジタルスキャンへ光を当て、同じ彫刻の輪郭と影が照明でどう変わるかを観察する一画面のインタラクティブ3D作品です。照明の比較を主役にしながら、造形物の回転・拡大縮小で気になる面を読み取れます。

- GitHub上のパス: [`app/works/09-thinker-light-study/`](app/works/09-thinker-light-study/)
- 公開予定URL: https://ai-build-challenge.vercel.app/works/09-thinker-light-study
- 主な機能: GALLERY／CHIAROSCURO／SPECTRUMの3照明モード、ポインターとLIGHT POSITIONボタンによる主光源操作、光源マーカー・強度倍率表示、VIEWボタンによる制限付き回転・拡大縮小、視点リセット、小さなカメラ視差、HOLD LIGHT、reduced-motion、WebGPUとWebGL 2のフォールバック
- 使用技術: Three.js 0.185.1 `WebGPURenderer`、`MeshStandardNodeMaterial`、TSL、RenderPipelineの選択的Bloom、CSS Modules、Vitest
- モデル素材: Wikimedia CommonsのScan the Worldによる《The Thinker》STLをローカルへ配置し、決定的な空間グリッド方式で約84万から約7万三角形へ削減したバイナリSTLを使用しています。画面内creditと [`/works/09-thinker-light-study/attribution`](app/works/09-thinker-light-study/attribution/page.tsx) から、出典・ライセンス・改変内容を確認できます。

## 公開URL

- 本番サイト: https://ai-build-challenge.vercel.app/
