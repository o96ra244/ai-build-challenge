import { describe, expect, it } from "vitest";

import {
  calculateProgress,
  clampDialValue,
  createEndTime,
  dialProgressToValue,
  dialValueToAngle,
  dialValueToProgress,
  formatRemainingTime,
  getNextPhase,
  getRemainingMilliseconds,
  minutesToMilliseconds,
  normalizeAngle,
  pointerAngleToDialProgress,
  pointerAngleToDialValue,
  stepDialValue,
  validateMinutes,
} from "./timer";

describe("ダイヤルのクランプとステップ", () => {
  it.each([
    [0, 1, 120, 1],
    [121, 1, 120, 120],
    [0, 1, 60, 1],
    [61, 1, 60, 60],
  ])("%dを範囲%d〜%dへクランプして%dにする", (value, min, max, expected) => {
    expect(clampDialValue(value, min, max)).toBe(expected);
  });

  it.each([
    [25, 1, 1, 120, 26],
    [25, -1, 1, 120, 24],
    [1, -1, 1, 120, 1],
    [120, 1, 1, 120, 120],
    [25, 5, 1, 120, 30],
    [25, -5, 1, 120, 20],
  ])("%dを%+d分動かして%dにする", (value, step, min, max, expected) => {
    expect(stepDialValue(value, step, min, max)).toBe(expected);
  });
});

describe("ダイヤル値と進捗の変換", () => {
  it("最小値を進捗0、最大値を進捗1へ変換する", () => {
    expect(dialValueToProgress(1, 1, 120)).toBe(0);
    expect(dialValueToProgress(120, 1, 120)).toBe(1);
  });

  it("中間値を約0.5へ変換する", () => {
    expect(dialValueToProgress(60, 1, 120)).toBeCloseTo(0.5, 2);
  });

  it("進捗0と1を最小値と最大値へ変換する", () => {
    expect(dialProgressToValue(0, 1, 120)).toBe(1);
    expect(dialProgressToValue(1, 1, 120)).toBe(120);
  });

  it("範囲外の進捗をクランプし、値を整数へ丸める", () => {
    expect(dialProgressToValue(-0.5, 1, 60)).toBe(1);
    expect(dialProgressToValue(1.5, 1, 60)).toBe(60);
    expect(Number.isInteger(dialProgressToValue(0.333, 1, 120))).toBe(true);
  });
});

describe("ダイヤル角度の変換", () => {
  it("円弧の始点・中間・終点を最小・中間・最大へ変換する", () => {
    expect(pointerAngleToDialValue(135, 1, 120)).toBe(1);
    expect(pointerAngleToDialValue(270, 1, 120)).toBe(61);
    expect(pointerAngleToDialValue(405, 1, 120)).toBe(120);
  });

  it("任意の角度を0〜360度へ正規化し有限値を返す", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(Number.isNaN(pointerAngleToDialProgress(Number.NaN))).toBe(false);
  });

  it("下部デッドゾーンの最大側と最小側を近い端へクランプする", () => {
    expect(pointerAngleToDialValue(60, 1, 120)).toBe(120);
    expect(pointerAngleToDialValue(120, 1, 120)).toBe(1);
  });

  it("デッドゾーン内の各側で値が不用意に反転しない", () => {
    expect([50, 60, 80].map((angle) => pointerAngleToDialValue(angle, 1, 120))).toEqual([
      120,
      120,
      120,
    ]);
    expect([100, 120, 130].map((angle) => pointerAngleToDialValue(angle, 1, 120))).toEqual([
      1,
      1,
      1,
    ]);
  });

  it("値を270度の表示角度へ変換する", () => {
    expect(dialValueToAngle(1, 1, 120)).toBe(135);
    expect(dialValueToAngle(120, 1, 120)).toBe(405);
  });
});

