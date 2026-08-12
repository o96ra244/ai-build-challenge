import type { Metadata } from "next";

import { KineticRelay } from "./KineticRelay";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-kinetic-relay";
const WORK_TITLE = "KINETIC RELAY — Desk Chain Reaction";
const WORK_DESCRIPTION = "夕方の子ども部屋の机と棚を横断し、ビー玉・文房具・積み木・ミニカーが29段階で役割を受け渡して卓上ベルへつながる、約98秒の3D連鎖装置。";
const OG_IMAGE_PATH = "/og/10-kinetic-relay.png";
const OG_IMAGE_ALT = "夕方の子ども部屋の机と棚を横断し、赤いビー玉からミニカー、卓上ベルへつながる29段階の3D連鎖装置";

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
