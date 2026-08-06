import type { Metadata } from "next";
import Link from "next/link";

import { LowPolyRoverGarage } from "./LowPolyRoverGarage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Low Poly Rover Garage | AI Build Challenge",
  description: "12モジュールからローバーを組み替え、坂や障害物のあるTEST YARDで走行を試せる低ポリゴン3D作品です。",
};

export default function LowPolyRoverGaragePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 08 / LOW POLY PHYSICS</p>
        <h1>Low Poly Rover Garage</h1>
        <p className={styles.lead}>
          12モジュールからローバーを組み替え、坂・起伏・丸太・箱・岩・ジャンプ台を備えた小さなTEST YARDで操作感を試す作品です。
        </p>
      </header>

      <LowPolyRoverGarage />

      <section className={styles.infoSection} aria-labelledby="tech-title">
        <p className={styles.kicker}>TECH / SCOPE</p>
        <h2 id="tech-title">見た目と当たり判定を同じ定義から作る</h2>
        <p>
          GARAGEは4つのFront・4つのCabin・4つのRearから64通りを組み立てます。TEST YARDは共有object definitionから、床・坂・起伏・丸太・箱・岩・ジャンプ台・フェンスの見た目とRapier colliderを生成します。オープンワールド、Waystone、ミニマップ、タイマー、探索要素、外部モデルやテクスチャは使いません。
        </p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
