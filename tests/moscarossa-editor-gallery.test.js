const assert = require("node:assert/strict");
const { test } = require("node:test");
const puppeteer = require("puppeteer");
const { readEditorGallery, removeEditorPhoto, setEditorPreview } = require("../adsManage/moscarossa/publishAds");

test("reads editor photo IDs and selects an eligible preview in the ad form", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio">
              <div class="fileuploader">
              <input name="fileuploader-list-files" value='[{"file":"https://foto.moscarossa.biz/1159998/1001.jpg","index":0},{"file":"https://foto.moscarossa.biz/1159998/1002.jpg","index":1}]'>
              <input id="anteprima_id_immagine" type="hidden">
              <ul class="fileuploader-items-list">
                <li><span id="span_anteprima_1001" class="btn btn-primary" onclick="sel_anteprima(1001)">anteprima</span></li>
                <li><span id="span_anteprima_1002" class="btn btn-info" onclick="sel_anteprima(1002)">imposta anteprima</span></li>
              </ul>
              </div>
            </form>
            <script>function sel_anteprima(id) {
              document.querySelector('#anteprima_id_immagine').value = String(id);
              document.querySelectorAll('.fileuploader-items-list .btn').forEach((item) => item.classList.remove('btn-primary'));
              document.querySelector('#span_anteprima_' + id).classList.add('btn-primary');
            }</script>
        `);
        const gallery = await readEditorGallery(page, "1159998");
        assert.deepEqual(gallery.map(({ id, eligible, selected }) => ({ id, eligible, selected })), [
            { id: "1001", eligible: true, selected: true },
            { id: "1002", eligible: true, selected: false }
        ]);
        assert.equal(await setEditorPreview(page, "1159998", gallery[1]), true);
        assert.equal(await page.$eval("#anteprima_id_immagine", (input) => input.value), "1002");
    } finally {
        await browser.close();
    }
});

test("rejects non-soft preview choices and unexpected image origins", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio">
              <div class="fileuploader">
              <input name="fileuploader-list-files" value='[{"file":"https://foto.moscarossa.biz/1159998/1001.jpg","index":0}]'>
              <ul class="fileuploader-items-list"><li><span id="span_anteprima_1001">Non selezionabile come anteprima</span></li></ul>
              </div>
            </form>
        `);
        const gallery = await readEditorGallery(page, "1159998");
        await assert.rejects(setEditorPreview(page, "1159998", gallery[0]), /non è idonea/);
        await page.$eval("input[name='fileuploader-list-files']", (input) => {
            input.value = '[{"file":"https://other.example/1159998/1001.jpg","index":0}]';
        });
        await assert.rejects(readEditorGallery(page, "1159998"), /non riconosciuta/);
    } finally {
        await browser.close();
    }
});

test("confirms an editor preview dialog only when its action is unambiguous", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio">
              <input id="anteprima_id_immagine" type="hidden">
              <span id="span_anteprima_1002" class="btn btn-info" onclick="sel_anteprima(1002)">imposta anteprima</span>
            </form>
            <div id="modal_anteprima" class="modal" style="display:none"><p>Imposta anteprima</p>
              <button type="button" onclick="confirmPreview()">Conferma</button></div>
            <script>
              function sel_anteprima(id) {
                window.chosenPhoto = id;
                const modal = document.querySelector('#modal_anteprima');
                modal.style.display = 'block';
                modal.classList.add('show');
              }
              function confirmPreview() {
                document.querySelector('#anteprima_id_immagine').value = String(window.chosenPhoto);
              }
            </script>
        `);
        const changed = await setEditorPreview(page, "1159998", { id: "1002", eligible: true, selected: false });
        assert.equal(changed, true);
        assert.equal(await page.$eval("#anteprima_id_immagine", (input) => input.value), "1002");
    } finally {
        await browser.close();
    }
});

test("saves Moscarossa's crop dialog using Salva selezione for the chosen photo", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio"><input id="anteprima_id_immagine" type="hidden">
              <span id="span_anteprima_1002" class="btn btn-info" onclick="sel_anteprima(1002)">imposta anteprima</span>
            </form>
            <div id="contenuto_modal" style="display:none">
              <div class="crop-buttons">
                <span class="btn btn-danger" onclick="chiudi_selezione_anteprima()">Chiudi</span>
                <span class="btn btn-primary" onclick="salva_anteprima('1002')">Salva selezione</span>
              </div>
              <img id="cropImage" src="https://foto.moscarossa.biz/1159998/1002.jpg">
              <form id="form_sel_anteprima_1002">
                <input name="x" value="10"><input name="y" value="14">
                <input name="w" value="355"><input name="h" value="473">
                <input name="fattore_divisione" value="2.56">
                <input name="id_immagine" value="1002">
              </form>
            </div>
            <script>
              function sel_anteprima() {
                setTimeout(() => { document.querySelector('#contenuto_modal').style.display = 'block'; }, 100);
              }
              function salva_anteprima(id) {
                document.querySelector('#anteprima_id_immagine').value = id;
                document.querySelector('#contenuto_modal').style.display = 'none';
              }
            </script>
        `);
        assert.equal(await setEditorPreview(page, "1159998", { id: "1002", eligible: true, selected: false }), true);
        assert.equal(await page.$eval("#anteprima_id_immagine", (input) => input.value), "1002");
        assert.equal(await page.$eval("#contenuto_modal", (modal) => modal.style.display), "none");
    } finally {
        await browser.close();
    }
});

