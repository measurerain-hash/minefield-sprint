/**
 * ai.js — the only place a model is consulted.
 *
 * A pilot is shown the board, the goal and the exact set of legal moves the engine
 * produced, and must reply with one of them. The reply is validated in code; when it is
 * missing or illegal, a deterministic in-code heuristic chooses instead, so a bad model
 * reply slows the game down, it never stalls or breaks it.
 */
(function (root) {
    function systemPrompt() {
        return [
            "You pilot one bot in a grid game. You race other bots to the flag F.",
            "Moves: up, down, left, right. # is a wall (blocked), * is a mine (fatal), . is open.",
            "If two bots step into the same cell, both stay put, so avoid aiming at a bot you can see.",
            "Reply with ONE JSON object and nothing else:",
            '{"move": "up|down|left|right", "reason": "one short sentence"}',
            "Pick only from the list of legal moves you are given.",
        ].join("\n");
    }

    function userPrompt(state, botId, legal) {
        const bot = state.bots.find((b) => b.id === botId);
        return [
            "Board:",
            Engine.describe(state, botId),
            "",
            "You are P at (" + bot.x + "," + bot.y + "). Flag F at (" + state.flag.x + "," + state.flag.y + ").",
            "Legal moves: " + legal.join(", "),
            "Your step count so far: " + bot.steps + ".",
        ].join("\n");
    }

    /** Manhattan-distance heuristic that also dodges visible mines. */
    function heuristic(state, botId, legal) {
        const bot = state.bots.find((b) => b.id === botId);
        if (!legal.length) return { move: null, reason: "no legal move" };
        let best = legal[0];
        let bestScore = Infinity;
        for (const m of legal) {
            const [dx, dy] = Engine.DIRS[m];
            const nx = bot.x + dx;
            const ny = bot.y + dy;
            const minePenalty = state.mines.has(nx + "," + ny) ? 1000 : 0;
            // Aiming at a cell another live bot already stands on risks a head-on
            // collision (both stay), so treat it as expensive but not fatal.
            const occupied = Engine.aliveBots(state).some((o) => o.id !== bot.id && o.x === nx && o.y === ny);
            const dist = Math.abs(nx - state.flag.x) + Math.abs(ny - state.flag.y);
            const score = dist + minePenalty + (occupied ? 500 : 0);
            if (score < bestScore) {
                bestScore = score;
                best = m;
            }
        }
        return { move: best, reason: "engine fallback: shortest safe path to the flag" };
    }

    function parse(text, legal) {
        try {
            const obj = JSON.parse(root.PolliClient.extractJson(text));
            const mv = String(obj.move || "").trim().toLowerCase();
            if (legal.includes(mv)) return { move: mv, reason: String(obj.reason || "").slice(0, 140) };
        } catch (_err) {
            /* fall through to heuristic */
        }
        return null;
    }

    async function chooseMove(state, botId, legal, opts) {
        if (root.PolliClient && opts && opts.apiKey) {
            try {
                const reply = await root.PolliClient.chatCompletion(
                    [
                        { role: "system", content: systemPrompt() },
                        { role: "user", content: userPrompt(state, botId, legal) },
                    ],
                    { apiKey: opts.apiKey, model: opts.model, maxTokens: 300, reasoningEffort: "none" },
                );
                const picked = parse(reply, legal);
                if (picked) return picked;
            } catch (_err) {
                /* network/model failure -> heuristic */
            }
        }
        return heuristic(state, botId, legal);
    }

    root.Ai = { systemPrompt, userPrompt, heuristic, parse, chooseMove };
})(typeof self !== "undefined" ? self : globalThis);