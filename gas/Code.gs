/**
 * =========================================================================
 * TeleQueue - Google Apps Script Backend & LINE Messaging API Notification
 * ระบบบันทึกนัด Telemed ผู้ป่วย หอผู้ป่วยพิเศษปาริฉัตร-หอสงฆ์อาพาธ
 * Google Sheet ID: 1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE
 * =========================================================================
 */

// ค่าเริ่มต้นระบบ (สามารถแก้ไขผ่าน Script Properties หรือหน้าตั้งค่าได้)
var DEFAULT_SPREADSHEET_ID = "1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE";
var DEFAULT_SHEET_NAME = ""; // ระบุชื่อแผ่นงานเฉพาะ (เช่น "Sheet1", "รายการนัด") หากเว้นว่างไว้ ระบบจะค้นหาแผ่นงานที่มีข้อมูลนัดให้อัตโนมัติ
var ADMIN_LINE_ID = "Ucf411d16405ac9fccf7a87848a8208dc"; // LINE UID ของแอดมินสำหรับรับการแจ้งเตือนเมื่อมีนัดใหม่
var HEADER_ROW_INDEX = 2; // แถวหัวตาราง (วันนัด, ชื่อ-สกุล, ...)
var DATA_START_ROW = 3;   // แถวเริ่มต้นข้อมูล

// ดึงการตั้งค่าจาก ScriptProperties หรือค่า Default
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID,
    sheetName: props.getProperty("SHEET_NAME") || DEFAULT_SHEET_NAME,
    lineChannelAccessToken: props.getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "",
    lineDestinationId: props.getProperty("LINE_DESTINATION_ID") || "", // Group ID หรือ User ID สำหรับการแจ้งเตือนประจำวันในกลุ่ม
    adminLineId: props.getProperty("ADMIN_LINE_ID") || ADMIN_LINE_ID, // LINE UID แอดมินสำหรับเตือนเมื่อมีนัดใหม่
    appUrl: props.getProperty("APP_URL") || "https://swdcph-nurse.github.io/TeleQueue/",
    autoReminderHour: parseInt(props.getProperty("REMINDER_HOUR") || "8", 10) // 8:00 AM
  };
}

/**
 * ดึง Sheet ทำงาน (พร้อมระบบตรวจจับแผ่นงานข้อมูลนัดหมายอัตโนมัติ ป้องกันปัญหาเมื่อมีแผ่นงาน Home หรืออื่นๆ เพิ่มเข้ามา)
 */
