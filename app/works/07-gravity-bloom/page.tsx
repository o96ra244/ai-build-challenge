import type { Metadata } from "next";
import Link from "next/link";

import { GravityBloom } from "./GravityBloom";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Gravity Bloom | AI Build Challenge",
  description: "光の粒子を引き寄せ、解放して花状の衝撃波を作るインタラクティブ3D作品です。",
};

export default function GravityBloomPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 07 / INTERACTIVE WEBGPU ART</p>
        <h1>Gravity Bloom</h1>
        <p className={styles.lead}>
          暗い空間を漂う光粒子を、移動できる光の核で引き寄せ、解放して花状に広げる作品です。
        </p>
      </header>

      <GravityBloom />

      <section className={styles.infoSection} aria-labelledby="tech-title">
        <p className={styles.kicker}>TECH / CONSTRAINTS</p>
        <h2 id="tech-title">触れるための3D表現</h2>
        <p>
          Three.jsのWebGPURendererを使い、WebGPUが使えない環境では同じレンダラーのWebGL 2バックエンドへフォールバックします。
          粒子は外部画像やモデルを使わず、GeometryとPointsでCPU側から更新しています。ブラウザ内の操作やスコアは保存しません。
        </p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
