const fs = require("fs");
const path = require("path");

const MANAGE_BASE_URL = "https://www.bakecaincontrii.com/u/post-manage";
const ACTION_LABELS = Object.freeze({
  republish: "Pubblica",
  delete: "Elimina",
});

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const workflowError = (code, message, details = {}) => {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  error.stage = "manage-ad";
  error.details = details;
  return error;
};

const sanitizeFilePart = (value) => `${value || "unknown"}`
  .replace(/[^a-z0-9_-]+/gi, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "unknown";

const captureScreenshot = async (page, remoteId, label) => {
  const directory = path.join(process.cwd(), "screenshots", "bakecaincontrii-manage");
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(
    directory,
    `${Date.now()}-${sanitizeFilePart(remoteId)}-${sanitizeFilePart(label)}.png`
  );
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
  return filePath;
};

const inspectManagePage = async (page) => page.evaluate(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const normalize = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
  const actionRoot = document.querySelector('[data-testid="post-manage-actions"]');
  const actionLabels = Array.from(actionRoot?.querySelectorAll("button, a") || [])
    .filter(visible)
    .map((node) => normalize(node.getAttribute("aria-label") || node.textContent))
    .filter(Boolean);
  const errorNode = document.querySelector("#error-top-alert");
  const bodyText = normalize(document.body?.innerText);

  return {
    url: window.location.href,
    pathname: window.location.pathname,
    title: document.title || "",
    hasManageContent: Boolean(document.querySelector('[data-testid="post-manage-content"]')),
    statusText: normalize(document.querySelector('[data-testid="post-status-badge"]')?.textContent),
    actionLabels,
    errorText: errorNode && visible(errorNode) ? normalize(errorNode.textContent) : "",
    notFound: Boolean(document.querySelector(".img404")) || /pagina non trovata|annuncio non trovato|404/i.test(bodyText),
    deletedText: /annuncio[^.]{0,80}(?:eliminat|cancellat|rimosso)|eliminato con successo/i.test(bodyText),
    bodyExcerpt: bodyText.slice(0, 500),
  };
});

const acceptAdultConsent = async (page) => page.evaluate(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const button = Array.from(document.querySelectorAll("button"))
    .filter(visible)
    .find((node) => /^(?:accetto|accept)$/i.test(`${node.textContent || ""}`.trim()));
  if (!button) return false;
  button.click();
  return true;
}).catch(() => false);

const clickActionButton = async (page, label) => page.evaluate((expectedLabel) => {
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const normalize = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
  const root = document.querySelector('[data-testid="post-manage-actions"]');
  const button = Array.from(root?.querySelectorAll("button") || [])
    .filter(visible)
    .find((node) => normalize(node.getAttribute("aria-label") || node.textContent).toLowerCase() === expectedLabel.toLowerCase());
  if (!button) return false;
  button.click();
  return true;
}, label);

const clickVisibleConfirmation = async (page, action) => page.evaluate((requestedAction) => {
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const normalize = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
  const modals = Array.from(document.querySelectorAll('.modal.show, [role="dialog"]')).filter(visible);
  const candidates = modals.flatMap((modal) => Array.from(modal.querySelectorAll("button"))).filter(visible);
  const preferred = requestedAction === "delete" ? /^(?:elimina|conferma elimina)$/i : /^(?:pubblica|conferma pubblicazione)$/i;
  const fallback = /^(?:conferma|continua|procedi|s[iì]|ok)$/i;
  const button = candidates.find((node) => preferred.test(normalize(node.getAttribute("aria-label") || node.textContent))) ||
    candidates.find((node) => fallback.test(normalize(node.getAttribute("aria-label") || node.textContent)));
  if (!button) return false;
  button.click();
  return true;
}, action).catch(() => false);

const isRepublishConfirmed = (state) => {
  const status = `${state?.statusText || ""}`.toLowerCase();
  if (!state?.hasManageContent || state?.notFound) return false;
  if (/non\s+pubblicato|sospeso/.test(status)) return false;
  return /pubblicato|attivo|online/.test(status) ||
    (state.actionLabels || []).some((label) => /sospendi/i.test(label));
};