function getTargetSheet() {
  var config = getConfig();
  var ss;
  try {
    ss = config.spreadsheetId ? SpreadsheetApp.openById(config.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  // 1. ถ้ามีการระบุ sheetName ให้ใช้แผ่นงานตามชื่อนั้นก่อน
  if (config.sheetName) {
    var s = ss.getSheetByName(config.sheetName);
    if (s) return s;
  }
  
  var sheets = ss.getSheets();
  if (sheets.length === 1) return sheets[0];

  // 2. ค้นหาแผ่นงานที่มีหัวตารางข้อมูลนัดหมาย (มีคำว่า วันนัด, ชื่อ, หรือ HN) โดยข้ามแผ่นงาน Home / สรุป
  for (var i = 0; i < sheets.length; i++) {
    var cur = sheets[i];
    var sName = cur.getName().trim().toLowerCase();
    if (sName === "home" || sName === "dashboard" || sName === "หน้าแรก" || sName === "สรุป") {
      continue;
    }
    var lastRow = cur.getLastRow();
    var lastCol = cur.getLastColumn();
    if (lastRow >= 2 && lastCol >= 2) {
      try {
        var hValues = cur.getRange(HEADER_ROW_INDEX, 1, 1, Math.min(lastCol, 10)).getValues()[0];
        var hStr = hValues.join(" ");
        if (hStr.indexOf("วัน") !== -1 || hStr.indexOf("ชื่อ") !== -1 || hStr.indexOf("HN") !== -1) {
          return cur;
        }
      } catch (e) {}
    }
  }

  // 3. ถ้าไม่พบตามเงื่อนไข ให้ใช้แผ่นงานแรกที่ไม่ใช่ชื่อ Home / Dashboard
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName().trim().toLowerCase();
    if (name !== "home" && name !== "dashboard" && name !== "หน้าแรก") {
      return sheets[j];
    }
  }

  // 4. Fallback สุดท้าย: แผ่นงานแรกสุด
  return sheets[0];
}

/**
 * แปลงวันที่เป็น YYYY-MM-DD แบบ ค.ศ. สากล (แก้ปัญหาปี พ.ศ. 2568/2569 และข้อผิดพลาดปี 1968/1969)
 */
function normalizeDate(rawDate) {
  if (!rawDate) return "";
  
  // กรณีเป็น Date object ของ GAS
  if (Object.prototype.toString.call(rawDate) === "[object Date]") {
    if (isNaN(rawDate.getTime())) return "";
    var year = rawDate.getFullYear();
    if (year > 2400) year -= 543;
    if (year >= 1960 && year <= 1975) year += 58; // 1968 + 58 = 2026
    var m = String(rawDate.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var d = String(rawDate.getDate());
    if (d.length < 2) d = "0" + d;
    return year + "-" + m + "-" + d;
  }
  
  var str = String(rawDate).trim();
  var match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    var y = parseInt(match[1], 10);
    var month = String(parseInt(match[2], 10));
    if (month.length < 2) month = "0" + month;
    var day = String(parseInt(match[3], 10));
    if (day.length < 2) day = "0" + day;
    
    if (y > 2400) {
      y -= 543;
    } else if (y >= 1960 && y <= 1975) {
      y = y + 57;
    }
    return y + "-" + month + "-" + day;
  }
  
  return str;
}

/**
 * แปลงวันที่ ค.ศ. สากลให้เป็นวันที่แสดงผลภาษาไทย (เช่น 21 พ.ย. 2569)
 */
function formatThaiDate(isoDateStr) {
  if (!isoDateStr) return "-";
  var parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  var y = parseInt(parts[0], 10) + 543;
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  var thaiMonths = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return d + " " + (thaiMonths[m] || m) + " " + y;
}

/**
 * ตรวจสอบและเตรียมคอลัมน์พิเศษเพิ่มเติม (ไม่กระทบคอลัมน์เดิม A-M)
 */
function ensureExtraHeaders(sheet) {
  var headerRange = sheet.getRange(HEADER_ROW_INDEX, 1, 1, Math.max(sheet.getLastColumn(), 18));
  var headers = headerRange.getValues()[0];
  var requiredExtras = [
    { col: 14, title: "ผู้ดำเนินการโทร" },
    { col: 15, title: "วันเวลาโทร" },
    { col: 16, title: "ผู้ดำเนินการ HosXP" },
    { col: 17, title: "วันเวลา HosXP" },
    { col: 18, title: "แจ้งเตือน LINE" }
  ];
  
  for (var i = 0; i < requiredExtras.length; i++) {
    var item = requiredExtras[i];
    if (!headers[item.col - 1] || headers[item.col - 1].toString().trim() === "") {
      sheet.getRange(HEADER_ROW_INDEX, item.col).setValue(item.title);
    }
  }
}

/**
 * ดึงรายการนัดหมายทั้งหมด
 */
function getAllAppointments() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return [];
  }
  
  ensureExtraHeaders(sheet);
  var lastCol = Math.max(sheet.getLastColumn(), 18);
  var numRows = lastRow - DATA_START_ROW + 1;
  var values = sheet.getRange(DATA_START_ROW, 1, numRows, lastCol).getValues();
  
  var appointments = [];
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowIndex = DATA_START_ROW + i;
    
    var patientName = (row[1] || "").toString().trim();
    var hn = (row[3] || "").toString().trim();
    var rawDate = row[0];
    
    // ข้ามแถวว่าง
    if (!patientName && !hn && !rawDate) {
      continue;
    }
    
    var isoDate = normalizeDate(rawDate);
    
    var tele = (row[9] === true || String(row[9]).toLowerCase() === "true");
    var hosxp = (row[10] === true || String(row[10]).toLowerCase() === "true");
    var moph = (row[11] === true || String(row[11]).toLowerCase() === "true");
    var checkMoph = (row[12] === true || String(row[12]).toLowerCase() === "true");
    
    appointments.push({
      rowIndex: rowIndex,
      rawDate: rawDate instanceof Date ? rawDate.toISOString() : String(rawDate),
      date: isoDate,
      thaiDate: formatThaiDate(isoDate),
      name: patientName,
      cid: (row[2] || "").toString().trim(),
      hn: hn,
      department: (row[4] || "").toString().trim(),
      doctor: (row[5] || "").toString().trim(),
      phone: (row[6] || "").toString().trim(),
      lineName: (row[7] || "").toString().trim(),
      notes: (row[8] || "").toString().trim(),
      tele: tele,
      hosxp: hosxp,
      moph: moph,
      checkMoph: checkMoph,
      teleOperator: (row[13] || "").toString().trim(),
      teleTime: row[14] instanceof Date ? Utilities.formatDate(row[14], "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss") : (row[14] || "").toString(),
      hosOperator: (row[15] || "").toString().trim(),
      hosTime: row[16] instanceof Date ? Utilities.formatDate(row[16], "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss") : (row[16] || "").toString(),
      lineNotified: (row[17] === true || String(row[17]).toLowerCase() === "true" || !!row[17])
    });
  }
  
  return appointments;
}

/**
 * ดึงรายการนัดหมายสำหรับวันที่ระบุ (หรือวันนี้)
 */
function getAppointmentsByDate(targetDateIso) {
  var dateQuery = targetDateIso;
  if (!dateQuery) {
    var today = new Date();
    dateQuery = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  }
  
  var all = getAllAppointments();
  var filtered = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].date === dateQuery) {
      filtered.push(all[i]);
    }
  }
  return filtered;
}

/**
 * ค้นหาแถวว่างแถวแรกสำหรับบันทึกข้อมูลใหม่
 * (แก้ปัญหาใน Google Sheets ที่มีแถวเปล่าที่ติด Checkbox False ค้างอยู่ด้านล่างหลายร้อยแถว)
 */
function findNextAvailableRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return DATA_START_ROW;
  
  var numRows = lastRow - DATA_START_ROW + 1;
  // อ่านเฉพาะคอลัมน์ B (ชื่อ-สกุล) และคอลัมน์ D (HN)
  var names = sheet.getRange(DATA_START_ROW, 2, numRows, 1).getValues();
  var hns = sheet.getRange(DATA_START_ROW, 4, numRows, 1).getValues();
  
  for (var i = 0; i < names.length; i++) {
    var nameVal = String(names[i][0] || "").trim();
    var hnVal = String(hns[i][0] || "").trim();
    // ถ้าชื่อและ HN ว่าง แสดงว่าเป็นแถวว่างพร้อมเขียนข้อมูล
    if (!nameVal && !hnVal) {
      return DATA_START_ROW + i;
    }
  }
  
  return lastRow + 1;
}

/**
 * เพิ่มนัดหมายใหม่
 */
function addAppointment(data) {
  var sheet = getTargetSheet();
  ensureExtraHeaders(sheet);
  
  var nextRow = findNextAvailableRow(sheet);
  var dateVal = data.date || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  
  var newRow = [
    dateVal,
    data.name || "",
    data.cid || "",
    data.hn || "",
    data.department || "",
    data.doctor || "",
    data.phone || "",
    data.lineName || "",
    data.notes || "",
    (data.tele === true || data.tele === "true"),
    (data.hosxp === true || data.hosxp === "true"),
    (data.moph === true || data.moph === "true"),
    (data.checkMoph === true || data.checkMoph === "true"),
    data.teleOperator || "",
    data.teleTime || "",
    data.hosOperator || "",
    data.hosTime || "",
    false // lineNotified
  ];
  
  sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
  
  // แจ้งเตือนแอดมินเมื่อมีคิวนัดหมายใหม่ (ส่งไปยัง Admin UID: Ucf411d16405ac9fccf7a87848a8208dc)
  var adminNotifyRes = null;
  try {
    adminNotifyRes = notifyAdminNewAppointment(data);
  } catch (errAdmin) {
    Logger.log("ไม่สามารถส่งแจ้งเตือนแอดมิน: " + errAdmin.toString());
  }
  
  return {
    success: true,
    message: "บันทึกข้อมูลนัดหมายใหม่ลงแถวที่ " + nextRow + " เรียบร้อยแล้ว",
    rowIndex: nextRow,
    adminNotified: (adminNotifyRes && adminNotifyRes.success),
    data: newRow
  };
}

/**
 * อัปเดตข้อมูลนัดหมาย
 */
function updateAppointment(data) {
  var sheet = getTargetSheet();
  ensureExtraHeaders(sheet);
  
  var rowIndex = parseInt(data.rowIndex, 10);
  if (!rowIndex || rowIndex < DATA_START_ROW) {
    throw new Error("หมายเลขแถว (rowIndex) ไม่ถูกต้อง: " + data.rowIndex);
  }
  
  var currentValues = sheet.getRange(rowIndex, 1, 1, 18).getValues()[0];
  
  if (data.date !== undefined) currentValues[0] = data.date;
  if (data.name !== undefined) currentValues[1] = data.name;
  if (data.cid !== undefined) currentValues[2] = data.cid;
  if (data.hn !== undefined) currentValues[3] = data.hn;
  if (data.department !== undefined) currentValues[4] = data.department;
  if (data.doctor !== undefined) currentValues[5] = data.doctor;
  if (data.phone !== undefined) currentValues[6] = data.phone;
  if (data.lineName !== undefined) currentValues[7] = data.lineName;
  if (data.notes !== undefined) currentValues[8] = data.notes;
  
  if (data.tele !== undefined) {
    var isTele = (data.tele === true || data.tele === "true");
    currentValues[9] = isTele;
    if (isTele) {
      if (data.operator) currentValues[13] = data.operator;
      currentValues[14] = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    }
  }
  
  if (data.hosxp !== undefined) {
    var isHosxp = (data.hosxp === true || data.hosxp === "true");
    currentValues[10] = isHosxp;
    if (isHosxp) {
      if (data.operator) currentValues[15] = data.operator;
      currentValues[16] = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    }
  }
  
  if (data.moph !== undefined) currentValues[11] = (data.moph === true || data.moph === "true");
  if (data.checkMoph !== undefined) currentValues[12] = (data.checkMoph === true || data.checkMoph === "true");
  if (data.lineNotified !== undefined) currentValues[17] = data.lineNotified;
  
  sheet.getRange(rowIndex, 1, 1, currentValues.length).setValues([currentValues]);
  
  return {
    success: true,
    message: "อัปเดตข้อมูลสำเร็จ",
    rowIndex: rowIndex
  };
}

/**
 * ลบนัดหมาย
 */
function deleteAppointment(rowIndex) {
  var sheet = getTargetSheet();
  var row = parseInt(rowIndex, 10);
  if (!row || row < DATA_START_ROW) {
    throw new Error("หมายเลขแถวไม่ถูกต้อง: " + rowIndex);
  }
  
  sheet.deleteRow(row);
  return {
    success: true,
    message: "ลบรายการแถวที่ " + row + " เรียบร้อยแล้ว"
  };
}

/**
 * ส่งแจ้งเตือนแอดมินเมื่อมีคิวนัดหมายใหม่ (Admin UID: Ucf411d16405ac9fccf7a87848a8208dc)
 */
