import type { Metadata } from "next";
import Link from "next/link";

import { ResponsiveGridPlanner } from "./ResponsiveGridPlanner";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "レスポンシブカードグリッド設計ツール | AI Build Challenge",
  description:
    "カードの最小幅や余白から、画面幅ごとの列数とカード幅を計算し、CSS Gridコードを生成します。",
};

export default function ResponsiveGridPlannerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 05 / RESPONSIVE GRID PLANNER</p>
        <h1>レスポンシブカードグリッド設計ツール</h1>
        <p className={styles.lead}>
          カードの最小幅や余白を設定すると、画面幅ごとの列数とカード幅、切り替わり幅、実装用コードをまとめて確認できます。
        </p>
      </header>

      <ResponsiveGridPlanner />

      <section className={styles.notes} aria-labelledby="limitations-title">
        <h2 id="limitations-title">このツールの制約</h2>
        <ul>
          <li>プレビューは画面に収めた縮尺表示です。正確な値は計算結果を確認してください。</li>
          <li>実際の幅は親要素、スクロールバー、<code>box-sizing</code>などの影響を受けます。</li>
          <li>生成コードは実装の出発点です。カードの内容やデザインに応じて調整してください。</li>
          <li>入力内容は保存せず、外部へ送信しません。</li>
        </ul>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
