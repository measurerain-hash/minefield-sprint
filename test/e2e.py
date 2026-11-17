#!/usr/bin/env python3
"""Headless end-to-end check for Minefield Sprint.

Serves the site from an in-process server on an OS-assigned port, stubs the completion
with non-JSON so the in-code heuristic drives the game, and drives the real UI until a
winner is decided.
"""
import json
import pathlib
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome"


def start_server():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def wait_widget(page, tries=60):
    for _ in range(tries):
        if page.evaluate("!!document.querySelector('polli-connect')"):
            return
        page.wait_for_timeout(150)
    raise AssertionError("polli-connect never appeared")


def main():
    httpd, port = start_server()
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

            page.route(
                "**/v1/chat/completions",
                lambda r: r.fulfill(status=200, content_type="application/json",
                                    body=json.dumps({"choices": [{"message": {"role": "assistant", "content": "not json"}}]})),
            )
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded")
            wait_widget(page)

            assert page.locator("#pilots-list .pilot").count() == 3, "expected 3 pilots"
            painted = page.evaluate(
                """() => { const c=document.getElementById('board');
                    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                    const s=new Set(); for(let i=0;i<d.length;i+=4){ s.add(d[i]+','+d[i+1]+','+d[i+2]); if(s.size>4) return true; } return false; }"""
            )
            assert painted, "board looks blank"

            page.select_option("#speed", "250")
            page.click("#start")
            # wait for the engine to decide a winner
            page.wait_for_function(
                "() => document.getElementById('status').textContent.includes('winner') || "
                "document.getElementById('status').textContent.includes('All pilots')",
                timeout=30000,
            )
            status = page.inner_text("#status")
            turns = page.inner_text("#turn")
            print(f"  PLAY ok — {status!r} · {turns} · log lines={page.locator('#log div').count()}")
            page.screenshot(path=str(ROOT / "images" / "screenshot.png"), full_page=True)
            browser.close()
    finally:
        httpd.shutdown()

    hard = [e for e in errors if "favicon" not in e and "jsdelivr" not in e]
    if hard:
        print("  console errors:", hard)
        return 1
    print("  no page/console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())