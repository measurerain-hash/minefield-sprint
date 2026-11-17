"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Engine = require("../js/engine.js");

const cell = (x, y) => x + "," + y;

function make(opts) {
    return Engine.createGame(
        Object.assign({ cols: 5, rows: 5, seed: 7, bots: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }, opts),
    );
}

test("the layout is deterministic for a seed and differs across seeds", () => {
    const g1 = make({ seed: 42 });
    const g2 = make({ seed: 42 });
    const g3 = make({ seed: 43 });
    assert.deepEqual([...g1.walls].sort(), [...g2.walls].sort());
    assert.deepEqual([...g1.mines].sort(), [...g2.mines].sort());
    assert.notDeepEqual([...g1.walls].sort(), [...g3.walls].sort());
});

test("spawns and the flag are never a wall or a mine", () => {
    const g = make({ seed: 5 });
    for (const b of g.bots) assert.equal(g.walls.has(cell(b.x, b.y)) || g.mines.has(cell(b.x, b.y)), false);
    assert.equal(g.walls.has(cell(g.flag.x, g.flag.y)) || g.mines.has(cell(g.flag.x, g.flag.y)), false);
});

test("legal moves exclude walls and the board edge", () => {
    const g = make();
    g.walls.clear();
    g.mines.clear();
    g.bots[0].x = 1;
    g.bots[0].y = 1;
    g.walls.add(cell(1, 0)); // wall above
    const moves = Engine.legalMoves(g, "a").sort();
    assert.deepEqual(moves, ["down", "left", "right"]);
});

test("a dead bot has no legal moves", () => {
    const g = make();
    g.bots[0].alive = false;
    assert.deepEqual(Engine.legalMoves(g, "a"), []);
});

test("two bots aiming at the same cell both stay put", () => {
    const g = make();
    g.walls.clear();
    g.mines.clear();
    g.bots[0].x = 1;
    g.bots[0].y = 1;
    g.bots[1].x = 3;
    g.bots[1].y = 1;
    const ev = Engine.applyMoves(g, { a: "right", b: "left" });
    assert.equal(g.bots[0].x, 1);
    assert.equal(g.bots[1].x, 3);
    assert.ok(ev.every((e) => e.result === "collision"));
});

test("a bot that steps on a mine dies and does not move", () => {
    const g = make();
    g.walls.clear();
    g.mines.clear();
    g.bots[0].x = 1;
    g.bots[0].y = 1;
    g.mines.add(cell(2, 1));
    const ev = Engine.applyMoves(g, { a: "right", b: "down" });
    assert.equal(g.bots[0].alive, false);
    assert.equal(g.bots[0].x, 1);
    assert.equal(ev.find((e) => e.bot === "A").result, "mine");
});

test("reaching the flag wins the game and stops further turns", () => {
    const g = make();
    g.walls.clear();
    g.mines.clear();
    g.bots[0].x = 3;
    g.bots[0].y = 3;
    g.flag.x = 3;
    g.flag.y = 4;
    Engine.applyMoves(g, { a: "down", b: "up" });
    assert.equal(g.winner, "a");
    assert.equal(Engine.isOver(g), true);
    assert.deepEqual(Engine.applyMoves(g, { a: "left" }), []);
});

test("the game is over when no bot is alive", () => {
    const g = make();
    g.bots[0].alive = false;
    g.bots[1].alive = false;
    assert.equal(Engine.isOver(g), true);
});