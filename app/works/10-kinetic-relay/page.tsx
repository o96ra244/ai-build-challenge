import type { Metadata } from "next";

import { KineticRelay } from "./KineticRelay";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-kinetic-relay";
const WORK_TITLE = "KINETIC RELAY — Desk Chain Reaction";
const WORK_DESCRIPTION = "ACT 1の物理品質プロトタイプ。赤いビー玉が本で支えた定規の坂を重力で転がり、動的な消しゴムへ衝突する3D実験装置。";
const OG_IMAGE_PATH = "/og/10-kinetic-relay.png";
const OG_IMAGE_ALT = "本で支えた定規の坂を赤いビー玉が転がり、消しゴムへ衝突するACT 1物理品質プロトタイプ";

export const metadata: Metadata = {
  title: WORK_TITLE,
  description: WORK_DESCRIPTION,
  alternates: { canonical: WORK_URL },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "AI Build Challenge",
    url: WORK_URL,
    title: WORK_TITLE,
    description: WORK_DESCRIPTION,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: { card: "summary_large_image", title: WORK_TITLE, description: WORK_DESCRIPTION, images: [OG_IMAGE_PATH] },
};

export default function KineticRelayPage() {
  return <KineticRelay />;
}
