"""Focused post-F1 Login scale and overflow smoke check."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright


def inspect(page):
    return page.evaluate(
        """() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {height: Math.round(rect.height), width: Math.round(rect.width), fontSize: style.fontSize, padding: style.padding, borderRadius: style.borderRadius};
        };
        return {scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, h1: read('h1'), input: read('input'), submit: read('button[type="submit"]'), glow: read('.sgh-animated-border-card')};
      }"""
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    results = []
    for width in (1440, 375):
        for theme in ("light", "dark"):
            context = browser.new_context(viewport={"width": width, "height": 900}, color_scheme=theme)
            page = context.new_page()
            page.goto("http://127.0.0.1:5173/login", wait_until="domcontentloaded", timeout=20_000)
            page.wait_for_timeout(400)
            data = inspect(page)
            page.screenshot(path=f"tests/artifacts/browser/f1-login-{width}-{theme}.png", full_page=True)
            results.append({"width": width, "theme": theme, **data})
            print(f"PASS width={width} theme={theme} scroll={data['scrollWidth']} inner={data['innerWidth']} h1={data['h1']} input={data['input']} submit={data['submit']}")
            context.close()
    browser.close()

Path("tests/artifacts/browser/f1_login_scale_smoke.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
