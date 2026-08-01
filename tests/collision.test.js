import { describe, expect, it } from "vitest";

import GameCore from "../src/game-core.js";

const { circleIntersectsWall, moveWithCollision, randomAirdropPosition } = GameCore;

function wall(x, z, halfWidth, halfDepth) {
  return {
    position: { x, z },
    userData: { halfWidth, halfDepth }
  };
}

/* A 4x4 wall centred on the origin. */
const originWall = [wall(0, 0, 2, 2)];

describe("circleIntersectsWall", () => {
  it("reports no hit when there are no walls", () => {
    expect(circleIntersectsWall([], 0, 0, 5)).toBe(false);
  });

  it("detects a circle whose centre is inside the wall", () => {
    expect(circleIntersectsWall(originWall, 1, 1, 0.5)).toBe(true);
  });

  it("detects a circle overlapping a wall face", () => {
    expect(circleIntersectsWall(originWall, 2.4, 0, 0.5)).toBe(true);
  });

  it("detects a circle overlapping a wall corner", () => {
    expect(circleIntersectsWall(originWall, 2.2, 2.2, 0.5)).toBe(true);
  });

  it("ignores a circle that only touches the surface", () => {
    expect(circleIntersectsWall(originWall, 2.5, 0, 0.5)).toBe(false);
  });

  it("ignores a circle clear of the wall", () => {
    expect(circleIntersectsWall(originWall, 10, 10, 1)).toBe(false);
  });

  it("checks every wall in the list", () => {
    const walls = [wall(-50, -50, 1, 1), wall(30, 30, 5, 5)];

    expect(circleIntersectsWall(walls, 26, 30, 1)).toBe(true);
    expect(circleIntersectsWall(walls, 0, 0, 1)).toBe(false);
  });

  it("uses the wall half extents rather than a fixed size", () => {
    const thin = [wall(0, 0, 20, 0.5)];

    expect(circleIntersectsWall(thin, 15, 0.4, 0.2)).toBe(true);
    expect(circleIntersectsWall(thin, 15, 3, 0.2)).toBe(false);
  });
});

describe("moveWithCollision", () => {
  it("applies the full movement in open space", () => {
    const position = { x: 0, z: 0 };

    moveWithCollision([], position, { x: 3, z: -4 }, 1);

    expect(position).toEqual({ x: 3, z: -4 });
  });

  it("blocks movement into a wall", () => {
    const position = { x: 6, z: 0 };

    moveWithCollision(originWall, position, { x: -4, z: 0 }, 1);

    expect(position).toEqual({ x: 6, z: 0 });
  });

  it("slides along a wall by resolving each axis separately", () => {
    const position = { x: 6, z: 0 };

    moveWithCollision(originWall, position, { x: -4, z: 5 }, 1);

    expect(position).toEqual({ x: 6, z: 5 });
  });

  it("allows movement away from a wall", () => {
    const position = { x: 3.2, z: 0 };

    moveWithCollision(originWall, position, { x: 2, z: 0 }, 1);

    expect(position.x).toBe(5.2);
  });

  it("returns the mutated position", () => {
    const position = { x: 0, z: 0 };

    expect(moveWithCollision([], position, { x: 1, z: 1 }, 1)).toBe(position);
  });

  it("respects the collision radius", () => {
    const narrow = { x: 4, z: 0 };
    const wide = { x: 4, z: 0 };

    moveWithCollision(originWall, narrow, { x: -1.4, z: 0 }, 0.4);
    moveWithCollision(originWall, wide, { x: -1.4, z: 0 }, 1.5);

    expect(narrow.x).toBeCloseTo(2.6);
    expect(wide.x).toBe(4);
  });
});

describe("randomAirdropPosition", () => {
  it("maps the random source onto the playable area", () => {
    const random = () => 0.5;

    expect(randomAirdropPosition([], random)).toEqual({ x: 0, z: 0 });
    expect(randomAirdropPosition([], () => 1)).toEqual({ x: 100, z: 100 });
    expect(randomAirdropPosition([], () => 0)).toEqual({ x: -100, z: -100 });
  });

  it("retries until it finds a spot clear of walls", () => {
    const walls = [wall(100, 100, 10, 10)];
    const values = [1, 1, 0.75, 0.75];
    const random = () => values.shift();

    expect(randomAirdropPosition(walls, random)).toEqual({ x: 50, z: 50 });
  });

  it("falls back to the map centre when every attempt is blocked", () => {
    const walls = [wall(0, 0, 500, 500)];
    let calls = 0;

    const position = randomAirdropPosition(
      walls,
      () => {
        calls += 1;
        return 0.5;
      },
      3
    );

    expect(position).toEqual({ x: 0, z: 0 });
    expect(calls).toBe(6);
  });
});
