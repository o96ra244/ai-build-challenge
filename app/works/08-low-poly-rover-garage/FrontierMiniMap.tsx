import { FRONTIER_AREAS, WAYSTONES, worldToMinimap } from "./frontierWorld";
import styles from "./page.module.css";

export type FrontierMiniMapProps = {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly visitedAreaIds: readonly string[];
  readonly visitedWaystoneIds: readonly string[];
};

export function FrontierMiniMap({ x, z, heading, visitedAreaIds, visitedWaystoneIds }: FrontierMiniMapProps) {
  const [playerX, playerZ] = worldToMinimap(x, z);
  const safeHeading = Number.isFinite(heading) ? heading : 0;
  return (
    <svg className={styles.frontierMiniMap} viewBox="0 0 100 75" aria-hidden="true">
      <rect x="0" y="0" width="100" height="75" rx="6" className={styles.frontierMiniMapBackground} />
      {FRONTIER_AREAS.map((area) => {
        const [minX, minZ] = worldToMinimap(area.minX, area.minZ);
        const [maxX, maxZ] = worldToMinimap(area.maxX, area.maxZ);
        return (
          <rect
            key={area.id}
            x={minX * 100}
            y={minZ * 75}
            width={Math.max(2, (maxX - minX) * 100)}
            height={Math.max(2, (maxZ - minZ) * 75)}
            className={visitedAreaIds.includes(area.id) ? styles.frontierMiniMapAreaVisited : styles.frontierMiniMapArea}
          />
        );
      })}
      {WAYSTONES.map((waystone) => {
        const [waystoneX, waystoneZ] = worldToMinimap(waystone.x, waystone.z);
        const visited = visitedWaystoneIds.includes(waystone.id);
        return (
          <circle
            key={waystone.id}
            cx={waystoneX * 100}
            cy={waystoneZ * 75}
            r="2.4"
            className={visited ? styles.frontierMiniMapWaystoneVisited : styles.frontierMiniMapWaystone}
          />
        );
      })}
      <path
        className={styles.frontierMiniMapPlayer}
        d="M 0 -4 L 3.2 3 L 0 1.8 L -3.2 3 Z"
        transform={`translate(${playerX * 100} ${playerZ * 75}) rotate(${safeHeading * 180 / Math.PI})`}
      />
    </svg>
  );
}
