import type { Metadata } from "next";

import { KineticRelay } from "./KineticRelay";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-kinetic-relay";
const WORK_TITLE = "KINETIC RELAY — Desk Chain Reaction";
const WORK_DESCRIPTION = "夕方の子ども部屋の机で、ビー玉・文房具・積み木・ミニカーが次々に役割を受け渡し、卓上ベルまでつながる3D連鎖装置。";
const OG_IMAGE_PATH = "/og/10-kinetic-relay.png";
const OG_IMAGE_ALT = "夕方の子ども部屋の木製デスクで、赤いビー玉からミニカー、卓上ベルへつながる3D連鎖装置";

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