describe("validateMinutes", () => {
  it.each([
    ["1", true],
    ["120", true],
    ["0", false],
    ["-1", false],
    ["121", false],
    ["1.5", false],
    ["", false],
    ["abc", false],
    ["1e2", false],
    ["Infinity", false],
  ])("作業時間 %j を1〜120分の整数として検証する", (value, expected) => {
    expect(validateMinutes(value, "作業時間", 120).valid).toBe(expected);
  });

  it.each([
    ["1", true],
    ["60", true],
    ["0", false],
    ["61", false],
    ["1.5", false],
    ["", false],
    ["休憩", false],
  ])("休憩時間 %j を1〜60分の整数として検証する", (value, expected) => {
    expect(validateMinutes(value, "休憩時間", 60).valid).toBe(expected);
  });

  it("空欄と小数の理由を具体的に返す", () => {
    expect(validateMinutes("", "作業時間", 120)).toEqual({
      valid: false,
      error: "作業時間を入力してください。",
    });
    expect(validateMinutes("1.5", "休憩時間", 60)).toEqual({
      valid: false,
      error: "休憩時間は小数ではなく1〜60の整数で入力してください。",
    });
  });
});
describe("終了予定時刻との差分", () => {
  it("終了前は現在時刻との差分を返す", () => {
    expect(getRemainingMilliseconds(10_000, 4_000)).toBe(6_000);
  });

  it("終了予定時刻と同値なら0を返す", () => {
    expect(getRemainingMilliseconds(10_000, 10_000)).toBe(0);
  });

  it("終了予定時刻を過ぎても0未満にしない", () => {
    expect(getRemainingMilliseconds(10_000, 12_000)).toBe(0);
  });

  it("背景タブで複数分更新されなくても実時間の差分を返す", () => {
    const endTime = createEndTime(1_000, minutesToMilliseconds(25));
    expect(getRemainingMilliseconds(endTime, 1_000 + minutesToMilliseconds(7) + 12_000)).toBe(
      minutesToMilliseconds(17) + 48_000,
    );
  });

  it("大きな遅延が終了時刻を越えた場合は0を返す", () => {
    expect(getRemainingMilliseconds(61_000, 3_661_000)).toBe(0);
  });
});

describe("formatRemainingTime", () => {
  it.each([
    [minutesToMilliseconds(25), "25:00"],
    [minutesToMilliseconds(5), "05:00"],
    [minutesToMilliseconds(120), "120:00"],
    [61_000, "01:01"],
    [1_000, "00:01"],
    [1, "00:01"],
    [0, "00:00"],
    [-1_000, "00:00"],
  ])("残り %dms を %s と表示する", (milliseconds, expected) => {
    expect(formatRemainingTime(milliseconds)).toBe(expected);
  });
});

describe("一時停止と再開の計算", () => {
  it("現在時刻と残り時間から新しい終了予定時刻を作る", () => {
    expect(createEndTime(50_000, 12_345)).toBe(62_345);
  });

  it("一時停止前の残り時間を再開時に維持する", () => {
    const pausedRemaining = getRemainingMilliseconds(90_000, 75_000);
    const resumedEndTime = createEndTime(200_000, pausedRemaining);
    expect(getRemainingMilliseconds(resumedEndTime, 200_000)).toBe(15_000);
  });

  it("更新間隔ではなく時刻差分だけで残り時間を求める", () => {
    const endTime = createEndTime(0, 60_000);
    expect(getRemainingMilliseconds(endTime, 47_321)).toBe(12_679);
  });
});

describe("calculateProgress", () => {
  it.each([
    [60_000, 60_000, 0],
    [60_000, 30_000, 50],
    [60_000, 0, 100],
    [60_000, 90_000, 0],
    [60_000, -10_000, 100],
    [0, 0, 0],
  ])("総時間 %dms・残り %dms の進捗を %d%% にする", (total, remaining, expected) => {
    expect(calculateProgress(total, remaining)).toBe(expected);
  });

  it("異常な総時間でも有限値を返す", () => {
    expect(Number.isFinite(calculateProgress(Number.POSITIVE_INFINITY, 1))).toBe(true);
    expect(Number.isNaN(calculateProgress(0, 0))).toBe(false);
  });
});

describe("getNextPhase", () => {
  it("作業の次は休憩にする", () => {
    expect(getNextPhase("work")).toBe("break");
  });

  it("休憩の次は作業にする", () => {
    expect(getNextPhase("break")).toBe("work");
  });
});
