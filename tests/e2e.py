#!/usr/bin/env python3
"""Real browser, persistence, input-boundary, responsive and PDF checks.

Requires locally installed Playwright/Chromium, Pillow, and Poppler CLI tools.
Starts an isolated loopback server; never uses paid APIs or external sites.
"""

import base64
from io import BytesIO
import json
import math
import os
from pathlib import Path
import re
import socket
import struct
import subprocess
import sys
import time
import unittest
import urllib.request

from PIL import Image, ImageDraw
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"


def png_fixture():
    image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((12, 12, 84, 84), fill="#cc5588")
    draw.rectangle((40, 0, 54, 96), fill="#335577")
    stream = BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


def jpeg_fixture():
    image = Image.new("RGB", (96, 64), "#aaddcc")
    ImageDraw.Draw(image).rectangle((24, 16, 72, 48), fill="#884488")
    stream = BytesIO()
    image.save(stream, format="JPEG")
    return stream.getvalue()


class StudioBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUT.mkdir(exist_ok=True)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.url = f"http://127.0.0.1:{port}"
        cls.log = (OUT / "e2e-server.log").open("w")
        cls.server = subprocess.Popen(
            [sys.executable, "-u", str(ROOT / "app/server.py"), "--port", str(port)],
            cwd=ROOT, stdout=cls.log, stderr=cls.log,
        )
        try:
            for _ in range(60):
                if cls.server.poll() is not None:
                    raise RuntimeError("Test sunucusu başlatılamadı; e2e-server.log dosyasına bakın.")
                try:
                    with urllib.request.urlopen(cls.url + "/healthz", timeout=1) as response:
                        if json.load(response)["status"] == "ok":
                            break
                except (OSError, ValueError):
                    time.sleep(0.1)
            else:
                raise RuntimeError("Test sunucusu zaman aşımına uğradı.")
            cls.pw = sync_playwright().start()
            cls.browser = cls.pw.chromium.launch(headless=True)
        except BaseException:
            cls.server.terminate()
            cls.server.wait(timeout=10)
            cls.log.close()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.terminate()
        cls.server.wait(timeout=10)
        cls.log.close()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={"width": 1440, "height": 1000},
            accept_downloads=True,
            locale="tr-TR",
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.errors = []
        self.external_requests = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on(
            "request",
            lambda request: self.external_requests.append(request.url)
            if request.url.startswith(("http:", "https:")) and not request.url.startswith(self.url + "/")
            else None,
        )
        self.page.on("dialog", lambda dialog: dialog.accept())
        self.page.goto(self.url, wait_until="networkidle")
        expect(self.page.get_by_test_id("project-name")).to_have_value("Kır Bahçesi")
        expect(self.page.locator("#main-preview svg")).to_be_visible()

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], "Tarayıcı JavaScript hataları")
            self.assertEqual(self.external_requests, [], "Beklenmedik dış ağ isteği")
        finally:
            self.context.close()

    def step(self, number):
        self.page.get_by_test_id(f"step-{number}").click()

    def exported(self, filename="project.json"):
        with self.page.expect_download() as event:
            self.page.get_by_test_id("export-project").click()
        path = OUT / filename
        event.value.save_as(path)
        return json.loads(path.read_text(encoding="utf-8"))

    def import_project(self, project, *, expected_name=None):
        self.page.get_by_test_id("import-project").set_input_files({
            "name": "project.json",
            "mimeType": "application/json",
            "buffer": json.dumps(project, ensure_ascii=False).encode(),
        })
        if expected_name is not None:
            expect(self.page.get_by_test_id("project-name")).to_have_value(expected_name)
        self.page.wait_for_timeout(100)

    def upload(self, data, mime="image/png", name="motif.png"):
        self.step(2)
        self.page.get_by_test_id("image-upload").set_input_files({
            "name": name, "mimeType": mime, "buffer": data,
        })

    def pdf_info(self, path):
        text = subprocess.check_output(["pdfinfo", str(path)], text=True)
        pages = int(re.search(r"^Pages:\s+(\d+)", text, re.MULTILINE).group(1))
        dimensions = re.search(r"^Page size:\s+([\d.]+) x ([\d.]+) pts", text, re.MULTILINE)
        return pages, tuple(float(value) for value in dimensions.groups())

    def assert_pdf(self, paper, count, width_mm, height_mm, *, orientation="landscape"):
        self.step(7)
        self.page.get_by_test_id("paper-size").select_option(paper)
        self.page.locator("#paper-orientation").select_option(orientation)
        expected_pages = math.ceil(count / (6 if paper == "A5" else 3))
        expect(self.page.get_by_test_id("print-sheet")).to_have_count(expected_pages)
        self.page.evaluate("document.fonts.ready")
        path = OUT / f"presentation-{paper}-{orientation}.pdf"
        self.page.pdf(path=str(path), print_background=True, prefer_css_page_size=True)
        pages, dimensions = self.pdf_info(path)
        self.assertEqual(pages, expected_pages)
        for actual, mm in zip(dimensions, (width_mm, height_mm)):
            self.assertAlmostEqual(actual, mm * 72 / 25.4, delta=1.2)
        text = subprocess.check_output(["pdftotext", str(path), "-"], text=True)
        self.assertIn("KMS-026", text)
        self.assertNotIn("Projeyi kaydet", text)
        self.assertNotIn("JSON yedek", text)
        return path

    def test_01_desktop_workbench(self):
        expect(self.page.locator("[data-step]")).to_have_count(7)
        expect(self.page.get_by_test_id("variant-card")).to_have_count(3)
        self.assertLessEqual(
            self.page.evaluate("document.documentElement.scrollWidth"),
            self.page.evaluate("window.innerWidth"),
        )
        self.page.screenshot(path=str(OUT / "desktop.png"), full_page=True)

    def test_02_mix_background_and_product_flow(self):
        baseline = self.exported("baseline.json")
        self.step(3)
        self.page.get_by_test_id("mix-button").click()
        mixed = self.exported("mixed.json")
        self.assertNotEqual(mixed["composition"]["seed"], baseline["composition"]["seed"])
        self.step(4)
        self.page.locator("#background-hex").fill("#AADDBB")
        self.page.locator("#background-hex").press("Tab")
        self.page.locator("#trim-hex").fill("#334455")
        self.page.locator("#trim-hex").press("Tab")
        colored = self.exported("colored.json")
        self.assertEqual(colored["background"].upper(), "#AADDBB")
        self.assertEqual(colored["trim"].upper(), "#334455")
        self.assertEqual(colored["composition"], mixed["composition"])
        self.step(5)
        self.page.locator("#product-type").select_option("boxer")
        self.page.locator("#pack-type").select_option("set")
        self.page.locator("#variant-label").fill("Boxer takım")
        self.page.get_by_test_id("add-variant").click()
        self.page.locator("#pack-type").select_option("5")
        self.page.locator("#variant-label").fill("Beşli boxer")
        self.page.get_by_test_id("add-variant").click()
        result = self.exported("variants.json")
        self.assertEqual(len(result["variants"]), 5)
        self.assertEqual(result["variants"][-2]["pack"], "set")
        self.assertEqual(result["variants"][-1]["pack"], "5")
        self.assertEqual(result["variants"][-1]["product"], "boxer")
        self.assertEqual(result["composition"], mixed["composition"])

    def test_03_save_reload_and_json_roundtrip(self):
        self.page.get_by_test_id("project-name").fill("E2E Koleksiyonu")
        self.page.get_by_test_id("project-name").press("Tab")
        self.page.get_by_test_id("save-project").click()
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("kayded", re.I))
        saved = self.exported("saved-project.json")
        self.page.reload(wait_until="networkidle")
        expect(self.page.get_by_test_id("project-name")).to_have_value("E2E Koleksiyonu")
        self.assertEqual(self.exported("restored.json"), saved)
        self.page.get_by_test_id("project-name").fill("Değişmiş taslak")
        self.page.get_by_test_id("project-name").press("Tab")
        self.import_project(saved, expected_name="E2E Koleksiyonu")
        self.assertEqual(self.exported("roundtrip.json"), saved)
        self.page.locator("#open-project").click()
        expect(self.page.locator("#saved-projects")).to_contain_text("E2E Koleksiyonu")

    def test_04_invalid_import_is_atomic_and_images_are_decoded(self):
        original = self.exported("before-invalid.json")
        invalid = dict(original, version=99)
        self.import_project(invalid)
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("sürüm|hata", re.I))
        self.assertEqual(self.exported("after-invalid.json"), original)
        malicious = json.loads(json.dumps(original))
        malicious["assets"] = [{
            "id": "evil", "name": "evil.png", "mime": "image/png",
            "width": 1, "height": 1, "dataUrl": "https://invalid.example/secret.png",
        }]
        self.import_project(malicious)
        self.assertEqual(self.exported("after-url.json"), original)
        # Plausible PNG header but no valid image body: metadata alone is insufficient.
        bad_image = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 4, 4)
        malformed = json.loads(json.dumps(original))
        malformed["assets"] = [{
            "id": "broken", "name": "broken.png", "mime": "image/png", "width": 4,
            "height": 4, "dataUrl": "data:image/png;base64," + base64.b64encode(bad_image).decode(),
        }]
        self.import_project(malformed)
        self.page.wait_for_timeout(300)
        self.assertEqual(self.exported("after-broken-image.json"), original)

    def test_05_upload_and_raster_persistence(self):
        self.upload(png_fixture())
        expect(self.page.locator("#asset-list")).to_contain_text("motif.png")
        self.upload(jpeg_fixture(), "image/jpeg", "desen.jpg")
        expect(self.page.locator("#asset-list")).to_contain_text("desen.jpg")
        project = self.exported("with-assets.json")
        self.assertEqual(len(project["assets"]), 2)
        self.assertTrue(all(asset["dataUrl"].startswith("data:image/") for asset in project["assets"]))
        self.page.locator("#pattern-mode").select_option("raster")
        self.page.get_by_test_id("save-project").click()
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("kayded", re.I))
        persisted = self.exported("raster-saved.json")
        self.page.reload(wait_until="networkidle")
        self.assertEqual(self.exported("raster-restored.json"), persisted)
        self.assert_pdf("A5", 3, 210, 148)
        self.step(2)
        self.page.screenshot(path=str(OUT / "uploaded-raster.png"), full_page=True)

    def test_06_pdf_pagination_orientation_and_print_action(self):
        project = self.exported("print-source.json")
        template = project["variants"][0]
        project["variants"] = [
            dict(template, id=f"print-{i}", label=f"Varyant {i + 1}")
            for i in range(7)
        ]
        self.import_project(project, expected_name=project["name"])
        self.assert_pdf("A5", 7, 210, 148)
        self.assert_pdf("A6", 7, 148, 105)
        self.assert_pdf("A6", 7, 105, 148, orientation="portrait")
        self.page.locator("#paper-orientation").select_option("landscape")
        self.page.evaluate("window.__printCalled = false; window.print = () => { window.__printCalled = true; }")
        self.page.get_by_test_id("print-button").click()
        self.page.wait_for_function("window.__printCalled === true")
        self.page.screenshot(path=str(OUT / "presentation.png"), full_page=True)

    def test_07_empty_variants_and_upload_limits(self):
        project = self.exported("empty-source.json")
        project["variants"] = []
        self.import_project(project, expected_name=project["name"])
        self.step(7)
        expect(self.page.get_by_test_id("print-button")).to_be_disabled()
        expect(self.page.get_by_test_id("print-sheet")).to_have_count(0)
        self.upload(b"not an image")
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("bozuk|geçersiz|hata", re.I))
        self.upload(b"x" * (10 * 1024 * 1024 + 1))
        expect(self.page.get_by_test_id("status")).to_contain_text("10 MB")
        huge_header = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 5000, 5000)
        self.upload(huge_header)
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("megapiksel|16 MP", re.I))
        self.assertEqual(self.exported("after-upload-errors.json")["assets"], [])

    def test_08_text_is_not_executable(self):
        self.step(6)
        self.page.locator("#company-name").fill('<img src=x onerror="window.__xss=1">')
        self.page.locator("#company-name").press("Tab")
        # Föy bir sonraki karede yeniden çizilir; metni bekleyerek doğrula.
        expect(self.page.locator("#print-sheets")).to_contain_text("<img src=x")
        self.assertIsNone(self.page.evaluate("window.__xss"))
        self.assertEqual(self.page.locator("#print-sheets img").count(), 0)

    def test_09_mobile_workflow_no_page_overflow(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        for number in [1, 2, 3, 4, 5, 6, 7]:
            self.step(number)
            self.assertLessEqual(
                self.page.evaluate("document.documentElement.scrollWidth"),
                self.page.evaluate("window.innerWidth") + 1,
                f"Yatay taşma: adım {number}",
            )
        self.step(3)
        self.page.screenshot(path=str(OUT / "mobile.png"), full_page=True)

    def test_10_maximum_variants_and_determinism(self):
        project = self.exported("stress-source.json")
        template = project["variants"][0]
        project["composition"]["density"] = 40
        project["variants"] = [
            dict(template, id=f"stress-{i}", label=f"Paket {i + 1}", pack="5")
            for i in range(60)
        ]
        self.import_project(project, expected_name=project["name"])
        self.assertEqual(self.exported("stress-restored.json"), project)
        self.assertLessEqual(self.page.get_by_test_id("variant-card").count(), 12)
        self.step(7)
        self.page.get_by_test_id("paper-size").select_option("A6")
        expect(self.page.get_by_test_id("print-sheet")).to_have_count(20, timeout=20000)

    def test_11_storage_unavailable_is_truthful(self):
        self.page.add_init_script("""
            Object.defineProperty(window, 'indexedDB', { configurable: true, value: {
                open() { throw new DOMException('Storage unavailable', 'SecurityError'); }
            }});
        """)
        self.page.reload(wait_until="networkidle")
        expect(self.page.locator("#main-preview svg")).to_be_visible()
        self.page.get_by_test_id("save-project").click()
        expect(self.page.get_by_test_id("status")).not_to_contain_text(re.compile("başarıyla kayded", re.I))
        expect(self.page.get_by_test_id("status")).to_contain_text(re.compile("yedek|depolama|kaydedilemedi|hata", re.I))
        self.assertEqual(self.exported("without-storage.json")["version"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
