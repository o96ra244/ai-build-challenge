import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";

const MODEL_SOURCE = "https://commons.wikimedia.org/wiki/File:Scan_the_World_-_The_Thinker_(Auguste_Rodin).stl";
const LICENSE_SOURCE = "https://creativecommons.org/licenses/by-sa/4.0/";

export const metadata: Metadata = {
  title: "ATTRIBUTION / CHANGES — THE THINKER LIGHT STUDY",
  description: "The Thinker model attribution and web optimization notice.",
};

export default function ThinkerAttributionPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.kicker}>09 / THE THINKER — LIGHT STUDY</p>
        <h1>ATTRIBUTION / CHANGES</h1>
        <p className={styles.intro}>
          This page records the source, license, and modifications made to the digital reproduction used in the lighting study.
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>Work</dt>
            <dd>“The Thinker”</dd>
          </div>
          <div>
            <dt>Original artist</dt>
            <dd>Auguste Rodin</dd>
          </div>
          <div>
            <dt>3D scan author</dt>
            <dd>Scan the World</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd><a href={MODEL_SOURCE} target="_blank" rel="noreferrer">Wikimedia Commons source page</a></dd>
          </div>
          <div>
            <dt>License</dt>
            <dd><a href={LICENSE_SOURCE} target="_blank" rel="noreferrer">Creative Commons Attribution-ShareAlike 4.0 International</a></dd>
          </div>
        </dl>

        <section className={styles.section} aria-labelledby="modifications-title">
          <p className={styles.sectionLabel}>MODIFICATIONS</p>
          <h2 id="modifications-title">Optimized for web</h2>
          <p>Polygon reduction, geometry cleanup and normal recalculation.</p>
          <ul>
            <li>Deterministic spatial-grid clustering reduces polygon count for a local web asset.</li>
            <li>Duplicate and degenerate triangles are removed before binary STL export.</li>
            <li>Normals are recalculated, then scale and orientation are normalized at runtime.</li>
          </ul>
          <p>
            The derived STL is also provided under <strong>CC BY-SA 4.0</strong>. This digital reproduction and lighting study is not an official, authorized, or museum-endorsed work and does not imply affiliation with Musée Rodin or another museum.
          </p>
        </section>

        <div className={styles.actions}>
          <Link href="/works/09-thinker-light-study">← BACK TO LIGHT STUDY</Link>
          <Link href="/">INDEX ↗</Link>
        </div>
      </article>
    </main>
  );
}
