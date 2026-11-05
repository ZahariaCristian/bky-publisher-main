const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isRepublishConfirmed,
  isDeleteConfirmed,
} = require("../adsManage/bakecaincontrii/manageAds");

test("confirms Bakecaincontrii republish only after the manage page reports an active ad", () => {
  assert.equal(isRepublishConfirmed({
    hasManageContent: true,
    notFound: false,
    statusText: "Pubblicato",
    actionLabels: ["Sospendi", "Elimina"],
  }), true);
  assert.equal(isRepublishConfirmed({
    hasManageContent: true,
    notFound: false,
    statusText: "Non pubblicato",
    actionLabels: ["Pubblica", "Elimina"],
  }), false);
});

test("confirms Bakecaincontrii deletion only after removal evidence", () => {
  const managePath = "/u/post-manage/it123/";
  assert.equal(isDeleteConfirmed({
    pathname: managePath,
    hasManageContent: true,
    notFound: false,
    deletedText: false,
  }, managePath), false);
  assert.equal(isDeleteConfirmed({
    pathname: "/u/account/dashboard/",
    hasManageContent: false,
    notFound: false,
    deletedText: false,
  }, managePath), true);
  assert.equal(isDeleteConfirmed({
    pathname: managePath,
    hasManageContent: false,
    notFound: true,
    deletedText: false,
  }, managePath), true);
});
