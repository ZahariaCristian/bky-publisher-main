const {
  suspendPostHeader,
  suspendPostBody,
} = require("./dataComposer");
const { default: axios } = require("axios");
const logger = require("./logger");

const BASE_URL = "https://bari.bakecaincontrii.com";

const getCookie = (jHeader) => {
  var cookie = "";
  for (var key in jHeader) {
    cookie += `${key}=${jHeader[key]};`;
  }
  return cookie;
};

const suspendAdv = async (private_code, jHeader) => {
  logger.debug("Starting adv suspend");
  const firstResponse = await firstStep(private_code, jHeader);
  if (!firstResponse) {
    const error = new Error("Bakecaincontrii did not confirm the suspension.");
    error.code = "BAKECAINCONTRII_SUSPEND_NOT_CONFIRMED";
    error.stage = "suspend";
    throw error;
  }
  logger.success("Adv suspended successfully");
  return firstResponse;
};

const firstStep = async (private_code, jHeader) => {
  //Getting firstStep csrf for post request
  logger.debug("Sending suspend POST REQ");
  const REQ_RESPONSE = await axios({
    url: `${BASE_URL}/u/suspend-post/`,
    method: "POST",
    headers: suspendPostHeader(getCookie(jHeader), BASE_URL, jHeader),
    data: suspendPostBody(private_code),
  });

  if (REQ_RESPONSE.status !== 204) {
    logger.error("Error during the POST request");
    return undefined;
  }
  logger.success("Completed first-step successfully");
  return "OK";
};

module.exports = suspendAdv;

