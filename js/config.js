/**
 * config.js - Configuration settings for TeleQueue
 */
const CONFIG = {
  APP_NAME: "TeleQueue",
  WARD_NAME: "ตึกพิเศษปาริฉัตร - หอสงฆ์อาพาธ",
  SPREADSHEET_ID: "1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE",
  GITHUB_REPO_URL: "https://github.com/swdcph-nurse/TeleQueue",
  
  // LocalStorage keys
  STORAGE_KEYS: {
    GAS_URL: "TELEQUEUE_GAS_URL",
    OPERATOR_NAME: "TELEQUEUE_CURRENT_OPERATOR",
    LINE_TOKEN: "TELEQUEUE_LINE_TOKEN",
    LINE_GROUP_ID: "TELEQUEUE_LINE_GROUP_ID",
    LOCAL_CACHE: "TELEQUEUE_APPOINTMENTS_CACHE",
    LAST_SYNC: "TELEQUEUE_LAST_SYNC_TIME"
  },

  // ดึงค่า URL ของ Google Apps Script Web App
  getGasUrl: function() {
    return localStorage.getItem(this.STORAGE_KEYS.GAS_URL) || "";
  },

  setGasUrl: function(url) {
    localStorage.setItem(this.STORAGE_KEYS.GAS_URL, (url || "").trim());
  },

  // ผู้ดำเนินการปัจจุบัน (ชื่อพยาบาล / เจ้าหน้าที่)
  getCurrentOperator: function() {
    return localStorage.getItem(this.STORAGE_KEYS.OPERATOR_NAME) || "พยาบาลเวรปาริฉัตร";
  },

  setCurrentOperator: function(name) {
    localStorage.setItem(this.STORAGE_KEYS.OPERATOR_NAME, (name || "").trim());
  },

  // ค่า LINE Token และ Destination ID
  getLineConfig: function() {
    return {
      token: localStorage.getItem(this.STORAGE_KEYS.LINE_TOKEN) || "",
      groupId: localStorage.getItem(this.STORAGE_KEYS.LINE_GROUP_ID) || ""
    };
  },

  setLineConfig: function(token, groupId) {
    if (token !== undefined) localStorage.setItem(this.STORAGE_KEYS.LINE_TOKEN, token.trim());
    if (groupId !== undefined) localStorage.setItem(this.STORAGE_KEYS.LINE_GROUP_ID, groupId.trim());
  }
};

window.CONFIG = CONFIG;
