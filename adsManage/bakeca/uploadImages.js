const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const COOKIE_FILE = path.join(__dirname, "cookies.json");
const IMAGE_FOLDER = path.join(__dirname, "images");
const BAKECA_ORIGIN = "https://www.bakeca.it";
const PUBLISH_URL = "https://www.bakeca.it/inserisci/annuncio/sel_categoria/incontri-amore";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function log(step, message, data) {
    const prefix = `[uploadImages:${step}]`;
    if (typeof data === "undefined") {
        console.log(prefix, message);
        return;
    }

    console.log(prefix, message, data);
}

function getImageFiles(folderPath, limit = 20) {
    if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder not found: ${folderPath}`);
    }

    return fs
        .readdirSync(folderPath)
        .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .slice(0, limit)
        .map((file) => path.join(folderPath, file));
}

function buildUploadParams(fieldName = "allegato") {
    return {
        ts: Date.now().toString(),
        rdn: `${Math.floor(Math.random() * 100000)}${fieldName}`
    };
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".gif":
            return "image/gif";
        case ".webp":
            return "image/webp";
        default:
            return "application/octet-stream";
    }
}

function normalizeCookie(cookie) {
    return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || ".bakeca.it",
        path: cookie.path || "/",
        expires: typeof cookie.expires === "number" ? cookie.expires : -1,
        httpOnly: Boolean(cookie.httpOnly),
        secure: cookie.secure !== false,
        sameSite: cookie.sameSite || "Lax"
    };
}

async function loadCookies(filePath = COOKIE_FILE) {
    log("cookies", "Loading cookies from file", filePath);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Cookie file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const cookies = JSON.parse(raw);

    if (!Array.isArray(cookies) || cookies.length === 0) {
        throw new Error("Cookie file is empty or invalid.");
    }

    log("cookies", "Cookies loaded", { count: cookies.length });
    return cookies.map(normalizeCookie);
}

function parseUploadResponse(rawText) {
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        return {
            ok: false,
            rawText,
            parsed: null,
            content: null
        };
    }

    let content = parsed.content;
    if (typeof content === "string") {
        try {
            content = JSON.parse(content);
        } catch {
            content = parsed.content;
        }
    }

    return {
        ok: parsed.success === 1 && parsed.code === 200,
        rawText,
        parsed,
        content
    };
}

async function openPublishPage(page, url) {
    log("page", "Opening publish page", url);
    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000
    });
    

    log("page", "Publish page loaded");
}

async function uploadOneImageInBrowser(page, filePath, remoteId = "NEW") {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const { ts, rdn } = buildUploadParams();
    const url = `${BAKECA_ORIGIN}/desktop/inserimento/douploadajax/` +
        `idpriv/${remoteId}/elementname/allegato/ts/${ts}/rdn/${rdn}`;

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    const fileName = path.basename(filePath);
    const mimeType = getMimeType(filePath);

    log("network", "Uploading file from browser context", {
        filePath,
        fileName,
        mimeType,
        url
    });

    const responseData = await page.evaluate(
        async ({ uploadUrl, encodedFile, uploadFileName, uploadMimeType }) => {
            const ensurePreviewContainer = () => {
                const uploaderRoot = document.querySelector('[data-type="image-uploader"]');
                if (!uploaderRoot) {
                    return null;
                }

                let container = uploaderRoot.querySelector('[data-upload-preview-list="true"]');
                if (container) {
                    return container;
                }

                container = document.createElement("div");
                container.setAttribute("data-upload-preview-list", "true");
                container.className =
                    "pt-4 grid grid-flow-col auto-cols-[220px] pb-4 w-full overflow-x-auto gap-4 z-[100] snap-mandatory snap-x overscroll-contain touch-pan-x";

                const cardWrapper = uploaderRoot.querySelector(".p-4.border");
                if (!cardWrapper) {
                    return null;
                }

                cardWrapper.appendChild(container);
                return container;
            };

            const updateUploadedDom = (content) => {
                if (!content || !content.idUnico) {
                    return;
                }

                const escapeHtml = (value) =>
                    String(value ?? "")
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#39;");

                const updateCoverBadges = (coverId) => {
                    const previewItems = Array.from(
                        document.querySelectorAll('[data-upload-preview-list="true"] .snap-center')
                    );

                    previewItems.forEach((item) => {
                        const imageId = item.querySelector('input[name="allegato_img[]"]')?.value || "";
                        const existingBadge = item.querySelector('[data-cover-badge="true"]');
                        const existingAction = item.querySelector('[data-cover-action="true"]');

                        if (imageId === coverId) {
                            if (existingAction) {
                                existingAction.remove();
                            }
                            if (!existingBadge) {
                                const badge = document.createElement("span");
                                badge.setAttribute("data-cover-badge", "true");
                                badge.className =
                                    "block mt-1 rounded text-center px-4 py-1 bg-green-100 text-green-700 border border-green-500";
                                badge.textContent = "Copertina annuncio";
                                item.appendChild(badge);
                            }
                            return;
                        }

                        if (existingBadge) {
                            existingBadge.remove();
                        }
                        if (!existingAction) {
                            const action = document.createElement("span");
                            action.setAttribute("data-cover-action", "true");
                            action.className =
                                "block cursor-pointer mt-1 rounded text-center px-4 py-1 bg-slate-100 border border-slate-300 text-slate-700";
                            action.textContent = "Rendi copertina";
                            item.appendChild(action);
                        }
                    });
                };

                const fileInput = document.querySelector('input[name="allegato"]');
                const uploaderCount = document.querySelector(".uploader__uploaded_files");
                const previewContainer = ensurePreviewContainer();
                const uploaderRoot = document.querySelector('[data-type="image-uploader"]');

                const existingIds = Array.from(
                    document.querySelectorAll('input[name="allegato_img[]"]')
                ).map((node) => node.value);

                const newCount = existingIds.includes(content.idUnico)
                    ? existingIds.length
                    : existingIds.length + 1;

                if (fileInput) {
                    fileInput.setAttribute("data-uploaded", String(newCount));
                    if (!fileInput.getAttribute("data-queue-id")) {
                        fileInput.setAttribute(
                            "data-queue-id",
                            `${Date.now()}-${Math.random().toString(16).slice(2)}`
                        );
                    }
                }

                if (uploaderCount) {
                    uploaderCount.textContent = `${newCount} su 20`;
                }

                const coverInput = document.querySelector('input[name="copertina_img"]');
                if (coverInput && !coverInput.value) {
                    coverInput.value = content.idUnico;
                    coverInput.setAttribute("value", content.idUnico);
                }
                const activeCoverId = coverInput?.value || content.idUnico;

                if (!previewContainer || !uploaderRoot) {
                    return;
                }

                const alreadyRendered = uploaderRoot.querySelector(
                    `input[name="allegato_img[]"][value="${content.idUnico}"]`
                );
                if (alreadyRendered) {
                    updateCoverBadges(activeCoverId);
                    return;
                }

                const item = document.createElement("div");
                item.className = "snap-center snap-always relative w-full";
                item.innerHTML = `
                    <a data-fancybox="" href="${escapeHtml(content.src || "")}" data-caption="${escapeHtml(content.nomeFile || "")}" class="aspect-[1/1] cursor-pointer relative border border-slate-300 rounded bg-slate-50 w-full flex flex-col items-center justify-center p-2">
                        <img class="mx-auto w-full" alt="${escapeHtml(content.nomeFile || "")}" src="${escapeHtml(content.srcThumb || "")}">
                        <button type="button" class="p-2 absolute bottom-0 right-0 m-2 rounded-full bg-white text-slate-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"></path>
                            </svg>
                        </button>
                    </a>
                    <button type="button" class="p-1 bg-slate-800 text-white absolute -top-3 -right-3 ring-2 ring-white rounded-full disabled:bg-white disabled:text-slate-400 disabled:border disabled:border-slate-300">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    <input type="hidden" name="allegato_img[]" value="${escapeHtml(content.idUnico)}">
                    ${activeCoverId === content.idUnico
                        ? '<span data-cover-badge="true" class="block mt-1 rounded text-center px-4 py-1 bg-green-100 text-green-700 border border-green-500">Copertina annuncio</span>'
                        : '<span data-cover-action="true" class="block cursor-pointer mt-1 rounded text-center px-4 py-1 bg-slate-100 border border-slate-300 text-slate-700">Rendi copertina</span>'}
                `;

                previewContainer.appendChild(item);

                const duplicateHiddenInputs = Array.from(
                    uploaderRoot.querySelectorAll(`input[name="allegato_img[]"][value="${content.idUnico}"]`)
                );
                duplicateHiddenInputs.slice(1).forEach((node) => node.remove());

                updateCoverBadges(activeCoverId);
            };

            const binary = atob(encodedFile);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: uploadMimeType });
            const form = new FormData();
            form.append("allegato", blob, uploadFileName);

            const response = await fetch(uploadUrl, {
                method: "POST",
                body: form,
                credentials: "include",
                headers: {
                    Accept: "*/*"
                }
            });

            const rawText = await response.text();
            let parsed = null;

            try {
                parsed = JSON.parse(rawText);
            } catch {
                parsed = null;
            }

            let content = parsed?.content ?? null;
            if (typeof content === "string") {
                try {
                    content = JSON.parse(content);
                } catch {
                    content = null;
                }
            }

            if (response.ok && parsed?.success === 1 && content) {
                updateUploadedDom(content);
            }

            return {
                status: response.status,
                ok: response.ok,
                rawText
            };
        },
        {
            uploadUrl: url,
            encodedFile: base64,
            uploadFileName: fileName,
            uploadMimeType: mimeType
        }
    );

    log("network", "Browser upload response", responseData);

    return {
        filePath,
        url,
        ...responseData,
        ...parseUploadResponse(responseData.rawText)
    };
}

async function uploadImagesFromFolder(page, images, limit = 20, remoteId = "NEW") {
    // const files = getImageFiles(folderPath, limit);
    // log("files", "Selected files for upload", files);
    console.log(images, 'images in UploadImagesFromFolder');
    if (!images.length) {
        return;
    }

    const results = [];

    const MAX_RETRIES = 3;

    for (const filePath of images) {
        let success = false;
        let lastError = null;
        let result = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[UPLOAD] ${filePath} → attempt ${attempt}`);

                result = await uploadOneImageInBrowser(page, filePath, remoteId);

                // ✅ success condition
                if (result?.ok && result?.status === 200) {
                    success = true;
                    break;
                }

                console.warn(`[UPLOAD] attempt ${attempt} failed (invalid response)`);

            } catch (error) {
                lastError = error;
                console.error(`[UPLOAD] attempt ${attempt} error:`, error.message);
            }

            // wait before retry (optional backoff)
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        if (success) {
            results.push({
                filePath,
                success: true,
                status: result.status,
                parsed: result.parsed,
                content: result.content
            });
        } else {
            results.push({
                filePath,
                success: false,
                error: lastError?.message || "Upload failed after retries"
            });
        }
    }
    return results;
}

module.exports = {
    buildUploadParams,
    getImageFiles,
    getMimeType,
    loadCookies,
    openPublishPage,
    parseUploadResponse,
    uploadOneImageInBrowser,
    uploadImagesFromFolder,
};
