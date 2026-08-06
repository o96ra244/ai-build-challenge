import type { Metadata } from "next";
import Link from "next/link";

import { LowPolyRoverGarage } from "./LowPolyRoverGarage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Low Poly Rover Garage | AI Build Challenge",
  description: "低ポリ3Dの小型ローバーを組み替え、GARAGEとROVER FRONTIERを走破するインタラクティブ作品です。",
};

export default function LowPolyRoverGaragePage() {
  return (
  <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>WORK 08 / MODULAR 3D GARAGE</p>
        <h1>Low Poly Rover Garage</h1>
        <p className={styles.lead}>
          低ポリの小型ローバーを3カテゴリの部品から組み替え、GARAGEで眺めてから、明るいオリジナルの固定フロンティアを自由に走る作品です。
        </p>
      </header>

      <LowPolyRoverGarage />

      <section className={styles.infoSection} aria-labelledby="tech-title">
        <p className={styles.kicker}>TECH / CONSTRAINTS</p>
        <h2 id="tech-title">部品を選んで、ガレージから出す</h2>
        <p>
          Three.jsのWebGPURendererとRapierのray-cast vehicle controllerを組み合わせ、Front・Cabin・Rearの12モジュールを64通りで試せます。ROVER FRONTIERはRapierを遅延読み込みし、320×240 unitsのheightfield、dynamic rigid-bodyの車体、4輪サスペンション、丘、岩段差、whoops、谷、6地域、動的な箱・岩・丸太を同じ物理ワールドで走らせます。FREE ROAMではチェックポイントなしで探索し、WAYSTONE RUNでは6つのWaystoneを好きな順番で起動します。WASD／矢印キー、スマートフォンの4つのnative button、pause、reset、minimap、reduced-motionに対応し、best timeはページ内だけで保持します。WebGPU APIが使えない環境ではWebGPURendererの互換描画へフォールバックします。外部モデル、テクスチャ、キャラクター、音声は使いません。
        </p>
      </section>

      <nav className={styles.backLink} aria-label="ページ間ナビゲーション">
        <Link href="/">← 作品一覧へ戻る</Link>
      </nav>
    </main>
  );
}
