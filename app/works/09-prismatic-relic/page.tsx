import type { Metadata } from "next";

import { PrismaticRelic } from "./PrismaticRelic";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "PRISMATIC RELIC | AI Build Challenge",
  description: "ポインターで光を曲げる、半透明の人工鉱物。",
};

export default function PrismaticRelicPage() {
  return (
    <main className={styles.page}>
      <PrismaticRelic />
    </main>
  );
}
