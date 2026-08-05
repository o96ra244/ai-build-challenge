import { describe, expect, it } from "vitest";

import {
  DEFAULT_PARTICLE_BOUNDS,
  calculateAttraction,
  calculateParticleCount,
  clampDeltaTime,
  countCapturedParticles,
  createParticleField,
  normalizedPointerToWorld,
  releaseParticleField,
  updateParticleField,
} from "./simulation";

describe("Gravity Bloom particle simulation", () => {
  it("指定数の粒子をseedから再現可能に生成する", () => {
    const first = createParticleField(24, 42, DEFAULT_PARTICLE_BOUNDS);
    const same = createParticleField(24, 42, DEFAULT_PARTICLE_BOUNDS);
    const different = createParticleField(24, 43, DEFAULT_PARTICLE_BOUNDS);

    expect(Array.from(first.positions)).toEqual(Array.from(same.positions));
    expect(Array.from(first.velocities)).toEqual(Array.from(same.velocities));
    expect(Array.from(first.positions)).not.toEqual(Array.from(different.positions));
    expect(first.count).toBe(24);
  });

  it("初期粒子を指定範囲へ有限値で配置する", () => {
    const field = createParticleField(120, 7, DEFAULT_PARTICLE_BOUNDS);

    for (let index = 0; index < field.count; index += 1) {
      const offset = index * 3;
      expect(Number.isFinite(field.positions[offset])).toBe(true);
      expect(Number.isFinite(field.positions[offset + 1])).toBe(true);
      expect(Number.isFinite(field.positions[offset + 2])).toBe(true);
      expect(Math.abs(field.positions[offset])).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.x);
      expect(Math.abs(field.positions[offset + 1])).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.y);
      expect(Math.abs(field.positions[offset + 2])).toBeLessThanOrEqual(DEFAULT_PARTICLE_BOUNDS.z);
    }
  });

  it("delta timeを有限値かつ上限内へ補正する", () => {
    expect(clampDeltaTime(0)).toBe(0);
    expect(clampDeltaTime(-1)).toBe(0);
    expect(clampDeltaTime(Number.NaN)).toBe(0);
    expect(clampDeltaTime(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampDeltaTime(0.016)).toBeCloseTo(0.016);
    expect(clampDeltaTime(4)).toBe(0.05);
  });

  it("核に近い粒子ほど引力が強く、範囲外では反応しない", () => {
    const near = calculateAttraction(
      { x: 0.2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1.5,
      4,
      5,
    );
    const far = calculateAttraction(
      { x: 1.2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1.5,
      4,
      5,
    );
    const outside = calculateAttraction(
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1.5,
      4,
      5,
    );

    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
    expect(near.x).toBeLessThan(0);
    expect(outside).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("距離0でも引力と更新結果がNaNにならない", () => {
    const field = createParticleField(1, 3, DEFAULT_PARTICLE_BOUNDS);
    field.positions[0] = 0;
    field.positions[1] = 0;
    field.positions[2] = 0;

    updateParticleField(field, { x: 0, y: 0, z: 0 }, 0.016, true);

    expect(calculateAttraction({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, 4, 5)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    expect(Array.from(field.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(field.velocities).every(Number.isFinite)).toBe(true);
  });

  it("チャージ中は近い粒子を捕捉し、最大速度を超えない", () => {
    const field = createParticleField(2, 5, DEFAULT_PARTICLE_BOUNDS);
    field.positions.set([0.35, 0, 0, 2.5, 0, 0]);
    field.velocities.fill(0);

    updateParticleField(field, { x: 0, y: 0, z: 0 }, 0.05, true);

    expect(countCapturedParticles(field)).toBe(1);
    expect(Math.hypot(field.velocities[0], field.velocities[1], field.velocities[2])).toBeLessThanOrEqual(3.4);
    expect(Math.hypot(field.velocities[3], field.velocities[4], field.velocities[5])).toBeLessThanOrEqual(3.4);
  });

  it("解放時に捕捉粒子へ有限の外向き速度を与え、捕捉状態を解除する", () => {
    const field = createParticleField(2, 8, DEFAULT_PARTICLE_BOUNDS);
    field.positions.set([0.4, 0, 0, -0.4, 0, 0]);
    field.captured[0] = 1;
    field.captured[1] = 1;

    const released = releaseParticleField(field, { x: 0, y: 0, z: 0 }, 1);

    expect(released).toBe(2);
    expect(field.velocities[0]).toBeGreaterThan(0);
    expect(field.velocities[3]).toBeLessThan(0);
    expect(field.captured.every((value) => value === 0)).toBe(true);
    expect(Array.from(field.velocities).every(Number.isFinite)).toBe(true);
  });

  it("viewportとreduced-motionから粒子数を段階的に選ぶ", () => {
    expect(calculateParticleCount({ width: 1440, height: 700, pixelRatio: 1, hardwareConcurrency: 8 })).toBeGreaterThanOrEqual(900);
    expect(calculateParticleCount({ width: 390, height: 620, pixelRatio: 2, hardwareConcurrency: 6 })).toBeGreaterThanOrEqual(450);
    expect(calculateParticleCount({ width: 390, height: 620, pixelRatio: 3, hardwareConcurrency: 2, reducedMotion: true })).toBeLessThanOrEqual(500);
  });

  it("ポインター座標をワールド座標へクランプする", () => {
    expect(
      normalizedPointerToWorld(
        { clientX: 0, clientY: 0, left: 10, top: 20, width: 100, height: 100 },
        DEFAULT_PARTICLE_BOUNDS,
      ),
    ).toEqual({ x: -4.23, y: 2.7, z: 0 });
  });
});
