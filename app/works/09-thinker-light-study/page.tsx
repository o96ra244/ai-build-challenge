import type { Metadata } from "next";

import { ThinkerLightStudy } from "./ThinkerLightStudy";

export const metadata: Metadata = {
  title: "THE THINKER — LIGHT STUDY | AI Build Challenge",
  description: "同じ彫刻でも、光の角度と色で表情は変わる。",
};

export default function ThinkerLightStudyPage() {
  return <ThinkerLightStudy />;
}
