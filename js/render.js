/**
 * render.js — draw the board on a canvas. Reads engine state only, writes nothing.
 */
(function (root) {
    const COLORS = ["#4dd0a7", "#6aa8ff", "#f2b356", "#e06c9f"];

    function draw(canvas, state) {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 560;
        const cssH = canvas.clientHeight || 560;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const pad = 10;
        const cell = Math.floor(Math.min(cssW - pad * 2, cssH - pad * 2) / state.cols);
        const ox = (cssW - cell * state.cols) / 2;
        const oy = (cssH - cell * state.rows) / 2;

        for (let y = 0; y < state.rows; y++) {
            for (let x = 0; x < state.cols; x++) {
                const px = ox + x * cell;
                const py = oy + y * cell;
                const k = x + "," + y;
                // base
                ctx.fillStyle = "#0f161d";
                ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
                ctx.strokeStyle = "#1c2733";
                ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);

                if (state.walls.has(k)) {
                    ctx.fillStyle = "#2b3b4c";
                    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
                } else if (state.mines.has(k)) {
                    ctx.fillStyle = "#e0603c";
                    ctx.beginPath();
                    ctx.arc(px + cell / 2, py + cell / 2, cell * 0.16, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // flag
        const fx = ox + state.flag.x * cell;
        const fy = oy + state.flag.y * cell;
        ctx.fillStyle = "#f2d356";
        ctx.beginPath();
        ctx.moveTo(fx + cell * 0.32, fy + cell * 0.2);
        ctx.lineTo(fx + cell * 0.32, fy + cell * 0.82);
        ctx.lineTo(fx + cell * 0.78, fy + cell * 0.5);
        ctx.closePath();
        ctx.fill();

        // bots
        state.bots.forEach((b, i) => {
            if (!b.alive) return;
            const cx = ox + b.x * cell + cell / 2;
            const cy = oy + b.y * cell + cell / 2;
            ctx.fillStyle = COLORS[i % COLORS.length];
            ctx.beginPath();
            ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#042019";
            ctx.font = "bold " + Math.floor(cell * 0.34) + "px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(b.name.slice(0, 2).toUpperCase(), cx, cy + 1);
        });
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
    }

    root.Render = { draw, COLORS };
})(typeof self !== "undefined" ? self : globalThis);