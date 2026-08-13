import type { Metadata } from "next";

import { GaussianSplatExplorer } from "./GaussianSplatExplorer";

const WORK_URL = "https://ai-build-challenge.vercel.app/works/10-gaussian-splat-explorer";
const WORK_TITLE = "Gaussian Splat Explorer | AI Build Challenge";
const WORK_DESCRIPTION = "ニホンミツバチのSPZ v4 Gaussian Splatを、Meadowの実写背景の中でドラッグとズームにより観察できるThree.js作品。";
const OG_IMAGE_PATH = "/og/10-gaussian-splat-explorer.png";
const OG_IMAGE_ALT = "Meadowの実写背景の中央にJapanese BeeのGaussian Splatを表示したGaussian Splat Explorerの画面";

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

export default function GaussianSplatExplorerPage() {
  return <GaussianSplatExplorer />;
}
