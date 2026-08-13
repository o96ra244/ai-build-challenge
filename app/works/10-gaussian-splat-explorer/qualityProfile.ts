export type QualityProfile = {
  readonly isMobile: boolean;
  readonly pixelRatioCap: number;
  readonly pixelRatio: number;
};

export const MOBILE_VIEWPORT_BREAKPOINT = 720;
export const DESKTOP_PIXEL_RATIO_CAP = 1.5;
export const MOBILE_PIXEL_RATIO_CAP = 1;

function getSafeDevicePixelRatio(devicePixelRatio: number): number {
  return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
}

export function getQualityProfile(
  viewportWidth: number,
  _viewportHeight: number,
  devicePixelRatio: number,
): QualityProfile {
  const isMobile = viewportWidth < MOBILE_VIEWPORT_BREAKPOINT;
  const pixelRatioCap = isMobile ? MOBILE_PIXEL_RATIO_CAP : DESKTOP_PIXEL_RATIO_CAP;
  return {
    isMobile,
    pixelRatioCap,
    pixelRatio: Math.min(getSafeDevicePixelRatio(devicePixelRatio), pixelRatioCap),
  };
}
