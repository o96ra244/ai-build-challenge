import type { Metadata } from "next";
import Link from "next/link";

import { LowPolyRoverGarage } from "./LowPolyRoverGarage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Low Poly Rover Garage | AI Build Challenge",
  description: "低ポリ3Dの小型ローバーを組み替え、短い試運転まで楽しめるインタラクティブ作品です。",
};

export default function LowPolyRoverGaragePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 08 / MODULAR 3D GARAGE</p>
        <h1>Low Poly Rover Garage</h1>
        <p className={styles.lead}>
          低ポリの小型ローバーを3カテゴリの部品から組み替え、完成した機体を短い試運転へ送り出す作品です。
        </p>
      </header>

      <LowPolyRoverGarage />

      <section className={styles.infoSection} aria-labelledby="tech-title">
        <p className={styles.kicker}>TECH / CONSTRAINTS</p>
        <h2 id="tech-title">部品を選んで、ガレージから出す</h2>
        <p>
          Three.jsのWebGPURendererと基本Geometryだけで、Front・Cabin・Rearの9モジュールを生成しています。27通りの構成を保存せずに試せて、WebGPU APIが使えない環境ではWebGPURendererの互換描画へフォールバックします。外部モデル、テクスチャ、キャラクター、音声は使いません。
        </p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
