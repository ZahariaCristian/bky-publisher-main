const { UPDATE_API } = require("./const");
const { uploadImagesFromFolder } = require("./uploadImages");
const {
    log,
    buildPublishPayload,
    readPublishContext,
    resolveLocationData,
    submitPublishRequest
} = require("./publishAds");

function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readExistingMediaState(page) {
    return page.evaluate(() => {
        const normalizeId = (value) => String(value || "").trim();
        const extractIdFromUrl = (value) => {
            const text = String(value || "").trim();
            if (!text) {
                return "";
            }

            const patterns = [
                /-([a-f0-9]{28,40}[a-z]{2})(?:_[^./]+)?\.(?:jpe?g|png|gif|webp)$/i,
                /\/([a-f0-9]{28,40}[a-z]{2})(?:_[^./]+)?\.(?:jpe?g|png|gif|webp)$/i,
                /\b([a-f0-9]{28,40}[a-z]{2})\b/i
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match?.[1]) {
                    return match[1];
                }
            }

            return "";
        };

        const directImageIds = Array.from(
            document.querySelectorAll('input[name="allegato_img[]"], input[name="allegato_img"]')
        )
            .map((node) => normalizeId(node.value || node.getAttribute("value") || ""))
            .filter(Boolean);

        const previewUrlIds = Array.from(
            document.querySelectorAll('[data-upload-preview-list="true"] a[href], [data-upload-preview-list="true"] img[src], a[data-fancybox][href], img[src*="static.bakeca.it/immagini/"]')
        )
            .map((node) => extractIdFromUrl(node.getAttribute("href") || node.getAttribute("src") || ""))
            .filter(Boolean);

        const alpineImageIds = [];
        let alpineCoverId = "";
        Array.from(document.querySelectorAll("[x-data]")).forEach((node) => {
            const dataStack = Array.isArray(node._x_dataStack) ? node._x_dataStack : [];
            dataStack.forEach((scope) => {
                if (!scope || typeof scope !== "object") {
                    return;
                }

                const uploadedFiles = Array.isArray(scope.uploadedFiles) ? scope.uploadedFiles : [];
                uploadedFiles.forEach((file) => {
                    const id = normalizeId(file?.idUnico);
                    if (id) {
                        alpineImageIds.push(id);
                    }
                });

                if (!alpineCoverId && typeof scope.getCoverId === "function") {
                    try {
                        alpineCoverId = normalizeId(scope.getCoverId());
                    } catch { }
                }
            });
        });

        const uniqueImageIds = Array.from(new Set([
            ...directImageIds,
            ...previewUrlIds,
            ...alpineImageIds
        ]));
        const coverId = normalizeId(document.querySelector('input[name="copertina_img"]')?.value)
            || alpineCoverId
            || uniqueImageIds[0]
            || "";
        const uploaderText = (document.querySelector(".uploader__uploaded_files")?.textContent || "").trim();
        const uploadedCountMatch = uploaderText.match(/(\d+)\s+su\s+\d+/i) || uploaderText.match(/(\d+)/);
        const uploadedCount = uploadedCountMatch ? Number(uploadedCountMatch[1]) : null;
        const hasGalleryDom = Boolean(
            document.querySelector('[data-upload-preview-list="true"]')
            || document.querySelector('input[name="allegato_img[]"]')
            || document.querySelector('input[name="copertina_img"]')
            || document.querySelector('img[src*="static.bakeca.it/immagini/"]')
        );

        return {
            imageIds: uniqueImageIds,
            coverId,
            uploadedCount,
            uploaderText,
            hasGalleryDom,
            sources: {
                directImageIds,
                previewUrlIds,
                alpineImageIds,
                alpineCoverId
            }
        };
    });
}

