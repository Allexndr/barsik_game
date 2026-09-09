import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765"
SCREENSHOT_DIR = Path("/tmp/barsik-playtest")


def run_case(playwright, name, path, mobile=False):
    # Each level owns a WebGL context. Reusing one Chromium process for the
    # whole 17-level sweep makes Chromium retain several renderer contexts and
    # produces false negatives (the page main thread stops answering even
    # though the same level is healthy in a fresh browser). A fresh browser is
    # slower, but makes this smoke test deterministic and closer to a real
    # first-load session.
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 720})
    page = context.new_page()
    page.set_default_timeout(5000)
    console_errors = []
    page_errors = []
    failed_requests = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))
    screenshot = SCREENSHOT_DIR / f"{name}.png"
    try:
        response = page.goto(BASE_URL + path, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)
        body_text = page.evaluate("document.body ? document.body.innerText : ''")
        buttons = page.get_by_role("button").all_inner_texts()
        page.screenshot(
            path=str(screenshot),
            full_page=False,
            animations="disabled",
            timeout=15000,
        )
        result = {
            "name": name,
            "path": path,
            "mobile": mobile,
            "status": response.status if response else None,
            "title": page.evaluate("document.title"),
            "has_canvas": page.evaluate("document.querySelector('canvas') !== null"),
            "buttons": buttons[:20],
            "body_excerpt": " ".join(body_text.split())[:500],
            "console_errors": console_errors[:20],
            "page_errors": page_errors[:20],
            "failed_requests": failed_requests[:20],
            "screenshot": str(screenshot),
        }
    except Exception as error:
        result = {
            "name": name,
            "path": path,
            "mobile": mobile,
            "status": None,
            "error": str(error),
            "console_errors": console_errors[:20],
            "page_errors": page_errors[:20],
            "failed_requests": failed_requests[:20],
        }
    context.close()
    browser.close()
    return result


def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        cases = [
            run_case(playwright, "welcome-desktop", "/"),
            run_case(playwright, "welcome-mobile", "/", mobile=True),
            run_case(playwright, "mission0-mobile", "/?mission=0&lang=ru", mobile=True),
            run_case(playwright, "hub-desktop", "/?hub=1&lang=ru"),
        ]
        for level_id in range(17):
            result = run_case(playwright, f"mission-{level_id:02d}", f"/?mission={level_id}&lang=ru")
            cases.append(result)
            print(json.dumps(result, ensure_ascii=False), flush=True)
        result = run_case(playwright, "mission-01-kazakh", "/?mission=1&lang=kk")
        cases.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    print(json.dumps(cases, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
