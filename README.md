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

現在の作品数: **3件**

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

## 公開URL

- 本番サイト: https://ai-build-challenge.vercel.app/
