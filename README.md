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

現在の作品数: **8件**

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

低ポリの小型ローバーをFront・Cabin・Rearの3カテゴリから組み替え、GARAGEで眺めてからDIRT TRIALを手動で1周するインタラクティブ3D作品です。

- GitHub上のパス: [`app/works/08-low-poly-rover-garage/`](app/works/08-low-poly-rover-garage/)
- 想定公開URL: https://ai-build-challenge.vercel.app/works/08-low-poly-rover-garage
- 主な機能: 12種類のモジュールによる64通りの構成、対象カテゴリだけの交換アニメーション、GARAGEのOrbit・Zoom・Reset・自動回転、DIRT TRIALの広い低ポリ地形、起伏、コース外減速、簡易円形衝突、4チェックポイント、1周タイムアタック、ベストタイム（ページ内のみ）、pause、reset、車輪・タービン・砂ぼこり、WebGPURendererと互換描画
- 操作方法: PCはW／矢印上でアクセル、S／矢印下でブレーキ・後退、A／矢印左とD／矢印右で旋回、Rで最後のチェックポイントへ戻し、Pでpause／再開します。スマートフォンは左旋回・右旋回・アクセル・ブレーキ／後退の4つの押し続けるbuttonを使います。
- 走行フロー: DIRT TRIALを開くとコース全体を表示し、スタート後に3・2・1・GOのカウントダウンを行います。4つのチェックポイントを順番に通過して正方向にゴールラインを横切るとclearします。
- アクセシビリティ: 可視のキーボード操作説明、可視ラベル付きnative button、`aria-pressed`、pause／clear通知、focus-visible、canvasの`aria-hidden="true"`・`role="presentation"`、reduced-motion対応を実装しています。タイマーと速度の頻繁な更新はaria-liveにしません。
- 検証: `npm run lint`、`npm run typecheck`、`npm run test`（13ファイル・327件）、`npm run build`（12静的ルート）、`git diff --check`に成功しています。
- ブラウザ確認: Playwright接続ブラウザのローカル本番ビルドで1440×900、390×844、320×800を確認しました。GARAGE／DIRT TRIAL、READY、3・2・1・GO後のRUNNING、Wキー保持による速度変化、pause時のタイマー停止、単一pointerの押下・解除、4操作buttonのdisabled／`aria-pressed`、横スクロールなし、stage寸法維持、console error／warningなしを確認しました。PerformanceObserverで測定したCLSは0.00048013170817656016でした。
- 未確認: 実機スマートフォンの2本指同時入力、実機Macキーボード・トラックパッド、pointercancelの実端末挙動、手動での1周clear・best time更新・全checkpoint・衝突・コース外減速、OS設定をページ再読み込みなしで切り替えるreduced-motion、タブ非表示・復帰、WebGPU APIなし環境、200%ズームは未確認です。
- 既知の制約: コースは1つ・1周、外部モデル・テクスチャ・物理エンジン・音声・保存・ランキング通信は使用しません。ベストタイムはページを離れると保持しません。

## 公開URL

- 本番サイト: https://ai-build-challenge.vercel.app/
