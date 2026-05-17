const { publishAd } = require("../adsManage/megaescort/publishAds");
const { updateAd } = require("../adsManage/megaescort/updateAds");
const { suspendAds, deleteAds, republishAds } = require("../adsManage/megaescort/suspendAds");
const { getCredits } = require("../adsManage/megaescort/client");

class MeBot {
  constructor(email, apiKey, credit, platform) {
    this.email = email;
    this.password = apiKey;
    this.apiUser = email;
    this.apiKey = apiKey;
    this.credit = credit || 0;
    this.platform = platform;
    this.browser = null;
    this.page = null;
  }

  getCredential() {
    return {
      email: `${this.email || ""}`,
      password: `${this.password || ""}`
    };
  }

  async login() {
    console.log("Me-API mode: login skipped");
    return "api-session";
  }

  async restartBrowser() {
    this.browser = null;
    this.page = null;
  }

  async refresh2() {
    console.log("Me- refresh2 API");
    try {
      const result = await getCredits(this.apiKey, this.apiUser, {
        browserFallback: true
      });
      this.credit = result.credits;
      console.log("[i] Me-Credit found through API:", this.credit);
      return [this.credit, "api-session", 0];
    } catch (error) {
      console.error("Me-Error in refresh2:", error.message);
      if (/bad gateway|error code 502|\b502\b/i.test(error.message || "")) {
        console.warn("[!] Me credits endpoint returned 502. Keeping current credit and continuing API mode.");
        return [this.credit || 0, "api-session", 0];
      }
      return { error: error.message };
    }
  }

  buildPublishData(ad) {
    return {
      titolo: ad?.title || "",
      testo: ad.description || "",
      email: ad.username || this.apiUser,
      cercoamoreincontri: ad.sono || ad.categorie || "DONNAUOMO",
      contattotelefonico: ad.phone,
      tiporeply: "4",
      comune: ad.annunci_city || ad.city,
      sel_provincia: ad.location || ad.annunci_city || ad.city,
      sel_comune: "058091",
      categoria: ad.categorie || "DONNAUOMO",
      sezione: "cita",
      images: ad.pics,
      typeAnnuncio: ad.promo?.visibility || ad.typeAnnuncio,
      period: ad.promo?.schedule || ad.period || "",
      age: ad.age,
      serviceNazionalita: ad.serviceNazionalita,
      note: ad.note
    };
  }

  async publish(ad) {
    const publishData = this.buildPublishData(ad);
    return publishAd(publishData, null, {
      apiKey: this.apiKey,
      apiUser: this.apiUser
    });
  }

  async update(ad) {
    const remoteId = ad.remotePostID || await this.resolveRemoteId(ad);
    if (!remoteId) {
      throw new Error(`Me remotePostID missing for EDIT state on schedule ${ad.id}`);
    }

    ad.remotePostID = remoteId;
    const publishData = this.buildPublishData(ad);
    return updateAd(remoteId, publishData, {
      apiKey: this.apiKey,
      apiUser: this.apiUser
    });
  }

  async resolveRemoteId(ad) {
    if (ad?.remotePostID) return ad.remotePostID;
    console.warn("[!] Me remotePostID missing. API mode cannot resolve it from the panel.");
    return "";
  }

  async republish(remoteId, ad) {
    return republishAds(remoteId, ad || {}, {
      apiKey: this.apiKey,
      apiUser: this.apiUser
    });
  }

  async suspend(remoteId, ad) {
    return suspendAds(remoteId, ad || {}, {
      apiKey: this.apiKey,
      apiUser: this.apiUser
    });
  }

  async delete(remoteId) {
    return deleteAds(remoteId, this.apiUser, {
      apiKey: this.apiKey,
      apiUser: this.apiUser
    });
  }
}

module.exports = MeBot;
