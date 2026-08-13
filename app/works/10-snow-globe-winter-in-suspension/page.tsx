import type { Metadata } from "next";

import { SnowGlobeExperience } from "./SnowGlobeExperience";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-snow-globe-winter-in-suspension";
const WORK_TITLE = "SNOW GLOBE — Winter in Suspension | AI Build Challenge";
const WORK_DESCRIPTION = "小さな山小屋と雪を液体ごと揺らす、Three.js / WebGPU中心のインタラクティブ・スノードーム。積雪と再飛散の履歴を楽しめます。";
const OG_IMAGE_PATH = "/og/10-snow-globe-winter-in-suspension.png";
const OG_IMAGE_ALT = "暖かな窓明かりの小屋、雪片、グリッターを閉じ込めた透明なスノードームの最終画面";

export const metadata: Metadata = {
  title: WORK_TITLE,
  description: WORK_DESCRIPTION,
  alternates: {
    canonical: WORK_URL,
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "AI Build Challenge",
    url: WORK_URL,
    title: WORK_TITLE,
    description: WORK_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: WORK_TITLE,
    description: WORK_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export default function SnowGlobeWinterInSuspensionPage() {
  return <SnowGlobeExperience />;
}
