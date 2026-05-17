const path = require("path");

const ADSPEED_STAGING_BASE_URL = "https://mega.3590edafb1833fedd78135b343b5f931b4273aec.xyz";
const ADSPEED_PRODUCTION_BASE_URL = "https://megaescort.info";
const ADSPEED_USER_PATH = "/api/adspeed_user/adspeed_user";
const ADSPEED_CREDITS_PATH = "/api/adspeed/credits";
const ADSPEED_AD_PATH = "/api/adspeed/ad";

const COOKIE_FILE = path.join(__dirname, "adspeed-cookies.json");
const API_KEY_FILE = path.join(__dirname, "adspeed-api-key.json");

const DEFAULT_PROXY = "81.180.80.13:12323:14aac7af0c72b:f8f3c0a82d";
const DEFAULT_API_USER = "infinityweb.srls@gmail.com";
const DEFAULT_BASIC_AUTH = {
    username: "raffaele",
    password: "1wBm19wgg\\23"
};

module.exports = {
    ADSPEED_STAGING_BASE_URL,
    ADSPEED_PRODUCTION_BASE_URL,
    ADSPEED_USER_PATH,
    ADSPEED_CREDITS_PATH,
    ADSPEED_AD_PATH,
    COOKIE_FILE,
    API_KEY_FILE,
    DEFAULT_PROXY,
    DEFAULT_API_USER,
    DEFAULT_BASIC_AUTH
};