function notifyAdminNewAppointment(data) {
  var config = getConfig();
  var accessToken = sanitizeLineToken(config.lineChannelAccessToken);
  var adminId = String(config.adminLineId || ADMIN_LINE_ID).trim();
  
  if (!accessToken) {
    Logger.log("แจ้งเตือนแอดมินข้ามไป: ยังไม่ได้ระบุ LINE Access Token");
    return { success: false, message: "No LINE Access Token configured" };
  }
  if (!adminId) {
    Logger.log("แจ้งเตือนแอดมินข้ามไป: ยังไม่ได้ระบุ Admin LINE ID");
    return { success: false, message: "No Admin LINE ID configured" };
  }
  
  var rawDate = data.date || new Date();
  var isoDate = normalizeDate(rawDate);
  var thaiDate = formatThaiDate(isoDate);
  var appUrl = config.appUrl || "https://swdcph-nurse.github.io/TeleQueue/";
  var cleanPhone = data.phone ? String(data.phone).replace(/[^0-9]/g, "") : "";
  
  var phoneBox = {
    type: "box",
    layout: "baseline",
    margin: "xs",
    contents: [
      { type: "text", text: "เบอร์โทร:", size: "xs", color: "#64748b", flex: 2 }
    ]
  };

  if (cleanPhone.length >= 9) {
    phoneBox.contents.push({
      type: "text",
      text: String(data.phone),
      size: "xs",
      weight: "bold",
      color: "#059669",
      action: {
        type: "uri",
        uri: "tel:" + cleanPhone
      },
      flex: 4
    });
  } else {
    phoneBox.contents.push({
      type: "text",
      text: data.phone ? String(data.phone) : "ไม่มีเบอร์โทร",
      size: "xs",
      weight: "bold",
      color: data.phone ? "#334155" : "#dc2626",
      flex: 4
    });
  }

  var flexMessage = {
    type: "flex",
    altText: "🔔 มีการเพิ่มคิวนัด Telemed ใหม่: " + (data.name || "ผู้ป่วย") + " นัดวันที่ " + thaiDate,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0ea5e9",
        paddingTop: "14px",
        paddingBottom: "14px",
        contents: [
          {
            type: "text",
            text: "🏥 ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ",
            color: "#ffffff",
            weight: "bold",
            size: "sm"
          },
          {
            type: "text",
            text: "✨ มีการเพิ่มคิวนัด TELEMED ใหม่!",
            color: "#f0fdf4",
            weight: "bold",
            size: "xs",
            margin: "xs"
          },
          {
            type: "text",
            text: "🗓 วันนัด: " + thaiDate,
            color: "#fef08a",
            weight: "bold",
            size: "xs",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "vertical",
            paddingAll: "10px",
            backgroundColor: "#f8fafc",
            cornerRadius: "8px",
            borderColor: "#e2e8f0",
            borderWidth: "1px",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: data.name || "ไม่ระบุชื่อ",
                    weight: "bold",
                    size: "sm",
                    color: "#0f172a",
                    flex: 4
                  },
                  {
                    type: "text",
                    text: data.department ? "[" + data.department + "]" : "",
                    size: "xs",
                    color: "#0284c7",
                    align: "end",
                    weight: "bold",
                    flex: 2
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "HN:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.hn || "-", size: "xs", weight: "bold", color: "#0f172a", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "เลข ปชช:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.cid || "-", size: "xs", color: "#334155", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "แพทย์:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.doctor || "-", size: "xs", color: "#334155", flex: 4 }
                ]
              },
              phoneBox,
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "Line:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.lineName || "-", size: "xs", color: "#475569", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "นัดเพื่อ:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.notes || "ติดตามอาการ", size: "xs", color: "#475569", wrap: true, flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "ผู้บันทึก:", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: data.operator || "เจ้าหน้าที่", size: "xs", color: "#0284c7", weight: "bold", flex: 4 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#0284c7",
            height: "sm",
            action: {
              type: "uri",
              label: "📋 เปิดดูใน TeleQueue",
              uri: appUrl
            }
          }
        ]
      }
    }
  };

  var url = "https://api.line.me/v2/bot/message/push";
  var payload = {
    to: adminId,
    messages: [flexMessage]
  };

  var options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var body = res.getContentText();
  
  if (code === 200) {
    Logger.log("✅ ส่งแจ้งเตือนคิวใหม่ไปยังแอดมินเรียบร้อย (" + adminId + ")");
    return { success: true };
  } else {
    Logger.log("⚠️ ส่งแจ้งเตือนแอดมินไม่สำเร็จ (" + code + "): " + body);
    return { success: false, message: body };
  }
}

/**
 * ฟังก์ชันตัดช่องว่างและเครื่องหมายคำพูดของ Token
 */