const isDeleteConfirmed = (state, managePath) => {
  if (state?.notFound || state?.deletedText) return true;
  if (/^\/u\/(?:account\/dashboard|posts?|post-list)\/?$/i.test(`${state?.pathname || ""}`)) return true;
  return Boolean(state && !state.hasManageContent && state.pathname !== managePath && !/\/u\/login\//i.test(state.pathname));
};

const manageBakecaincontriiAd = async (page, remoteId, action) => {
  const normalizedRemoteId = `${remoteId || ""}`.trim();
  const label = ACTION_LABELS[action];
  if (!/^it[a-z0-9]+$/i.test(normalizedRemoteId)) {
    throw workflowError(
      "BAKECAINCONTRII_REMOTE_ID_INVALID",
      `Identificativo remoto Bakecaincontrii non valido: ${normalizedRemoteId || "vuoto"}.`
    );
  }
  if (!label) {
    throw workflowError("BAKECAINCONTRII_MANAGE_ACTION_INVALID", `Azione Bakecaincontrii non supportata: ${action}.`);
  }

  const managePath = `/u/post-manage/${normalizedRemoteId}/`;
  const manageUrl = `${MANAGE_BASE_URL}/${encodeURIComponent(normalizedRemoteId)}/`;
  await page.goto(manageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(750);
  await acceptAdultConsent(page);
  await page.waitForSelector('[data-testid="post-manage-content"]', { timeout: 30000 }).catch(() => null);

  let state = await inspectManagePage(page);
  if (/\/u\/login\//i.test(state.pathname)) {
    throw workflowError("BAKECAINCONTRII_SESSION_EXPIRED", "La sessione Bakecaincontrii non è più autenticata.", state);
  }
  if (action === "republish" && isRepublishConfirmed(state)) {
    return { ok: true, action, remoteId: normalizedRemoteId, alreadyCompleted: true, state };
  }
  if (action === "delete" && isDeleteConfirmed(state, managePath)) {
    return { ok: true, action, remoteId: normalizedRemoteId, alreadyCompleted: true, state };
  }
  if (!state.actionLabels.some((actionLabel) => actionLabel.toLowerCase() === label.toLowerCase())) {
    const screenshot = await captureScreenshot(page, normalizedRemoteId, `${action}-button-missing`);
    throw workflowError(
      `BAKECAINCONTRII_${action.toUpperCase()}_BUTTON_NOT_FOUND`,
      `Il pulsante ${label} non è disponibile nella pagina Gestisci annuncio Bakecaincontrii.`,
      { ...state, screenshot }
    );
  }

  let acceptedDialog = false;
  let confirmationClicked = false;
  const dialogHandler = async (dialog) => {
    acceptedDialog = true;
    await dialog.accept().catch(() => null);
  };
  page.on("dialog", dialogHandler);
  try {
    const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
    const clicked = await clickActionButton(page, label);
    if (!clicked) {
      throw workflowError(
        `BAKECAINCONTRII_${action.toUpperCase()}_CLICK_FAILED`,
        `Impossibile selezionare il pulsante ${label}.`,
        state
      );
    }

    await wait(600);
    if (!acceptedDialog) confirmationClicked = await clickVisibleConfirmation(page, action);
    await Promise.race([navigation, wait(2500)]);

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await acceptAdultConsent(page);
      if (!acceptedDialog && !confirmationClicked) {
        confirmationClicked = await clickVisibleConfirmation(page, action);
      }
      state = await inspectManagePage(page).catch(() => ({
        url: page.url(),
        pathname: (() => { try { return new URL(page.url()).pathname; } catch (_) { return ""; } })(),
        hasManageContent: false,
        actionLabels: [],
      }));
      if (/\/u\/login\//i.test(`${state.pathname || ""}`)) {
        throw workflowError("BAKECAINCONTRII_SESSION_EXPIRED", "La sessione Bakecaincontrii è scaduta durante l'operazione.", state);
      }
      if (state.errorText) break;
      const confirmed = action === "republish"
        ? isRepublishConfirmed(state)
        : isDeleteConfirmed(state, managePath);
      if (confirmed) {
        return { ok: true, action, remoteId: normalizedRemoteId, state };
      }
      await wait(500);
    }

    const screenshot = await captureScreenshot(page, normalizedRemoteId, `${action}-not-confirmed`);
    throw workflowError(
      `BAKECAINCONTRII_${action.toUpperCase()}_NOT_CONFIRMED`,
      `Bakecaincontrii non ha confermato l'azione ${label}.`,
      { ...state, screenshot }
    );
  } finally {
    page.off("dialog", dialogHandler);
  }
};

module.exports = {
  manageBakecaincontriiAd,
  isRepublishConfirmed,
  isDeleteConfirmed,
};
