import type { Metadata } from "next";

import { ThinkerLightStudy } from "./ThinkerLightStudy";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/09-thinker-light-study";
const WORK_TITLE = "THE THINKER — LIGHT STUDY | AI Build Challenge";
const WORK_DESCRIPTION = "ロダン《考える人》のデジタル3Dスキャンに光を当て、3つの照明モードと直接操作で陰影の変化を体験できるThree.js / WebGPU作品。";
const OG_IMAGE_PATH = "/og/09-thinker-light-study.png";
const OG_IMAGE_ALT = "青緑と紫の照明を受けたロダン《考える人》の3D彫刻を中央に表示したTHE THINKER — LIGHT STUDYの画面";

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

export default function ThinkerLightStudyPage() {
  return <ThinkerLightStudy />;
}