async function waitForExistingMediaState(page, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let lastState = null;

    while (Date.now() < deadline) {
        lastState = await readExistingMediaState(page).catch(() => null);
        if (!lastState) {
            await sleep(500);
            continue;
        }

        const shouldStop = lastState.imageIds.length > 0
            || lastState.uploadedCount === 0
            || (lastState.hasGalleryDom && (lastState.uploadedCount || 0) === 0);

        if (shouldStop) {
            await sleep(500);
            return await readExistingMediaState(page).catch(() => lastState);
        }

        await sleep(500);
    }

    return lastState || await readExistingMediaState(page).catch(() => ({
        imageIds: [],
        coverId: "",
        uploadedCount: null,
        uploaderText: "",
        hasGalleryDom: false,
        sources: {
            directImageIds: [],
            previewUrlIds: [],
            alpineImageIds: [],
            alpineCoverId: ""
        }
    }));
}

async function waitForUpdatePageReady(page, timeoutMs = 15000) {
    await page.waitForFunction(() => {
        const hasIdPriv = Boolean(document.querySelector('input[name="idpriv"]'));
        const hasUploaderInfo = Boolean(document.querySelector(".uploader__uploaded_files"));
        const hasGalleryState = Boolean(
            document.querySelector('input[name="copertina_img"]')
            || document.querySelector('input[name="allegato_img[]"]')
            || document.querySelector('[data-upload-preview-list="true"]')
        );

        return hasIdPriv && (hasUploaderInfo || hasGalleryState);
    }, { timeout: timeoutMs }).catch(() => null);

    await sleep(1000);
}

async function updateAd(page, adData) {
    await waitForUpdatePageReady(page);

    const updateContext = await readPublishContext(page);
    log("update-context", "Update context from page", updateContext);

    if (!updateContext.idpriv) {
        throw new Error("Bakeca update page missing idpriv");
    }

    let existingMedia = await waitForExistingMediaState(page);
    if ((existingMedia.uploadedCount || 0) > 0 && existingMedia.imageIds.length === 0) {
        await sleep(1500);
        existingMedia = await waitForExistingMediaState(page, 5000);
    }
    log("update-media", "Existing media state", existingMedia);

    const locationData = await resolveLocationData(page, adData.comune, updateContext);
    log("update-location", "Resolved location data", locationData);

    const uploadResults = await uploadImagesFromFolder(
        page,
        Array.isArray(adData.images) ? adData.images : [],
        adData.imageLimit || 3,
        updateContext.idpriv
    ) || [];

    const failedUploads = uploadResults.filter((item) => !item.success || !item.content?.idUnico);
    if (failedUploads.length > 0) {
        console.log(`Bakeca update image upload failed for ${failedUploads.length} file(s).`);
    }

    const uploadedImageIds = uploadResults
        .filter((item) => item.success && item.content?.idUnico)
        .map((item) => item.content.idUnico);

    const scrapedDeleteImageIds = [...existingMedia.imageIds];
    const hasUploadedImages = uploadedImageIds.length > 0;
    const deleteImageIds = hasUploadedImages
        ? scrapedDeleteImageIds
        : [];
    const resolvedImageIds = hasUploadedImages
        ? uploadedImageIds
        : existingMedia.imageIds;
    const resolvedCoverId = firstNonEmpty(
        adData.copertina_img,
        resolvedImageIds[0],
        existingMedia.coverId
    );

    const payload = await buildPublishPayload(adData, updateContext, resolvedImageIds, locationData);
    payload.copertina_img = resolvedCoverId;
    payload.allegato_img = resolvedImageIds;
    payload.allegato_delete_img = deleteImageIds;
    payload.allegato_files = uploadResults
        .map((item) => item.filePath)
        .filter(Boolean);

    const submitResult = await submitPublishRequest(page, payload, UPDATE_API);
     
    return {
        ok: Boolean(submitResult?.ok),
        payload,
        submitResult,
        updateContext,
        existingMedia,
        uploadResults,
        imageIds: resolvedImageIds,
        deleteImageIds,
        failedUploads
    };
}

module.exports = {
    readExistingMediaState,
    updateAd
};
