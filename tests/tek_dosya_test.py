#!/usr/bin/env python3
"""Tek dosyalık sürümü (dist/KumashAi.html) sunucusuz, file:// üzerinden dener."""

import importlib.util
from pathlib import Path
import unittest

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("tek_dosya", ROOT / "tools" / "tek_dosya.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class SingleFileTests(unittest.TestCase):
    def test_file_url_workflow_and_persistence(self):
        url = builder.build().as_uri()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1400, "height": 1000}, locale="tr-TR")
            page = context.new_page()
            errors, requests = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("request", lambda r: requests.append(r.url) if r.url.startswith(("http:", "https:")) else None)
            page.goto(url)
            page.evaluate("window.KumashAi.ready")
            expect(page.locator("#main-preview svg")).to_be_visible()
            expect(page.get_by_test_id("variant-card")).to_have_count(3)
            # Çizim atölyesi → desene uygula
            page.get_by_test_id("open-atolye").click()
            page.get_by_test_id("at-apply").click()
            expect(page.get_by_test_id("status")).to_contain_text("raport")
            # Zemin, ürün, föy
            page.get_by_test_id("step-2").click()
            page.locator('#ground-quick [data-ground="#F9C9D4"]').click()
            page.get_by_test_id("step-3").click()
            page.get_by_test_id("generate-variants").click()
            expect(page.get_by_test_id("variant-card")).to_have_count(6)
            page.get_by_test_id("step-4").click()
            expect(page.get_by_test_id("print-sheet")).to_have_count(1)
            # Kendiliğinden kayıt ve yeniden açılış
            expect(page.locator("#save-state")).to_contain_text("kaydedildi")
            page.reload()
            page.evaluate("window.KumashAi.ready")
            project = page.evaluate("window.KumashAi.getProject()")
            self.assertEqual(project["background"], "#F9C9D4")
            self.assertEqual(project["composition"]["mode"], "raster")
            self.assertEqual(len(project["variants"]), 6)
            self.assertEqual(errors, [])
            self.assertEqual(requests, [], "Tek dosya dışarıya istek yapmamalı")
            browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