function sanitizeLineToken(rawToken) {
  if (!rawToken) return "";
  var token = String(rawToken).trim();
  token = token.replace(/^Bearer\s+/i, "").trim();
  token = token.replace(/^["']|["']$/g, "").trim();
  return token;
}

/**
 * =========================================================================
 * LINE Notification System (LINE Messaging API)
 * =========================================================================
 */

/**
 * ส่ง LINE Flex Message แจ้งเตือนรายการนัดวันนี้
 */
function sendDailyLineNotification(forceSend, overrideConfig) {
  var config = getConfig();
  
  var overrideToken = (overrideConfig && overrideConfig.lineChannelAccessToken) ? overrideConfig.lineChannelAccessToken : "";
  var overrideDest = (overrideConfig && overrideConfig.lineDestinationId) ? overrideConfig.lineDestinationId : "";
  
  var accessToken = sanitizeLineToken(overrideToken || config.lineChannelAccessToken);
  var destinationId = String(overrideDest || config.lineDestinationId || "").trim();
  
  if (!accessToken) {
    return {
      success: false,
      message: "ยังไม่ได้ระบุ LINE Channel Access Token ในการตั้งค่า"
    };
  }

  // ป้องกันกรณีผู้ใช้นำ Channel Secret (32 ตัวอักษร) มาใส่แทน Access Token (170+ ตัวอักษร)
  if (accessToken.length <= 40) {
    throw new Error("Token สั้นเกินไป (" + accessToken.length + " ตัวอักษร) ซึ่งน่าจะเป็น Channel Secret กรุณาใช้ Channel access token (long-lived) จากแท็บ Messaging API ใน LINE Developers");
  }

  if (!destinationId) {
    return {
      success: false,
      message: "ยังไม่ได้ระบุ LINE Destination ID (Group ID หรือ User ID)"
    };
  }

  // ตรวจสอบรูปแบบของ Destination ID (ต้องขึ้นต้นด้วย U, C หรือ R ตามด้วยตัวเลข/ตัวอักษร 32 ตัว)
  var isLineIdPattern = /^[URC][0-9a-zA-Z]{32}$/.test(destinationId);
  if (!isLineIdPattern) {
    throw new Error(
      "LINE Destination ID ไม่ถูกต้อง: \"" + destinationId + "\"\n\n" +
      "⚠️ ข้อสังเกตสำคัญ:\n" +
      "1. ช่องนี้ต้องเป็น 'Group ID' (ขึ้นต้นด้วยตัว C ตามด้วยตัวอักษร 32 ตัว เช่น C8d1f2a34b5...)\n" +
      "   หรือเป็น 'User ID' (ขึ้นต้นด้วยตัว U ตามด้วยตัวอักษร 32 ตัว เช่น U1a2b3c4d5...)\n" +
      "2. ไม่สามารถใช้ 'ชื่อกลุ่ม LINE', 'ลิงก์เชิญกลุ่ม' หรือ 'LINE ID / @ID' ได้\n" +
      "3. บอท LINE Official Account จะต้องถูกเชิญเข้ากลุ่ม LINE นั้นแล้ว จึงจะสามารถส่งข้อความได้"
    );
  }
  
  var today = new Date();
  var todayIso = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  var thaiDateStr = formatThaiDate(todayIso);
  
  var allAppointments = getAllAppointments();
  
  // กรองผู้ป่วยที่นัดวันนี้ และยังไม่ได้โทร (tele == false)
  var pendingAppointments = [];
  for (var i = 0; i < allAppointments.length; i++) {
    var item = allAppointments[i];
    if (item.date !== todayIso) continue;
    if (item.tele === true) continue; // ข้ามรายที่โทรแล้ว
    if (!forceSend && item.lineNotified === true) continue; // ป้องกันส่งซ้ำ
    pendingAppointments.push(item);
  }
  
  if (pendingAppointments.length === 0) {
    return {
      success: true,
      count: 0,
      message: "ไม่มีรายการนัดที่ต้องโทรแจ้งเตือนสำหรับวันนี้ (" + thaiDateStr + ") หรือได้ส่งแจ้งเตือนครบแล้ว"
    };
  }
  
  // สร้าง LINE Flex Message
  var flexMessage = buildTelemedFlexMessage(pendingAppointments, thaiDateStr, config.appUrl);
  
  // ส่ง Push Message ผ่าน LINE Messaging API
  var url = "https://api.line.me/v2/bot/message/push";
  var payload = {
    to: destinationId,
    messages: [flexMessage]
  };
  
  var options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();
  
  if (responseCode === 200) {
    var sheet = getTargetSheet();
    for (var j = 0; j < pendingAppointments.length; j++) {
      sheet.getRange(pendingAppointments[j].rowIndex, 18).setValue(true); // Col R: บันทึกว่าแจ้งเตือนแล้ว
    }
    
    return {
      success: true,
      count: pendingAppointments.length,
      message: "ส่งแจ้งเตือนไปยัง LINE เรียบร้อยแล้ว จำนวน " + pendingAppointments.length + " ท่าน"
    };
  } else {
    var errDetail = responseBody;
    try {
      var parsed = JSON.parse(responseBody);
      if (responseCode === 401) {
        errDetail = "Token ไม่ถูกต้อง (401 Unauthorized): " + (parsed.message || "") + " กรุณาตรวจสอบ Channel access token";
      } else if (responseCode === 400) {
        var detailMsg = parsed.message || "";
        if (parsed.details && parsed.details.length > 0) {
          var dList = [];
          for (var k = 0; k < parsed.details.length; k++) {
            var item = parsed.details[k];
            dList.push((item.property ? item.property + ": " : "") + item.message);
          }
          detailMsg += " [" + dList.join(", ") + "]";
        }
        var tip = "";
        if (destinationId.indexOf("U") === 0) {
          tip = "\n\n💡 สาเหตุสำหรับ User ID (UID):\n1. คุณต้องกด 'เพิ่มเพื่อน' (Add Friend) กับบอทตัวนี้ในแอป LINE ก่อน บอทจึงจะส่งข้อความหาได้\n2. ต้องเป็น UID จริงจากหน้า LINE Developers (แท็บ Basic settings > Your user ID) ภายใต้ Provider เดียวกันกับบอท";
        } else if (destinationId.indexOf("C") === 0) {
          tip = "\n\n💡 สาเหตุสำหรับ Group ID:\nบอทตัวนี้ต้องถูก 'เชิญเข้ากลุ่ม LINE' แล้วเท่านั้น จึงจะมีสิทธิ์ส่งข้อความเข้ากลุ่ม";
        }
        errDetail = "คำขอไม่ถูกต้อง (400 Bad Request): " + detailMsg + tip;
      }
    } catch (e) {}
    throw new Error("LINE API Error (" + responseCode + "): " + errDetail);
  }
}

/**
 * ฟังก์ชันส่งข้อความทดสอบแบบ Text ธรรมดา (สำหรับเช็คว่า Token และ Group ID ส่งถึงจริง)
 */
function sendTestLineMessage(overrideConfig) {
  var config = getConfig();
  var overrideToken = (overrideConfig && overrideConfig.lineChannelAccessToken) ? overrideConfig.lineChannelAccessToken : "";
  var overrideDest = (overrideConfig && overrideConfig.lineDestinationId) ? overrideConfig.lineDestinationId : "";
  
  var accessToken = sanitizeLineToken(overrideToken || config.lineChannelAccessToken);
  var destinationId = String(overrideDest || config.lineDestinationId || "").trim();
  
  if (!accessToken) throw new Error("ยังไม่ได้ระบุ Token");
  if (!destinationId) throw new Error("ยังไม่ได้ระบุ Destination ID");

  var url = "https://api.line.me/v2/bot/message/push";
  var payload = {
    to: destinationId,
    messages: [
      {
        type: "text",
        text: "🔔 ทดสอบการแจ้งเตือนจากระบบ TeleQueue\nหอผู้ป่วยพิเศษปาริฉัตร-หอสงฆ์อาพาธ\nการเชื่อมต่อระหว่าง Google Sheets และ LINE สำเร็จสมบูรณ์แล้วครับ! 🎉"
      }
    ]
  };

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code === 200) {
    return { success: true, message: "ส่งข้อความทดสอบสำเร็จ! ตรวจสอบข้อความในกลุ่ม LINE ได้เลยครับ" };
  } else {
    var tip = "";
    if (destinationId.indexOf("U") === 0) {
      tip = " (ข้อสังเกต: สำหรับ User ID ต้องกดเพิ่มเพื่อนกับบอทในแอป LINE ก่อนจึงจะส่งได้)";
    } else if (destinationId.indexOf("C") === 0) {
      tip = " (ข้อสังเกต: สำหรับ Group ID ต้องเชิญบอทเข้ากลุ่มก่อน)";
    }
    throw new Error("ส่งข้อความทดสอบไม่สำเร็จ (" + code + "): " + body + tip);
  }
}

/**
 * ทดสอบความถูกต้องของ LINE Channel Access Token
 */
function testLineToken(testToken) {
  var token = sanitizeLineToken(testToken || getConfig().lineChannelAccessToken);
  if (!token) {
    return { success: false, message: "ยังไม่ได้ระบุ Token" };
  }
  
  var url = "https://api.line.me/v2/bot/info";
  var options = {
    method: "get",
    headers: {
      "Authorization": "Bearer " + token
    },
    muteHttpExceptions: true
  };
  
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var body = res.getContentText();
  
  if (code === 200) {
    var info = JSON.parse(body);
    return {
      success: true,
      botName: info.displayName,
      botId: info.basicId,
      message: "Token ถูกต้อง! เชื่อมต่อกับบอท \"" + info.displayName + "\" (" + info.basicId + ") สำเร็จ"
    };
  } else {
    return {
      success: false,
      statusCode: code,
      message: "ทดสอบ Token ไม่สำเร็จ (" + code + "): " + body
    };
  }
}

/**
 * สร้าง Flex Message โครงสร้าง Bubble สวยงามสำหรับโทรติดตามคนไข้
 */
function buildTelemedFlexMessage(patients, thaiDateStr, appUrl) {
  var patientBubbles = [];
  var itemsPerPage = 5;
  var totalPages = Math.ceil(patients.length / itemsPerPage);
  
  for (var page = 0; page < totalPages; page++) {
    var pagePatients = patients.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    var patientBoxes = [];
    
    for (var idx = 0; idx < pagePatients.length; idx++) {
      var p = pagePatients[idx];
      var num = page * itemsPerPage + idx + 1;
      
      var cleanPhone = p.phone ? String(p.phone).replace(/[^0-9]/g, "") : "";
      var phoneBox = {
        type: "box",
        layout: "baseline",
        margin: "xs",
        contents: [
          { type: "text", text: "เบอร์โทร:", size: "xs", color: "#64748b", flex: 2 }
        ]
      };

      if (cleanPhone.length >= 9) {
        phoneBox.contents.push({
          type: "text",
          text: String(p.phone),
          size: "xs",
          weight: "bold",
          color: "#059669",
          action: {
            type: "uri",
            uri: "tel:" + cleanPhone
          },
          flex: 4
        });
      } else {
        phoneBox.contents.push({
          type: "text",
          text: p.phone ? String(p.phone) : "ไม่มีเบอร์โทร",
          size: "xs",
          weight: "bold",
          color: p.phone ? "#334155" : "#dc2626",
          flex: 4
        });
      }

      var box = {
        type: "box",
        layout: "vertical",
        margin: "md",
        paddingAll: "10px",
        backgroundColor: "#f8fafc",
        cornerRadius: "8px",
        borderColor: "#e2e8f0",
        borderWidth: "1px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: num + ". " + (p.name || "ไม่ระบุชื่อ"),
                weight: "bold",
                size: "sm",
                color: "#1e293b",
                flex: 4
              },
              {
                type: "text",
                text: p.department ? "[" + p.department + "]" : "",
                size: "xs",
                color: "#0284c7",
                align: "end",
                weight: "bold",
                flex: 2
              }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              { type: "text", text: "HN:", size: "xs", color: "#64748b", flex: 1 },
              { type: "text", text: p.hn || "-", size: "xs", weight: "bold", color: "#0f172a", flex: 4 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              { type: "text", text: "แพทย์:", size: "xs", color: "#64748b", flex: 1 },
              { type: "text", text: p.doctor || "-", size: "xs", color: "#334155", flex: 4 }
            ]
          },
          phoneBox,
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              { type: "text", text: "นัดเพื่อ:", size: "xs", color: "#64748b", flex: 1 },
              { type: "text", text: p.notes || "ติดตามอาการ", size: "xs", color: "#475569", wrap: true, flex: 4 }
            ]
          }
        ]
      };
      patientBoxes.push(box);
    }
    
    var bubbleContents = [
      {
        type: "text",
        text: page > 0 ? "รายชื่อผู้ป่วย (หน้าที่ " + (page + 1) + "/" + totalPages + ")" : "รายชื่อผู้ป่วยที่ต้องโทรเยี่ยมวันนี้:",
        size: "xs",
        color: "#64748b",
        weight: "bold",
        margin: "none"
      }
    ];
    for (var b = 0; b < patientBoxes.length; b++) {
      bubbleContents.push(patientBoxes[b]);
    }
    
    patientBubbles.push({
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0284c7",
        paddingTop: "14px",
        paddingBottom: "14px",
        contents: [
          {
            type: "text",
            text: "🏥 ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ",
            color: "#ffffff",
            weight: "bold",
            size: "sm"
          },
          {
            type: "text",
            text: "📞 เตือนนัด TELEMED ประจำวัน",
            color: "#e0f2fe",
            size: "xs",
            margin: "xs"
          },
          {
            type: "text",
            text: "🗓 " + thaiDateStr + " (รอโทร " + patients.length + " ราย)",
            color: "#fef08a",
            weight: "bold",
            size: "xs",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bubbleContents
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#0284c7",
            height: "sm",
            action: {
              type: "uri",
              label: "📋 เช็คคิว TeleQueue",
              uri: appUrl || "https://swdcph-nurse.github.io/TeleQueue/"
            }
          },
          {
            type: "text",
            text: "เมื่อโทรและลง HosXP แล้ว อย่าลืมติ๊กสถานะในระบบ",
            size: "xxs",
            color: "#94a3b8",
            align: "center"
          }
        ]
      }
    });
  }
  
  if (patientBubbles.length === 1) {
    return {
      type: "flex",
      altText: "🔔 แจ้งเตือนนัด Telemed วันนี้ (" + thaiDateStr + ") " + patients.length + " ท่าน",
      contents: patientBubbles[0]
    };
  } else {
    return {
      type: "flex",
      altText: "🔔 แจ้งเตือนนัด Telemed วันนี้ (" + thaiDateStr + ") " + patients.length + " ท่าน",
      contents: {
        type: "carousel",
        contents: patientBubbles.slice(0, 10)
      }
    };
  }
}

