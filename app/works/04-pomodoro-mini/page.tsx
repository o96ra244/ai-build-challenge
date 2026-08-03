import type { Metadata } from "next";
import Link from "next/link";

import { PomodoroTimer } from "./PomodoroTimer";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ポモドーロ・ミニ | AI Build Challenge",
  description:
    "作業時間と休憩時間を設定し、集中と休憩を切り替えられるシンプルなポモドーロタイマーです。",
};

export default function PomodoroMiniPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 04 / POMODORO MINI</p>
        <h1>ポモドーロ・ミニ</h1>
        <p className={styles.lead}>
          作業と休憩の時間だけを設定して、集中のリズムをすぐに始められるシンプルなタイマーです。
        </p>
      </header>

      <PomodoroTimer />

      <section className={styles.about} aria-labelledby="about-title">
        <h2 id="about-title">このツールについて</h2>
        <p>
          実行中は1秒ずつ数を減らすのではなく、終了予定時刻と現在時刻の差から残り時間を計算します。背景タブで更新が遅れた場合も、表示が再更新されたときに実際の経過時間へ補正します。
        </p>
        <p>
          ブラウザを閉じるとタイマーは動作しません。端末のスリープ中は画面を更新できませんが、ページが残っていれば復帰後に時刻差から補正します。音声やOS通知は行いません。
        </p>
        <p>入力した設定やタイマーの状態、履歴は保存せず、外部へ送信しません。</p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
