import type { Metadata } from "next";
import Link from "next/link";

import { TextLengthCounter } from "./TextLengthCounter";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "文字数・読了時間カウンター | AI Build Challenge",
  description:
    "文章の文字数、空白を除いた文字数、行数、日本語の概算読了時間をブラウザ上で確認できるWebツールです。",
};

export default function TextLengthCounterPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 02 / TEXT LENGTH COUNTER</p>
        <h1>文字数・読了時間カウンター</h1>
        <p className={styles.lead}>
          文章を入力すると、文字数・行数・日本語の概算読了時間をすぐに確認できます。
        </p>
      </header>

      <TextLengthCounter />

      <aside className={styles.note} aria-labelledby="note-title">
        <h2 id="note-title">このツールについて</h2>
        <p>
          読了時間は日本語500文字／分を基準にした概算です。文章の難易度や読み方により、実際の時間は変わります。入力内容を保存または外部送信することはありません。
        </p>
      </aside>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