/**
 * =========================================================================
 * ฟังก์ชันตั้งเวลาอัตโนมัติ 08:00 น. (Automatic Daily 08:00 AM Trigger)
 * =========================================================================
 */

/**
 * 🌟 คลิกฟังก์ชันนี้แล้วกด "เรียกใช้" (Run) ใน Apps Script เพื่อตั้งเวลาแจ้งเตือนทุกวัน เวลา 08:00 น.
 */
function setDailyTriggerAt0800() {
  // 1. ลบ Trigger เดิมที่มีชื่อซ้ำ
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "dailyTriggerHandler") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 2. สร้าง Trigger ใหม่ ทุกวัน เวลา 08:00 น. (เขตเวลาประเทศไทย)
  ScriptApp.newTrigger("dailyTriggerHandler")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .inTimezone("Asia/Bangkok")
    .create();

  Logger.log("✅ ตั้งเวลาแจ้งเตือน LINE อัตโนมัติทุกวัน เวลา 08:00 น. สำเร็จแล้ว");
  return {
    success: true,
    message: "ตั้งเวลาแจ้งเตือนอัตโนมัติทุกวัน เวลา 08:00 น. เรียบร้อยแล้ว"
  };
}

/**
 * ฟังก์ชันที่ถูกเรียกโดยอัตโนมัติทุกวัน เวลา 08:00 น.
 */
