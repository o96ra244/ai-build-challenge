import type { Metadata } from "next";
import Link from "next/link";

import { AspectRatioCalculator } from "./AspectRatioCalculator";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "画像比率リサイズ計算機 | AI Build Challenge",
  description:
    "元画像の縦横比を維持したリサイズ後の幅・高さと、簡約比、CSSのaspect-ratioを計算します。",
};

export default function AspectRatioResizerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 01 / ASPECT RATIO RESIZER</p>
        <h1>画像比率リサイズ計算機</h1>
        <p className={styles.lead}>
          元画像の幅と高さ、変更したい一辺を入力すると、縦横比を保ったサイズを計算します。
          簡約した比率とCSSも、そのままコピーできます。
        </p>
      </header>

      <AspectRatioCalculator />

      <aside className={styles.note} aria-labelledby="note-title">
        <h2 id="note-title">このツールについて</h2>
        <p>
          ピクセル値は1〜100000の整数に対応しています。画像ファイルの読み込みや加工、入力内容の保存・外部送信は行いません。
        </p>
      </aside>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
