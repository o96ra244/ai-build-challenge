import Link from "next/link";

import { works } from "./works";

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">30 DAYS / 15 WORKS</p>
        <h1 id="page-title">AI Build Challenge</h1>
        <p className="lead">
          ChatGPTで企画し、Codexで実装しながら、30日間で15作品を公開する個人開発チャレンジです。
        </p>
      </section>

      <section className="works" aria-labelledby="works-title">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">WORKS</p>
            <h2 id="works-title">公開作品</h2>
          </div>
          <p className="count" aria-label={`現在の公開作品数 ${works.length}件`}>
            <strong>{works.length}</strong>
            <span>件</span>
          </p>
        </div>

        {works.length === 0 ? (
          <p className="emptyState">公開作品はまだありません</p>
        ) : (
          <ul className="workGrid">
            {works.map((work) => (
              <li key={work.href}>
                <article className="workCard">
                  <p>WORK {String(work.number).padStart(2, "0")}</p>
                  <h3>{work.title}</h3>
                  <p>{work.description}</p>
                  <Link href={work.href}>作品を見る</Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
