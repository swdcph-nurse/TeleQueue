/**
 * config.js - Configuration settings for TeleQueue
 */
const CONFIG = {
  APP_NAME: "TeleQueue",
  WARD_NAME: "ตึกพิเศษปาริฉัตร - หอสงฆ์อาพาธ",
  SPREADSHEET_ID: "1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE",
  GITHUB_REPO_URL: "https://github.com/swdcph-nurse/TeleQueue",
  
  // URL เริ่มต้นของ Google Apps Script Web App (ใส่ไว้ตรงนี้เพื่อให้ผู้ใช้คนอื่นที่เปิดเว็บเชื่อมต่อชีตได้ทันที)
  DEFAULT_GAS_URL: "https://script.google.com/macros/s/AKfycbzcwZZKpFJyML3lH-Zp1LVvXdf6bVGCm4BIUsyTfNxHA0GabAd81a4fGv6V_n2iEyvg/exec",
  
  // แผนกที่นัดหมายทั้งหมด
  DEPARTMENTS: [
    "อายุรกรรมทั่วไป",
    "อายุรกรรมมะเร็ง",
    "ศัลยกรรมทั่วไป",
    "ออร์โธปิดิกส์",
    "สูติ-นรีเวช",
    "กุมารเวชกรรม",
    "จักษุ",
    "โสต ศอ นาสิก"
  ],
  
  // LocalStorage keys
  STORAGE_KEYS: {
    GAS_URL: "TELEQUEUE_GAS_URL",
    SHEET_NAME: "TELEQUEUE_SHEET_NAME",
    OPERATOR_NAME: "TELEQUEUE_CURRENT_OPERATOR",
    LINE_TOKEN: "TELEQUEUE_LINE_TOKEN",
    LINE_GROUP_ID: "TELEQUEUE_LINE_GROUP_ID",
    LOCAL_CACHE: "TELEQUEUE_APPOINTMENTS_CACHE",
    LAST_SYNC: "TELEQUEUE_LAST_SYNC_TIME"
  },

  // ดึงค่า URL ของ Google Apps Script Web App
  getGasUrl: function() {
    return localStorage.getItem(this.STORAGE_KEYS.GAS_URL) || this.DEFAULT_GAS_URL || "";
  },

  setGasUrl: function(url) {
    localStorage.setItem(this.STORAGE_KEYS.GAS_URL, (url || "").trim());
  },

  // ชื่อแผ่นงาน (Sheet Tab Name)
  getSheetName: function() {
    return localStorage.getItem(this.STORAGE_KEYS.SHEET_NAME) || "";
  },

  setSheetName: function(name) {
    localStorage.setItem(this.STORAGE_KEYS.SHEET_NAME, (name || "").trim());
  },

  // ผู้ดำเนินการปัจจุบัน (ชื่อพยาบาล / เจ้าหน้าที่)
  getCurrentOperator: function() {
    return localStorage.getItem(this.STORAGE_KEYS.OPERATOR_NAME) || "พยาบาลเวรปาริฉัตร";
  },

  setCurrentOperator: function(name) {
    localStorage.setItem(this.STORAGE_KEYS.OPERATOR_NAME, (name || "").trim());
  },

  // ค่า LINE เดิมที่เคยเก็บไว้ในเครื่อง (ใช้เพื่อย้ายขึ้นเซิร์ฟเวอร์ครั้งเดียวเท่านั้น)
  // ปัจจุบัน Token / Destination ID เก็บกลางที่ Google Apps Script ใช้ร่วมกันทุกเครื่อง
  getLegacyLineConfig: function() {
    return {
      token: localStorage.getItem(this.STORAGE_KEYS.LINE_TOKEN) || "",
      groupId: localStorage.getItem(this.STORAGE_KEYS.LINE_GROUP_ID) || ""
    };
  },

  clearLegacyLineConfig: function() {
    localStorage.removeItem(this.STORAGE_KEYS.LINE_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.LINE_GROUP_ID);
  }
};

window.CONFIG = CONFIG;
