/**
 * app.js — wire the engine, the model pilots and the board together.
 *
 * The engine owns every rule; each turn, every live pilot is asked for one of the moves
 * the engine allows. The loop is owner-driven (Start / Step / New game), so nothing runs
 * up a key without the visitor pressing start.
 */
(function () {
    const el = (id) => document.getElementById(id);
    const canvas = el("board");
    const widget = document.querySelector("polli-connect");
    const PILOTS = [
        { id: "p1", name: "Maverick" },
        { id: "p2", name: "Cautious" },
        { id: "p3", name: "Bolt" },
        { id: "p4", name: "Nova" },
    ];
    const MODEL = "deepseek/deepseek-v4-flash";

    let state = null;
    let running = false;
    let busy = false;

    function key() {
        return widget && widget.apiKey ? widget.apiKey : null;
    }

    function newGame() {
        const n = Number(el("pilots").value);
        const bots = PILOTS.slice(0, n).map((p) => ({ id: p.id, name: p.name, model: MODEL }));
        state = Engine.createGame({ cols: 7, rows: 7, seed: (Date.now() % 2147483647) >>> 0, bots });
        running = false;
        el("start").textContent = "Start";
        renderAll();
        setStatus(key() ? "Ready — press Start and the models play." : "No key connected: pilots will use the engine's built-in pathfinding.");
    }

    function setStatus(t) {
        el("status").textContent = t || "";
    }

    function renderAll() {
        Render.draw(canvas, state);
        el("turn").textContent = "turn " + state.turn;
        const list = el("pilots-list");
        list.innerHTML = "";
        state.bots.forEach((b, i) => {
            const row = document.createElement("div");
            row.className = "pilot" + (b.alive ? "" : " dead");
            const dot = document.createElement("span");
            dot.className = "pdot";
            dot.style.background = Render.COLORS[i % Render.COLORS.length];
            const name = document.createElement("b");
            name.textContent = b.name + (state.winner === b.id ? " 🏁" : "");
            const meta = document.createElement("span");
            meta.className = "pmeta";
            meta.textContent = (b.alive ? "(" + b.x + "," + b.y + ") · " + b.steps + " steps" : "destroyed");
            const why = document.createElement("div");
            why.className = "pwhy";
            why.textContent = b.lastReason || "";
            row.append(dot, name, meta, why);
            list.appendChild(row);
        });
    }

    function logTurn(events) {
        const box = el("log");
        const line = events.map((e) => e.bot + " " + e.move + "→" + e.result).join(" · ");
        const p = document.createElement("div");
        p.textContent = "T" + state.turn + ": " + line + (state.winner ? "  🏁 " + nameOf(state.winner) + " wins" : "");
        box.prepend(p);
        while (box.childElementCount > 40) box.lastElementChild.remove();
    }

    function nameOf(id) {
        const b = state.bots.find((x) => x.id === id);
        return b ? b.name : id;
    }

    async function turn() {
        if (busy || !state || Engine.isOver(state)) return;
        busy = true;
        const moves = {};
        for (const b of Engine.aliveBots(state)) {
            const legal = Engine.legalMoves(state, b.id);
            if (!legal.length) continue;
            const picked = await Ai.chooseMove(state, b.id, legal, { apiKey: key(), model: MODEL });
            moves[b.id] = picked.move;
            b.lastReason = picked.reason;
            renderAll();
        }
        const events = Engine.applyMoves(state, moves);
        logTurn(events);
        renderAll();
        busy = false;
        if (Engine.isOver(state)) {
            running = false;
            el("start").textContent = "Start";
            if (state.winner) {
                const how = state.decidedBy === "closest" ? "closest to the flag when the turn budget ran out" : "reached the flag";
                setStatus(nameOf(state.winner) + " wins — " + how + ".");
            } else {
                setStatus("All pilots destroyed.");
            }
        }
    }

    async function loop() {
        while (running) {
            await turn();
            await new Promise((r) => setTimeout(r, Number(el("speed").value)));
            if (Engine.isOver(state)) break;
        }
    }

    el("start").addEventListener("click", () => {
        if (!state || Engine.isOver(state)) newGame();
        running = !running;
        el("start").textContent = running ? "Pause" : "Start";
        if (running) {
            setStatus(key() ? "Models are playing." : "Playing with the engine's pathfinding (no key connected).");
            loop();
        }
    });
    el("step").addEventListener("click", () => {
        if (!state || Engine.isOver(state)) newGame();
        turn();
    });
    el("new").addEventListener("click", newGame);
    el("pilots").addEventListener("change", newGame);
    if (widget) widget.addEventListener("change", () => {
        if (key()) setStatus("Key connected — press Start.");
    });

    newGame();
})();