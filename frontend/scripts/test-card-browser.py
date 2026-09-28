"""Exercise the real app and Fabric pipeline in Chromium, then render exported PDFs.
Run from repo root after pnpm install in frontend. Requires playwright, pypdfium2 and Pillow.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import zipfile

from PIL import ImageStat
import pypdfium2 as pdfium
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / 'frontend'
OUT = FRONTEND / 'test-artifacts' / 'card-recreation'
OUT.mkdir(parents=True, exist_ok=True)
results = {'ui': [], 'engine': [], 'pdf': [], 'page_errors': []}

def passed(name):
    results['ui'].append({'name': name, 'passed': True})
    print('UI OK ' + name, flush=True)

log = (OUT / 'vite.log').open('w')
server = subprocess.Popen(['pnpm', 'dev:local', '--host', '127.0.0.1', '--port', '5173'], cwd=FRONTEND, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
try:
    for _ in range(120):
        try:
            urllib.request.urlopen('http://127.0.0.1:5173', timeout=1)
            break
        except Exception:
            if server.poll() is not None:
                raise RuntimeError('Vite exited; see vite.log')
            time.sleep(0.5)
    else:
        raise RuntimeError('Vite did not start')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 1100}, accept_downloads=True)
        page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        try:
            page.goto('http://127.0.0.1:5173', wait_until='networkidle')
            # Engine verification is independent of navigation: collect its results even if a UI check later fails.
            response = page.evaluate("async () => { const checks = await import('/template-printer/scripts/card-browser-checks.mjs'); return await checks.runChecks(); }")
            results['engine'] = response['checks']
            print(json.dumps({'engine': response['checks']}, indent=2), flush=True)
            for pdf in response['pdfs']:
                target = OUT / pdf['name']
                target.write_bytes(base64.b64decode(pdf['base64']))
                document = pdfium.PdfDocument(str(target))
                image = document[0].render(scale=3).to_pil().convert('RGB')
                image.save(OUT / (target.stem + '.png'))
                assert max(ImageStat.Stat(image).stddev) > 10, 'PDF render appears blank'
                results['pdf'].append({'name': target.name + ' renders nonblank in PDFium', 'passed': True, 'width_px': image.width, 'height_px': image.height})
                document.close()
            # The app intentionally starts on Users, not Design.
            page.get_by_role('button', name='Design', exact=True).click()
            page.get_by_role('button', name='Card Designer', exact=True).click()
            expect(page.get_by_test_id('card-designer')).to_be_visible()
            expect(page.get_by_role('button', name='Variable text', exact=True)).to_be_enabled()
            passed('real app mounts the editor under React StrictMode')
            page.get_by_role('button', name='Variable text', exact=True).click()
            page.get_by_label('Text / sample value', exact=True).fill('Browser Example')
            page.get_by_label('Opacity (%)', exact=True).fill('50')
            page.get_by_label('Opacity (%)', exact=True).blur()
            expect(page.get_by_label('Opacity (%)', exact=True)).to_have_value('50')
            passed('inspector opacity displays 50 percent, not 0.5 percent')
            page.get_by_label('Design name', exact=True).fill('Browser roundtrip specimen')
            with page.expect_download() as download_info:
                page.get_by_role('button', name='Download editable package', exact=True).click()
            package = OUT / 'browser-roundtrip.template-printer.zip'
            download_info.value.save_as(package)
            with zipfile.ZipFile(package) as archive:
                manifest = json.loads(archive.read('manifest.json'))
                scene = json.loads(archive.read(manifest['editor']['front']))
                assert scene['objects'][0]['data']['fieldId'] == 'fullName_First_Last'
                assert scene['objects'][0]['opacity'] == 0.5
            passed('downloaded package contains actual edited state and data binding')
            page.get_by_label('Open editable package', exact=True).set_input_files(package)
            expect(page.get_by_role('status').filter(has_text='Editable package restored')).to_be_visible()
            expect(page.locator('.scene-layer')).to_have_count(1)
            passed('editable ZIP imports through the actual designer file input')
            for school in ['MIT', 'Stanford', 'Harvard']:
                page.get_by_role('button', name=school + ' specimen', exact=True).click()
                expect(page.get_by_label('Design name', exact=True)).to_have_value(school + ' layout — TEST SPECIMEN')
                expect(page.get_by_role('status').filter(has_text='SVG package converted')).to_be_visible()
                expect(page.locator('.scene-layer')).not_to_have_count(0)
                page.get_by_label('Data preview', exact=True).check()
                expect(page.locator('.scene-data-preview svg')).to_be_visible()
                page.locator('.scene-data-preview svg').screenshot(path=str(OUT / (school.lower() + '-card.png')))
                page.screenshot(path=str(OUT / (school.lower() + '-in-app.png')), full_page=True)
                page.get_by_label('Data preview', exact=True).uncheck()
                passed(school + ' bundled specimen converts and previews in the real app')
            page.get_by_label('Design name', exact=True).fill('Persisted browser specimen')
            page.get_by_role('button', name='Save Design', exact=True).click()
            expect(page.get_by_test_id('card-designer')).to_have_count(0)
            expect(page.get_by_text('Persisted browser specimen', exact=True)).to_be_visible()
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Design', exact=True).click()
            page.get_by_role('button', name='Card Designs', exact=True).click()
            expect(page.get_by_text('Persisted browser specimen', exact=True)).to_be_visible()
            passed('saved design persists in the actual local library across reload')
            page.get_by_role('button', name='Card Designer', exact=True).click()
            expect(page.get_by_role('button', name='Variable text', exact=True)).to_be_enabled()
            page.get_by_role('button', name='MIT specimen', exact=True).click()
            expect(page.get_by_label('Design name', exact=True)).to_have_value('MIT layout — TEST SPECIMEN')
            page.set_viewport_size({'width': 390, 'height': 844})
            expect(page.get_by_role('button', name='Save Design', exact=True)).to_be_visible()
            page.screenshot(path=str(OUT / 'editor-mobile.png'), full_page=True)
            passed('narrow-screen editor exposes the save action and stacked panels')
            page.set_viewport_size({'width': 1440, 'height': 1100})
            page.screenshot(path=str(OUT / 'editor-desktop.png'), full_page=True)
            assert response['passed'], 'Browser engine checks failed; see results.json'
            assert not results['page_errors'], 'Unexpected page errors: ' + '; '.join(results['page_errors'])
            results['passed'] = True
        except Exception:
            results['visible_text_at_failure'] = page.locator('body').inner_text()[:14000]
            page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
            raise
        finally:
            browser.close()
finally:
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2), flush=True)
    try:
        import signal
        os.killpg(server.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    log.close()
