"""Focused UI evidence probe for the 1024px dark-theme shell boundary."""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"
ARTIFACT = Path("tests/artifacts/browser/frontend-ux-audit/focus-probe.json")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run() -> int:
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    executable_path = None
    chromium_dirs = sorted(Path(local_app_data, "ms-playwright").glob("chromium-*"), reverse=True) if local_app_data else []
    for directory in chromium_dirs:
        for candidate in (directory / "chrome-win" / "chrome.exe", directory / "chrome-win64" / "chrome.exe"):
            if candidate.exists():
                executable_path = str(candidate)
                break
        if executable_path:
            break

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=executable_path)
        context = browser.new_context(viewport={"width": 1024, "height": 900})
        context.add_init_script(script="window.localStorage.setItem('recruitflow.theme', 'dark');")
        page = context.new_page()
        page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30_000)
        page.locator("#login-email").fill("sarah.ahmed@recruitflow.local")
        page.locator("#login-password").fill("Password123!")
        page.locator("button[type='submit']").click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=30_000)
        page.wait_for_selector(".app", timeout=30_000)
        page.wait_for_timeout(750)
        evidence = page.evaluate(
            """
            () => {
              const rgb = (value) => (value.match(/\\d+(?:\\.\\d+)?/g) || []).slice(0, 3).map(Number);
              const renderedRgb = (value) => {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const context = canvas.getContext('2d');
                context.fillStyle = value;
                context.fillRect(0, 0, 1, 1);
                const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
                return `rgb(${red}, ${green}, ${blue})`;
              };
              const channel = (value) => {
                const linear = value / 255;
                return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
              };
              const luminance = (value) => {
                const [red, green, blue] = rgb(value).map(channel);
                return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
              };
              const contrast = (foreground, background) => {
                const a = luminance(renderedRgb(foreground));
                const b = luminance(renderedRgb(background));
                return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
              };
              const box = (selector) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return {
                  selector,
                  display: style.display,
                  visibility: style.visibility,
                  pointerEvents: style.pointerEvents,
                  transform: style.transform,
                  width: Math.round(rect.width * 10) / 10,
                  height: Math.round(rect.height * 10) / 10,
                  x: Math.round(rect.x * 10) / 10,
                  y: Math.round(rect.y * 10) / 10,
                };
              };
              const metric = document.querySelector('[aria-label="Pipeline metrics"] .text-2xl');
              const card = metric?.closest('.bg-rf-surface');
              const heading = document.querySelector('h1');
              const nextAction = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Create job request'));
              const metricStyle = metric ? getComputedStyle(metric) : null;
              const cardStyle = card ? getComputedStyle(card) : null;
              const headingStyle = heading ? getComputedStyle(heading) : null;
              const nextActionStyle = nextAction ? getComputedStyle(nextAction) : null;
              return {
                viewport: { width: innerWidth, height: innerHeight },
                theme: document.documentElement.dataset.theme,
                sidebar: box('.sidebar'),
                mobileMenu: box('button[aria-label="Open navigation menu"]'),
                header: box('.header'),
                sidebarAriaHidden: document.querySelector('.sidebar')?.getAttribute('aria-hidden'),
                offscreenSidebarLinks: [...document.querySelectorAll('.sidebar a')]
                  .filter((link) => link.getBoundingClientRect().right <= 0)
                  .map((link) => link.getAttribute('aria-label') || link.textContent?.trim()),
                metric: metricStyle && cardStyle ? {
                  text: metric.textContent.trim(),
                  foreground: metricStyle.color,
                  background: cardStyle.backgroundColor,
                  renderedForeground: renderedRgb(metricStyle.color),
                  renderedBackground: renderedRgb(cardStyle.backgroundColor),
                  contrast: contrast(metricStyle.color, cardStyle.backgroundColor),
                } : null,
                heading: headingStyle ? { text: heading.textContent.trim(), color: headingStyle.color } : null,
                nextAction: nextActionStyle ? { text: nextAction.textContent.trim(), color: nextActionStyle.color, background: nextActionStyle.backgroundColor } : null,
              };
            }
            """
        )
        page.screenshot(path=str(ARTIFACT.parent / "focus-1024-dark.png"), full_page=True)
        context.close()

        mobile_context = browser.new_context(viewport={"width": 375, "height": 812})
        mobile_context.add_init_script(script="window.localStorage.setItem('recruitflow.theme', 'light');")
        mobile_page = mobile_context.new_page()
        mobile_page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30_000)
        mobile_page.locator("#login-email").fill("sarah.ahmed@recruitflow.local")
        mobile_page.locator("#login-password").fill("Password123!")
        mobile_page.locator("button[type='submit']").click()
        mobile_page.wait_for_url(lambda url: "/login" not in url, timeout=30_000)
        mobile_page.wait_for_selector(".app", timeout=30_000)
        menu = mobile_page.get_by_label("Open navigation menu")
        menu.click()
        mobile_page.wait_for_timeout(250)
        mobile_open = mobile_page.evaluate(
            """
            () => ({
              sidebar: (() => {
                const element = document.querySelector('.sidebar');
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return { visibility: style.visibility, pointerEvents: style.pointerEvents, transform: style.transform, x: rect.x, width: rect.width };
              })(),
              labels: [...document.querySelectorAll('.nav a')].map((link) => link.getAttribute('aria-label')),
            })
            """
        )
        mobile_page.keyboard.press("Escape")
        mobile_page.wait_for_timeout(200)
        mobile_closed = mobile_page.evaluate(
            """
            () => ({
              activeLabel: document.activeElement?.getAttribute('aria-label'),
              sidebarTransform: getComputedStyle(document.querySelector('.sidebar')).transform,
            })
            """
        )
        evidence["mobile375"] = {"opened": mobile_open, "closed": mobile_closed}
        mobile_page.screenshot(path=str(ARTIFACT.parent / "focus-375-light.png"), full_page=True)
        mobile_context.close()
        browser.close()

    ARTIFACT.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps(evidence, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
