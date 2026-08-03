import type { Metadata } from "next";
import Link from "next/link";

import { ContrastChecker } from "./ContrastChecker";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "WCAGコントラストチェッカー | AI Build Challenge",
  description:
    "前景色と背景色からコントラスト比を計算し、WCAG 2.2の文字とUI部品の適合目安を確認できます。",
};

export default function WcagContrastCheckerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 03 / WCAG CONTRAST CHECKER</p>
        <h1>WCAGコントラストチェッカー</h1>
        <p className={styles.lead}>
          前景色と背景色を入力すると、コントラスト比とWCAG 2.2の適合目安をまとめて確認できます。
        </p>
      </header>

      <ContrastChecker />

      <section className={styles.note} aria-labelledby="note-title">
        <h2 id="note-title">このツールについて</h2>
        <p>
          WCAG 2.2の2色間のコントラスト比を計算するツールです。通常文字、大きな文字、UI部品・グラフィックでは基準が異なります。
        </p>
        <p>
          グラデーション、背景画像、半透明色、実際のフォント描画は評価しません。この結果だけでWebページ全体のWCAG適合を保証するものではありません。入力内容は保存または外部送信しません。
        </p>
        <ul>
          <li><a href="https://www.w3.org/TR/WCAG22/#contrast-minimum">WCAG 2.2「コントラスト（最低限）」</a></li>
          <li><a href="https://www.w3.org/TR/WCAG22/#contrast-enhanced">WCAG 2.2「コントラスト（高度）」</a></li>
          <li><a href="https://www.w3.org/TR/WCAG22/#non-text-contrast">WCAG 2.2「非テキストのコントラスト」</a></li>
          <li><a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">W3Cによる「コントラスト（最低限）」の解説</a></li>
        </ul>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
