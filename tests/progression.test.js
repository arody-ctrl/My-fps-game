import { describe, expect, it } from "vitest";

import GameCore from "../src/game-core.js";

const {
  waveEnemyCount,
  waveBonus,
  killScore,
  applyDamage,
  airdropHealth,
  restockReserves,
  createWeapons,
  AIRDROP_SCORE
} = GameCore;

describe("waves", () => {
  it("starts with five enemies and adds two per wave", () => {
    expect(waveEnemyCount(1)).toBe(5);
    expect(waveEnemyCount(2)).toBe(7);
    expect(waveEnemyCount(10)).toBe(23);
  });

  it("scales the clear bonus with the wave number", () => {
    expect(waveBonus(1)).toBe(250);
    expect(waveBonus(8)).toBe(2000);
  });
});

describe("killScore", () => {
  it("awards the base score for a close kill", () => {
    expect(killScore("AR", 10)).toBe(100);
  });

  it("awards more for a sniper kill", () => {
    expect(killScore("SNIPER", 10)).toBe(250);
  });

  it("adds a long shot bonus beyond 75 units", () => {
    expect(killScore("AR", 76)).toBe(200);
    expect(killScore("SNIPER", 200)).toBe(350);
  });

  it("does not pay the long shot bonus exactly at the threshold", () => {
    expect(killScore("AR", 75)).toBe(100);
  });
});

describe("applyDamage", () => {
  it("subtracts the damage from the current health", () => {
    expect(applyDamage(100, 35)).toBe(65);
  });

  it("clamps health at zero", () => {
    expect(applyDamage(3, 40)).toBe(0);
  });

  it("leaves health unchanged for zero damage", () => {
    expect(applyDamage(42, 0)).toBe(42);
  });
});

describe("airdrop pickup", () => {
  it("heals the player without exceeding full health", () => {
    expect(airdropHealth(40, 25)).toBe(65);
    expect(airdropHealth(90, 50)).toBe(100);
  });

  it("is worth a fixed score bonus", () => {
    expect(AIRDROP_SCORE).toBe(500);
  });

  it("restocks every weapon reserve by half a magazine at minimum", () => {
    const weapons = createWeapons();

    restockReserves(weapons, () => 0);

    expect(weapons.AR.reserve).toBe(120 + 15);
    expect(weapons.SNIPER.reserve).toBe(30 + 3);
  });

  it("restocks at most a full magazine", () => {
    const weapons = createWeapons();

    restockReserves(weapons, () => 1);

    expect(weapons.SMG.reserve).toBe(175 + 35);
  });

  it("returns the same weapons object it mutated", () => {
    const weapons = createWeapons();

    expect(restockReserves(weapons, () => 0.5)).toBe(weapons);
  });
});
