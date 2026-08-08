"""Render the static enterprise reference screens with the local Playwright browser."""

from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
PAGES = ROOT / "app" / "pages"
SCREENS = ROOT / "screens"


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    with sync_playwright() as playwright:
        local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
        browser_candidates = sorted(local_app_data.glob("ms-playwright/chromium-*/chrome-win64/chrome.exe"), reverse=True)
        executable = str(browser_candidates[0]) if browser_candidates else None
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        page = browser.new_page()
        for index, screen in enumerate(manifest, 1):
            number = int(Path(screen["file"]).stem.split("_", 1)[0])
            if 51 <= number <= 54:
                # Annotated pages intentionally display their existing source image.
                continue
            mobile = 46 <= number <= 49
            folder = "mobile" if mobile else "special" if number == 50 else "desktop"
            output = SCREENS / folder / f"{Path(screen['file']).stem}.png"
            output.parent.mkdir(parents=True, exist_ok=True)
            page.set_viewport_size({"width": 460, "height": 920} if mobile else {"width": 1586, "height": 992})
            page.goto((PAGES / screen["file"]).resolve().as_uri(), wait_until="load")
            temporary_output = output.with_name(f".{output.stem}.render.png")
            page.screenshot(path=str(temporary_output), full_page=False)
            temporary_output.replace(output)
            print(f"{index:02d}/{len(manifest)} {output.name}", flush=True)
        browser.close()


if __name__ == "__main__":
    main()
