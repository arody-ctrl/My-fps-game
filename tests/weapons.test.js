import { beforeEach, describe, expect, it } from "vitest";

import GameCore from "../src/game-core.js";

const {
  createWeapons,
  reloadWeapon,
  canFire,
  adsView,
  adsStatusText,
  applyUpgrades,
  upgradeTypes,
  MAX_UPGRADES
} = GameCore;

describe("createWeapons", () => {
  it("provides the four playable weapons", () => {
    expect(Object.keys(createWeapons())).toEqual(["AR", "SMG", "PISTOL", "SNIPER"]);
  });

  it("returns an independent copy on every call", () => {
    const first = createWeapons();
    const second = createWeapons();

    first.AR.ammo = 0;

    expect(second.AR.ammo).toBe(30);
  });

  it("starts every weapon with a full magazine", () => {
    const weapons = createWeapons();

    for (const weapon of Object.values(weapons)) {
      expect(weapon.ammo).toBe(weapon.magazineSize);
    }
  });

  it("gives the sniper no spread and the tightest ADS field of view", () => {
    const weapons = createWeapons();

    expect(weapons.SNIPER.spread).toBe(0);
    expect(weapons.SNIPER.adsFOV).toBeLessThan(weapons.AR.adsFOV);
  });
});

describe("reloadWeapon", () => {
  it("tops up the magazine from the reserve", () => {
    const weapon = { magazineSize: 30, ammo: 10, reserve: 120 };

    expect(reloadWeapon(weapon)).toBe(20);
    expect(weapon).toMatchObject({ ammo: 30, reserve: 100 });
  });

  it("does nothing when the magazine is already full", () => {
    const weapon = { magazineSize: 30, ammo: 30, reserve: 120 };

    expect(reloadWeapon(weapon)).toBe(0);
    expect(weapon.reserve).toBe(120);
  });

  it("does nothing when the reserve is empty", () => {
    const weapon = { magazineSize: 30, ammo: 1, reserve: 0 };

    expect(reloadWeapon(weapon)).toBe(0);
    expect(weapon.ammo).toBe(1);
  });

  it("uses the remaining reserve for a partial reload", () => {
    const weapon = { magazineSize: 30, ammo: 5, reserve: 7 };

    expect(reloadWeapon(weapon)).toBe(7);
    expect(weapon).toMatchObject({ ammo: 12, reserve: 0 });
  });

  it("never overfills a magazine enlarged by an upgrade", () => {
    const weapon = { magazineSize: 38, ammo: 38, reserve: 50 };

    reloadWeapon(weapon);

    expect(weapon.ammo).toBe(38);
  });
});

describe("canFire", () => {
  const ar = { fireRate: 120, ammo: 30 };
  const sniper = { fireRate: 1100, ammo: 5 };

  it("allows a shot once the fire rate delay has elapsed", () => {
    expect(canFire(ar, "AR", 1000, 880, false)).toBe(true);
  });

  it("blocks a shot fired faster than the fire rate", () => {
    expect(canFire(ar, "AR", 1000, 900, false)).toBe(false);
  });

  it("blocks a shot with an empty magazine", () => {
    expect(canFire({ ...ar, ammo: 0 }, "AR", 5000, 0, false)).toBe(false);
  });

  it("requires the sniper to be scoped", () => {
    expect(canFire(sniper, "SNIPER", 5000, 0, false)).toBe(false);
    expect(canFire(sniper, "SNIPER", 5000, 0, true)).toBe(true);
  });

  it("does not require other weapons to be scoped", () => {
    expect(canFire(ar, "AR", 5000, 0, false)).toBe(true);
  });
});

describe("adsView", () => {
  const weapons = createWeapons();

  it("zooms in and keeps the crosshair for hip fire weapons", () => {
    expect(adsView(weapons.AR, "AR", true)).toEqual({
      fov: 55,
      scopeOverlay: false,
      crosshair: true,
      physicalScope: true
    });
  });

  it("restores the normal field of view when leaving ADS", () => {
    expect(adsView(weapons.AR, "AR", false).fov).toBe(75);
  });

  it("swaps the crosshair for the scope overlay when the sniper is scoped", () => {
    expect(adsView(weapons.SNIPER, "SNIPER", true)).toEqual({
      fov: 18,
      scopeOverlay: true,
      crosshair: false,
      physicalScope: false
    });
  });

  it("hides the scope overlay again when the sniper leaves ADS", () => {
    expect(adsView(weapons.SNIPER, "SNIPER", false)).toEqual({
      fov: 75,
      scopeOverlay: false,
      crosshair: true,
      physicalScope: true
    });
  });
});

