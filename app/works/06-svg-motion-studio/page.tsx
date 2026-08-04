import type { Metadata } from "next";
import Link from "next/link";

import { SvgMotionStudio } from "./SvgMotionStudio";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "SVG Motion Lab | AI Build Challenge",
  description: "SVG本体を変更せず、同じSVGで12種類のCSSモーションを比較・調整して実装コードを生成します。",
};

export default function SvgMotionStudioPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>WORK 06 / SVG MOTION LAB</p>
      <h1>SVG Motion Lab</h1>
      <p className={styles.lead}>SVGを貼るだけ。12種類のCSSモーションを同じアイコンで比べて、そのまま実装コードをコピーできます。</p>
      <ul className={styles.promises}><li>SVG本体は変更しません</li><li>入力内容はブラウザ内だけで処理します</li><li>reduced-motion対応コードを生成します</li></ul>
    </header>
    <SvgMotionStudio />
    <section className={styles.section} aria-labelledby="limitations-title"><h2 id="limitations-title">このツールの制約</h2><p>SVG内部要素単位のアニメーション、pathモーフィング、stroke描画、SVG最適化、ファイルアップロードには対応しません。外部リソースを含むSVGは拒否します。検証は安全性をあらゆる環境で保証するものではありません。</p></section>
    <nav className={styles.backLink} aria-label="ページ間ナビゲーション"><Link href="/">← 作品一覧へ戻る</Link></nav>
  </main>;
}