function dailyTriggerHandler() {
  Logger.log("⏰ เริ่มทำงาน: แจ้งเตือนนัด Telemed ประจำวัน 08:00 น.");
  try {
    var result = sendDailyLineNotification(false);
    Logger.log("ผลการส่งแจ้งเตือน: " + JSON.stringify(result));
  } catch (err) {
    Logger.log("เกิดข้อผิดพลาด: " + err.toString());
  }
}

/**
 * บันทึกการตั้งค่าลง ScriptProperties
 */
function saveSettings(settings) {
  var props = PropertiesService.getScriptProperties();
  if (settings.spreadsheetId) props.setProperty("SPREADSHEET_ID", settings.spreadsheetId.trim());
  if (settings.sheetName !== undefined) props.setProperty("SHEET_NAME", settings.sheetName.trim());
  if (settings.lineChannelAccessToken) props.setProperty("LINE_CHANNEL_ACCESS_TOKEN", settings.lineChannelAccessToken.trim());
  if (settings.lineDestinationId) props.setProperty("LINE_DESTINATION_ID", settings.lineDestinationId.trim());
  if (settings.adminLineId !== undefined) props.setProperty("ADMIN_LINE_ID", settings.adminLineId.trim());
  if (settings.appUrl) props.setProperty("APP_URL", settings.appUrl.trim());
  if (settings.reminderHour !== undefined) props.setProperty("REMINDER_HOUR", String(settings.reminderHour));
  
  return {
    success: true,
    message: "บันทึกการตั้งค่าเรียบร้อยแล้ว",
    config: getConfig()
  };
}