describe("adsStatusText", () => {
  it("reports hip fire regardless of weapon", () => {
    expect(adsStatusText("SNIPER", false)).toBe("HIP FIRE");
    expect(adsStatusText("AR", false)).toBe("HIP FIRE");
  });

  it("reports the scoped state for the sniper", () => {
    expect(adsStatusText("SNIPER", true)).toBe("SCOPED • 1 SHOT");
  });

  it("reports iron sights for other weapons", () => {
    expect(adsStatusText("SMG", true)).toBe("IRON SIGHTS / ADS");
  });
});

describe("applyUpgrades", () => {
  let weapon;

  beforeEach(() => {
    weapon = createWeapons().AR;
  });

  /* Always picks the first still available upgrade. */
  const firstAvailable = () => 0;

  it("records the applied upgrade on the weapon", () => {
    const applied = applyUpgrades(weapon, 1, firstAvailable);

    expect(applied).toEqual(["DAMAGE +20%"]);
    expect(weapon.upgrades).toEqual(["damage"]);
    expect(weapon.damage).toBe(30);
  });

  it("never applies the same upgrade twice in one drop", () => {
    const applied = applyUpgrades(weapon, 3, firstAvailable);

    expect(applied).toEqual(["DAMAGE +20%", "FIRE RATE +15%", "MAGAZINE +25%"]);
    expect(new Set(weapon.upgrades).size).toBe(3);
  });

  it("caps a weapon at MAX_UPGRADES", () => {
    applyUpgrades(weapon, 6, firstAvailable);

    expect(weapon.upgrades).toHaveLength(MAX_UPGRADES);
  });

  it("keeps the cap across several airdrops", () => {
    applyUpgrades(weapon, 3, firstAvailable);
    const applied = applyUpgrades(weapon, 3, firstAvailable);

    expect(weapon.upgrades).toHaveLength(MAX_UPGRADES);
    expect(applied).toHaveLength(1);
  });

  it("stops early when every upgrade type has been drawn", () => {
    const applied = applyUpgrades({ damage: 1, fireRate: 100 }, 99, firstAvailable);

    expect(applied).toHaveLength(Math.min(MAX_UPGRADES, upgradeTypes.length));
  });

  it("leaves the shared upgrade list untouched", () => {
    applyUpgrades(weapon, 6, firstAvailable);

    expect(upgradeTypes).toHaveLength(6);
  });
});

describe("upgrade effects", () => {
  const byType = (type) => upgradeTypes.find((upgrade) => upgrade.type === type);

  it("raises damage by 20% rounded", () => {
    const weapon = { damage: 25 };

    byType("damage").apply(weapon);

    expect(weapon.damage).toBe(30);
  });

  it("shortens the fire rate delay but not below the floor", () => {
    const weapon = { fireRate: 120 };

    byType("fireRate").apply(weapon);
    expect(weapon.fireRate).toBe(102);

    weapon.fireRate = 36;
    byType("fireRate").apply(weapon);
    expect(weapon.fireRate).toBe(35);
  });

  it("adds the extra magazine capacity to the loaded ammo", () => {
    const weapon = { magazineSize: 30, ammo: 12 };

    byType("magazine").apply(weapon);

    expect(weapon).toEqual({ magazineSize: 38, ammo: 20 });
  });

  it("increases the reserve by half", () => {
    const weapon = { reserve: 121 };

    byType("reserve").apply(weapon);

    expect(weapon.reserve).toBe(182);
  });

  it("speeds up projectiles and tightens spread", () => {
    const weapon = { projectileSpeed: 100, spread: 0.01 };

    byType("speed").apply(weapon);
    byType("accuracy").apply(weapon);

    expect(weapon.projectileSpeed).toBe(125);
    expect(weapon.spread).toBeCloseTo(0.007);
  });
});
