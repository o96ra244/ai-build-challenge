import type { Metadata } from "next";

import { KineticRelay } from "./KineticRelay";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-kinetic-relay";
const WORK_TITLE = "KINETIC RELAY — Triple Route Marble Machine | AI Build Challenge";
const WORK_DESCRIPTION = "3つのコースを機械式分岐器で切り替え、精密な3Dキネティックマシンの連鎖をボールが進むインタラクティブ作品。";
const OG_IMAGE_PATH = "/og/10-kinetic-relay.png";
const OG_IMAGE_ALT = "クローム、真鍮、ガラスの3コースと中央の機械式ルートセレクターを表示したKINETIC RELAYの画面";

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

export default function KineticRelayPage() {
  return <KineticRelay />;
}
