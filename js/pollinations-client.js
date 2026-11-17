/**
 * pollinations-client.js — Pollinations text chat (BYOP).
 *
 * A single completion turns a science topic into a small structured spec (kept flat,
 * so it survives JSON parsing). The visitor approves a scoped key with the official
 * <polli-connect> widget, so every call bills their own Pollen and no secret key is
 * ever pasted into the page.
 *
 * Reference: https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md
 */
(function (root) {
    const API_URL = "https://gen.pollinations.ai/v1/chat/completions";
    const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

    async function chatCompletion(messages, opts) {
        const {
            apiKey,
            model = DEFAULT_MODEL,
            maxTokens = 2200,
            temperature,
            reasoningEffort,
        } = opts || {};
        if (!apiKey) {
            throw new Error(
                "Missing Pollinations key — approve one with the Connect button first.",
            );
        }
        const body = {
            model,
            messages: messages.map((m) => ({
                role: m.role,
                content: String(m.content).slice(0, 12000),
            })),
            max_tokens: maxTokens,
        };
        if (typeof temperature === "number") body.temperature = temperature;
        // Reasoning models spend the output budget thinking before they write;
        // lowering effort is what stops a correct prompt from returning 400.
        if (typeof reasoningEffort === "string")
            body.reasoning_effort = reasoningEffort;

        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + apiKey,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            let detail = "";
            try {
                const j = await res.json();
                detail = (j.error && (j.error.message || j.error)) || "";
            } catch (_err) {
                /* not JSON */
            }
            throw new Error(
                "Pollinations API error " + res.status + (detail ? " — " + detail : ""),
            );
        }
        const data = await res.json();
        const choice = (data.choices && data.choices[0]) || {};
        const text = choice.message && choice.message.content;
        if (text === undefined || text === null || text === "") {
            throw new Error("Pollinations returned an empty reply.");
        }
        return String(text).trim();
    }

    /** Strip a wrapping markdown fence the model may have added around JSON. */
    function stripFence(text) {
        return String(text)
            .replace(/^\s*```(?:json|javascript|js)?\s*\n?/i, "")
            .replace(/\n?```\s*$/, "")
            .trim();
    }

    /** Pull the first balanced {...} object out of a reply that may carry prose. */
    function extractJson(text) {
        const t = stripFence(text);
        const start = t.indexOf("{");
        if (start === -1) throw new Error("The model did not return JSON.");
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < t.length; i++) {
            const ch = t[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (ch === "\\") escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') inString = true;
            else if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) return t.slice(start, i + 1);
            }
        }
        throw new Error("The model returned unbalanced JSON.");
    }

    root.PolliClient = {
        API_URL,
        DEFAULT_MODEL,
        chatCompletion,
        stripFence,
        extractJson,
    };
})(typeof self !== "undefined" ? self : globalThis);