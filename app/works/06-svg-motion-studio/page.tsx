import type { Metadata } from "next";
import Link from "next/link";

import { SvgMotionStudio } from "./SvgMotionStudio";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "SVG Motion Studio | AI Build Challenge",
  description: "SVG本体を変更せず、用途に合う汎用CSSアニメーションとアクセシブルな実装コードを生成します。",
};

export default function SvgMotionStudioPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>WORK 06 / SVG MOTION STUDIO</p>
      <h1>SVG Motion Studio</h1>
      <p className={styles.lead}>任意のSVGまたは内蔵アイコンへ、汎用的なCSSアニメーションを設定できます。SVG本体は変更せず、外側のラッパーとCSSを生成します。</p>
      <ul className={styles.promises}><li>SVG本体は変更しません</li><li>入力内容はブラウザ内だけで処理します</li></ul>
    </header>
    <SvgMotionStudio />
    <section className={styles.section} aria-labelledby="limitations-title"><h2 id="limitations-title">このツールの制約</h2><p>SVG内部要素単位のアニメーション、pathモーフィング、stroke描画、SVG最適化、ファイルアップロードには対応しません。外部リソースを含むSVGは拒否します。検証は安全性をあらゆる環境で保証するものではありません。</p></section>
    <nav className={styles.backLink} aria-label="ページ間ナビゲーション"><Link href="/">← 作品一覧へ戻る</Link></nav>
  </main>;
}
