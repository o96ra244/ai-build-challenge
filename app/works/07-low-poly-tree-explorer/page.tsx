import type { Metadata } from "next";
import Link from "next/link";

import { LowPolyTreeExplorer } from "./LowPolyTreeExplorer";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Low Poly Tree Explorer | AI Build Challenge",
  description: "低ポリゴンの3Dツリーを回転・ズーム・分解表示して楽しめるインタラクティブ3D作品です。",
};

export default function LowPolyTreeExplorerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 07 / INTERACTIVE 3D SCENE</p>
        <h1>Low Poly Tree Explorer</h1>
        <p className={styles.lead}>
          低ポリゴンの木を回転・ズーム・分解表示して、ひとつの景色をさまざまな角度から眺める作品です。
        </p>
      </header>

      <LowPolyTreeExplorer />

      <section className={styles.infoSection} aria-labelledby="tech-title">
        <p className={styles.kicker}>TECH / CONSTRAINTS</p>
        <h2 id="tech-title">木の構造をそのまま眺める</h2>
        <p>
          Three.jsのWebGPURendererで、幹・枝・葉・低ポリの島と石をリポジトリ内のGeometryから描画しています。WebGPU APIが利用できない環境では、同じWebGPURendererのWebGL 2バックエンドへフォールバックします。外部モデル、テクスチャ、設定パネル、保存機能は使いません。
        </p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
