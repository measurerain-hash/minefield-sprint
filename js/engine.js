/**
 * engine.js — the game itself. Pure, deterministic, no network, no DOM.
 *
 * Every rule that decides the outcome lives here and is unit-tested in
 * test/engine.test.js: layout generation from a seed, legal-move generation,
 * simultaneous resolution (walls, collisions, mines), and the win condition.
 * The models only ever pick from the moves this file returns.
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.Engine = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0;
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const key = (x, y) => x + "," + y;
    const spawns = (cols, rows) => [
        [0, 0],
        [cols - 1, 0],
        [0, rows - 1],
        [cols - 1, rows - 1],
    ];

    function createGame(opts) {
        const cols = opts.cols || 7;
        const rows = opts.rows || 7;
        const seed = opts.seed >>> 0;
        const rand = mulberry32(seed);
        const bots = (opts.bots || []).slice(0, 4);
        const flag = { x: (cols - 1) >> 1, y: (rows - 1) >> 1 };

        const reserved = new Set([key(flag.x, flag.y)]);
        const starts = spawns(cols, rows);
        bots.forEach((b, i) => reserved.add(key(starts[i][0], starts[i][1])));

        const walls = new Set();
        const mines = new Set();
        const freeCells = [];
        for (let y = 0; y < rows; y++)
            for (let x = 0; x < cols; x++)
                if (!reserved.has(key(x, y))) freeCells.push([x, y]);

        // deterministic shuffle
        for (let i = freeCells.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [freeCells[i], freeCells[j]] = [freeCells[j], freeCells[i]];
        }
        const nWalls = opts.walls != null ? opts.walls : Math.round(cols * rows * 0.14);
        const nMines = opts.mines != null ? opts.mines : Math.round(cols * rows * 0.12);
        let idx = 0;
        for (; idx < nWalls && idx < freeCells.length; idx++)
            walls.add(key(freeCells[idx][0], freeCells[idx][1]));
        for (; idx < nWalls + nMines && idx < freeCells.length; idx++)
            mines.add(key(freeCells[idx][0], freeCells[idx][1]));

        return {
            cols,
            rows,
            seed,
            flag,
            walls,
            mines,
            turn: 0,
            winner: null,
            bots: bots.map((b, i) => ({
                id: b.id,
                name: b.name,
                model: b.model,
                x: starts[i][0],
                y: starts[i][1],
                alive: true,
                steps: 0,
                lastReason: "",
            })),
            log: [],
        };
    }

    function inside(state, x, y) {
        return x >= 0 && y >= 0 && x < state.cols && y < state.rows;
    }
    function isWall(state, x, y) {
        return state.walls.has(key(x, y));
    }
    function isMine(state, x, y) {
        return state.mines.has(key(x, y));
    }
    function botAt(state, x, y) {
        return state.bots.find((b) => b.alive && b.x === x && b.y === y) || null;
    }

    /** Moves a live bot may legally choose: in-bounds and not into a wall. */
    function legalMoves(state, botId) {
        const b = state.bots.find((x) => x.id === botId);
        if (!b || !b.alive) return [];
        const out = [];
        for (const dir of Object.keys(DIRS)) {
            const [dx, dy] = DIRS[dir];
            const nx = b.x + dx;
            const ny = b.y + dy;
            if (inside(state, nx, ny) && !isWall(state, nx, ny)) out.push(dir);
        }
        return out;
    }

    /**
     * Resolve one turn from a map of { botId: "up"|"down"|"left"|"right" }.
     * Mutates state, appends to state.log, returns the entries for this turn.
     */
    function applyMoves(state, moves) {
        if (state.winner) return [];
        const events = [];
        const targets = {};

        for (const b of state.bots) {
            if (!b.alive) continue;
            const dir = moves[b.id];
            if (!DIRS[dir]) {
                targets[b.id] = { x: b.x, y: b.y, blocked: "no-move" };
                continue;
            }
            const [dx, dy] = DIRS[dir];
            const nx = b.x + dx;
            const ny = b.y + dy;
            if (!inside(state, nx, ny) || isWall(state, nx, ny))
                targets[b.id] = { x: b.x, y: b.y, blocked: "wall" };
            else targets[b.id] = { x: nx, y: ny, blocked: null };
        }

        // collision: two or more bots aiming at the same cell both stay put
        const counts = {};
        for (const id of Object.keys(targets)) {
            const t = targets[id];
            const k = key(t.x, t.y);
            counts[k] = (counts[k] || 0) + 1;
        }
        for (const id of Object.keys(targets)) {
            const t = targets[id];
            if (!t.blocked && counts[key(t.x, t.y)] > 1) t.blocked = "collision";
        }

        for (const b of state.bots) {
            if (!b.alive) continue;
            const t = targets[b.id];
            if (!t || t.blocked) {
                events.push({ bot: b.name, move: moves[b.id] || "—", result: t ? t.blocked : "no-move" });
                continue;
            }
            if (isMine(state, t.x, t.y)) {
                b.alive = false;
                events.push({ bot: b.name, move: moves[b.id], result: "mine" });
                continue;
            }
            b.x = t.x;
            b.y = t.y;
            b.steps++;
            events.push({ bot: b.name, move: moves[b.id], result: "moved" });
        }

        const onFlag = state.bots.find((b) => b.alive && b.x === state.flag.x && b.y === state.flag.y);
        if (onFlag) state.winner = onFlag.id;
        state.turn++;
        state.log.push({ turn: state.turn, events });
        return events;
    }

    function aliveBots(state) {
        return state.bots.filter((b) => b.alive);
    }

    function isOver(state) {
        return state.winner !== null || aliveBots(state).length === 0;
    }

    /** A compact text view of the board for a model's prompt. */
    function describe(state, botId) {
        const b = state.bots.find((x) => x.id === botId);
        const rows = [];
        for (let y = 0; y < state.rows; y++) {
            let line = "";
            for (let x = 0; x < state.cols; x++) {
                if (b.x === x && b.y === y) line += "P";
                else if (state.flag.x === x && state.flag.y === y) line += "F";
                else if (isWall(state, x, y)) line += "#";
                else if (isMine(state, x, y)) line += "*";
                else line += ".";
            }
            rows.push(line);
        }
        return rows.join("\n");
    }

    return { createGame, legalMoves, applyMoves, isOver, aliveBots, describe, DIRS };
});