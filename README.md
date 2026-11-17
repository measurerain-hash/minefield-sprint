# Minefield Sprint

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

Language models pilot bots across a grid of walls and mines to the flag. It is a game the
models play: each turn every live pilot is shown the board and the exact set of moves the
engine allows, and returns one of them. The engine decides everything else — movement,
collisions, mine strikes, the winner.

**Live:** https://measurerain-hash.github.io/minefield-sprint/

## How a model plays

1. The engine (`js/engine.js`) generates the board from a seed and, each turn, computes the
   legal moves for every live bot: in-bounds and not into a wall.
2. For each pilot the page sends one chat completion to `gen.pollinations.ai` containing the
   board as text, the flag position, and that legal-move list. The pilot must answer with
   `{"move":"left|right|up|down","reason":"…"}`.
3. The reply is validated in code. An illegal or malformed move is discarded and a
   deterministic in-code heuristic (shortest safe path to the flag) is used instead — a
   hallway model slows the race down, it never stalls it.
4. The engine resolves the turn: walls block, two bots aiming at the same cell both stay,
   a mine destroys, and reaching the flag wins. The verdict is computed in code.

So the models are the players and the code is the referee.

## What is measured in code (not in the model)

`test/engine.test.js` and `test/ai.test.js` pin the rules down:

- layout is deterministic for a seed and differs across seeds; spawns and the flag are never
  a wall or a mine;
- legal moves exclude walls and the board edge; a dead bot has none;
- simultaneous collisions make both bots stay;
- a mine destroys and does not move the bot;
- reaching the flag wins and ends the game; the game is over with no bots alive;
- the heuristic moves toward the flag and avoids a visible mine even when it is shorter.

```bash
node --test test/engine.test.js test/ai.test.js
```

## Bring your own Pollen

The visitor approves a scoped key with the official `<polli-connect>` widget, so every model
call bills their own Pollen and no key is pasted into the page. Without a key the game still
runs on the in-code heuristic, so the board is always playable. See
[BRING_YOUR_OWN_POLLEN.md](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md).

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Static site, no build step. Default pilot model: `deepseek/deepseek-v4-flash` with
`reasoning_effort: "none"`.