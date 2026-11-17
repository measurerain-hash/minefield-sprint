"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");

// ai.js expects PolliClient on the global for its parse path only.
globalThis.PolliClient = {
    extractJson(t) {
        const s = t.indexOf("{");
        const e = t.lastIndexOf("}");
        return t.slice(s, e + 1);
    },
};

const Engine = require("../js/engine.js");
globalThis.Engine = Engine;
require("../js/ai.js");
const Ai = globalThis.Ai;

function game() {
    const g = Engine.createGame({ cols: 5, rows: 5, seed: 3, bots: [{ id: "a", name: "A" }] });
    g.walls.clear();
    g.mines.clear();
    g.bots[0].x = 1;
    g.bots[0].y = 1;
    g.flag.x = 4;
    g.flag.y = 4;
    return g;
}

test("parse accepts a legal move and rejects an illegal one", () => {
    assert.deepEqual(Ai.parse('{"move":"right","reason":"closer"}', ["left", "right"]), {
        move: "right",
        reason: "closer",
    });
    assert.equal(Ai.parse('{"move":"up"}', ["left", "right"]), null);
    assert.equal(Ai.parse("not json", ["left", "right"]), null);
});

test("the heuristic moves toward the flag", () => {
    const g = game();
    const legal = Engine.legalMoves(g, "a").sort();
    const picked = Ai.heuristic(g, "a", legal);
    assert.equal(picked.move, "down"); // (1,1) -> flag (4,4): both right and down reduce it; first wins ties
});

test("the heuristic avoids a mine even when it is shorter", () => {
    const g = game();
    g.mines.add("2,1"); // right is a mine, down is safe
    const legal = Engine.legalMoves(g, "a").sort();
    const picked = Ai.heuristic(g, "a", legal);
    assert.notEqual(picked.move, "right");
});