test("rejects a crop dialog for a different remote image", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio"><span id="span_anteprima_1002" onclick="sel_anteprima(1002)">imposta anteprima</span></form>
            <div id="contenuto_modal" style="display:none">
              <div class="crop-buttons"><span onclick="salva_anteprima('1002')">Salva selezione</span></div>
              <img id="cropImage" src="https://foto.moscarossa.biz/1159998/9999.jpg">
              <form id="form_sel_anteprima_1002">
                <input name="x" value="10"><input name="y" value="14"><input name="w" value="355"><input name="h" value="473">
                <input name="fattore_divisione" value="2.56"><input name="id_immagine" value="1002">
              </form>
            </div>
            <script>function sel_anteprima() { document.querySelector('#contenuto_modal').style.display = 'block'; }
              function salva_anteprima() { window.saved = true; }</script>
        `);
        await assert.rejects(setEditorPreview(page, "1159998", { id: "1002", eligible: true, selected: false }),
            /dialogo crop.*non valido/);
        assert.equal(await page.evaluate(() => Boolean(window.saved)), false);
    } finally {
        await browser.close();
    }
});

test("removes only the intended remote photo card", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio"><ul class="fileuploader-items-list">
              <li><div class="content-holder"><span id="span_anteprima_1001">first</span></div>
                <div class="column-actions"><a class="fileuploader-action-remove" onclick="if (confirm('Cancellare la foto?')) this.closest('li').remove()">Remove</a></div></li>
              <li><div class="content-holder"><span id="span_anteprima_1002">second</span></div>
                <div class="column-actions"><a class="fileuploader-action-remove" onclick="if (confirm('Cancellare la foto?')) this.closest('li').remove()">Remove</a></div></li>
            </ul></form>
        `);
        await removeEditorPhoto(page, "1159998", "1002");
        assert.equal(await page.$("#span_anteprima_1002"), null);
        assert.notEqual(await page.$("#span_anteprima_1001"), null);
    } finally {
        await browser.close();
    }
});

test("removal updates the serialized uploader list before replacement upload", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio"><div class="fileuploader">
              <input name="fileuploader-list-files" value='[{"file":"https://foto.moscarossa.biz/1159998/1001.jpg"},{"file":"https://foto.moscarossa.biz/1159998/1002.jpg"}]'>
              <ul class="fileuploader-items-list">
                <li><span id="span_anteprima_1001">first</span>
                  <a class="fileuploader-action-remove" onclick="if (confirm('Cancellare la foto?')) removePhoto(this, '1001')">Remove</a></li>
                <li><span id="span_anteprima_1002">second</span>
                  <a class="fileuploader-action-remove" onclick="if (confirm('Cancellare la foto?')) removePhoto(this, '1002')">Remove</a></li>
              </ul>
            </div></form>
            <script>function removePhoto(button, id) {
              const input = document.querySelector("input[name='fileuploader-list-files']");
              input.value = JSON.stringify(JSON.parse(input.value).filter((photo) => !photo.file.includes('/' + id + '.')));
              button.closest('li').remove();
            }</script>
        `);
        await removeEditorPhoto(page, "1159998", "1002");
        const gallery = await readEditorGallery(page, "1159998");
        assert.deepEqual(gallery.map((photo) => photo.id), ["1001"]);
        await removeEditorPhoto(page, "1159998", "1001");
        assert.deepEqual(await readEditorGallery(page, "1159998"), []);
    } finally {
        await browser.close();
    }
});

test("dismisses an unrelated confirmation instead of deleting a remote photo", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    try {
        await page.setContent(`
            <form id="dati_annuncio"><ul class="fileuploader-items-list">
              <li><span id="span_anteprima_1002">second</span>
                <a class="fileuploader-action-remove" onclick="if (confirm('Delete account?')) this.closest('li').remove()">Remove</a></li>
            </ul></form>
        `);
        await assert.rejects(removeEditorPhoto(page, "1159998", "1002"), /conferma inattesa/);
        assert.notEqual(await page.$("#span_anteprima_1002"), null);
    } finally {
        await browser.close();
    }
});