/**
 * =========================================================================
 * Web App Entry Points: doGet & doPost
 * =========================================================================
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAll";
  var responseData;
  
  try {
    switch (action) {
      case "getAll":
        responseData = { success: true, data: getAllAppointments() };
        break;
      case "getToday":
        var queryDate = (e && e.parameter && e.parameter.date) ? e.parameter.date : "";
        responseData = { success: true, data: getAppointmentsByDate(queryDate) };
        break;
      case "getConfig":
        var cfg = getConfig();
        var maskedToken = cfg.lineChannelAccessToken ? cfg.lineChannelAccessToken.substring(0, 8) + "..." : "";
        responseData = { success: true, data: { spreadsheetId: cfg.spreadsheetId, sheetName: cfg.sheetName, lineDestinationId: cfg.lineDestinationId, appUrl: cfg.appUrl, lineChannelAccessToken: maskedToken } };
        break;
      default:
        responseData = { success: false, message: "Invalid action: " + action };
    }
  } catch (err) {
    responseData = { success: false, message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = {};
  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      body = {};
    }
  }

  // รองรับ Webhook จาก LINE สำหรับดึง Group ID อัตโนมัติเมื่อเชิญบอทเข้ากลุ่ม
  if (body && body.events && Array.isArray(body.events)) {
    return handleLineWebhook(body);
  }
  
  var action = body.action || (e && e.parameter && e.parameter.action) || "";
  var data = body.data || body;
  var responseData;
  
  try {
    switch (action) {
      case "getAll":
        responseData = { success: true, data: getAllAppointments() };
        break;
      case "add":
        responseData = addAppointment(data);
        break;
      case "update":
        responseData = updateAppointment(data);
        break;
      case "updateStatus":
        responseData = updateAppointment(data);
        break;
      case "delete":
        responseData = deleteAppointment(data.rowIndex);
        break;
      case "sendLineNotification":
        var force = (data.forceSend === true || data.forceSend === "true");
        responseData = sendDailyLineNotification(force, data);
        break;
      case "sendTestMessage":
        responseData = sendTestLineMessage(data);
        break;
      case "testLineToken":
        responseData = testLineToken(data.token);
        break;
      case "setupDailyTrigger":
        responseData = setDailyTriggerAt0800();
        break;
      case "testAdminNotification":
        responseData = notifyAdminNewAppointment(data);
        break;
      case "saveSettings":
        responseData = saveSettings(data);
        break;
      default:
        responseData = { success: false, message: "Unknown action: " + action };
    }
  } catch (err) {
    responseData = { success: false, message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * จัดการ Webhook จาก LINE สำหรับดึง Group ID อัตโนมัติ
 */
function handleLineWebhook(body) {
  var config = getConfig();
  var events = body.events;
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var replyToken = ev.replyToken;
    var source = ev.source || {};
    var groupId = source.groupId || "";
    var userId = source.userId || "";

    if (groupId) {
      // บันทึก Group ID ลงใน Script Properties ทันที
      PropertiesService.getScriptProperties().setProperty("LINE_DESTINATION_ID", groupId);
      if (replyToken && config.lineChannelAccessToken) {
        replyLineSimple(replyToken, config.lineChannelAccessToken, 
          "🏥 เชื่อมต่อกับระบบ TeleQueue สำเร็จ!\n\n" +
          "📌 รหัสกลุ่ม (Group ID):\n" + groupId + "\n\n" +
          "✅ ระบบได้บันทึกรหัสกลุ่มนี้เรียบร้อยแล้ว พร้อมส่งการแจ้งเตือนนัด Telemed ทุกวัน เวลา 08:00 น. ครับ"
        );
      }
    } else if (userId && replyToken && config.lineChannelAccessToken) {
      replyLineSimple(replyToken, config.lineChannelAccessToken, 
        "👤 รหัส User ID ของคุณคือ:\n" + userId + "\n\n" +
        "สามารถนำรหัสนี้ไปใส่ในช่อง Destination ID เพื่อทดสอบรับการแจ้งเตือนส่วนตัวได้ครับ"
      );
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function replyLineSimple(replyToken, token, text) {
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + sanitizeLineToken(token)
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: text }]
      }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}
