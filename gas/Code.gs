/**
 * =========================================================================
 * TeleQueue - Google Apps Script Backend & LINE Messaging API Notification
 * ระบบบันทึกนัด Telemed ผู้ป่วย หอผู้ป่วยพิเศษปาริฉัตร-หอสงฆ์อาพาธ
 * Google Sheet ID: 1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE
 * =========================================================================
 */

// ค่าเริ่มต้นระบบ (สามารถแก้ไขผ่าน Script Properties ได้)
const DEFAULT_SPREADSHEET_ID = "1BEQYLBtiMZaCLld6i8mTrn59sKJ75N3kZIiLM7f-lGE";
const HEADER_ROW_INDEX = 2; // แถวหัวตาราง (วันนัด, ชื่อ-สกุล, ...)
const DATA_START_ROW = 3;   // แถวเริ่มต้นข้อมูล

// ดึงการตั้งค่าจาก ScriptProperties หรือค่า Default
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID,
    sheetName: props.getProperty("SHEET_NAME") || "",
    lineChannelAccessToken: props.getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "",
    lineDestinationId: props.getProperty("LINE_DESTINATION_ID") || "", // Group ID หรือ User ID
    appUrl: props.getProperty("APP_URL") || "https://swdcph-nurse.github.io/TeleQueue/",
    autoReminderHour: parseInt(props.getProperty("REMINDER_HOUR") || "8", 10), // 8:00 AM
    autoReminderMinute: parseInt(props.getProperty("REMINDER_MINUTE") || "0", 10)
  };
}

/**
 * ดึง Sheet ทำงาน
 */
function getTargetSheet() {
  const config = getConfig();
  let ss;
  try {
    ss = config.spreadsheetId ? SpreadsheetApp.openById(config.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (config.sheetName) {
    const s = ss.getSheetByName(config.sheetName);
    if (s) return s;
  }
  return ss.getSheets()[0];
}

/**
 * แปลงวันที่เป็น YYYY-MM-DD แบบ ค.ศ. สากล (แก้ปัญหาปี พ.ศ. 2568/2569 และข้อผิดพลาดปี 1968/1969)
 */
function normalizeDate(rawDate) {
  if (!rawDate) return "";
  
  // กรณีเป็น Date object ของ GAS
  if (Object.prototype.toString.call(rawDate) === "[object Date]") {
    if (isNaN(rawDate.getTime())) return "";
    let year = rawDate.getFullYear();
    // ถ้าถูกเก็บเป็น พ.ศ. เกิน 2400 ให้แปลงเป็น ค.ศ.
    if (year > 2400) year -= 543;
    // ถ้ามี typo ปี 1968-1975 จากการพิมพ์ พ.ศ. ผิดพลาดในบางระบบ
    if (year >= 1960 && year <= 1975) year += 58; // 1968 + 58 = 2026
    const m = String(rawDate.getMonth() + 1).padStart(2, "0");
    const d = String(rawDate.getDate()).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }
  
  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    let year = parseInt(match[1], 10);
    const month = String(parseInt(match[2], 10)).padStart(2, "0");
    const day = String(parseInt(match[3], 10)).padStart(2, "0");
    
    // พ.ศ. 2568, 2569 -> ค.ศ. 2025, 2026
    if (year > 2400) {
      year -= 543;
    } else if (year >= 1960 && year <= 1975) {
      // 1968 -> 2026, 1969 -> 2026 (กรณี พ.ศ. 2569 - 600 หรือความคลาดเคลื่อนระบบ)
      year = year + 57; // 1969 + 57 = 2026
    }
    return `${year}-${month}-${day}`;
  }
  
  return str;
}

/**
 * แปลงวันที่ ค.ศ. สากลให้เป็นวันที่แสดงผลภาษาไทย (เช่น 21 พ.ย. 2569)
 */
function formatThaiDate(isoDateStr) {
  if (!isoDateStr) return "-";
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  const y = parseInt(parts[0], 10) + 543;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const thaiMonths = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${thaiMonths[m] || m} ${y}`;
}

/**
 * ตรวจสอบและเตรียมคอลัมน์พิเศษเพิ่มเติม (ไม่กระทบคอลัมน์เดิม A-M)
 * Col N (14): ผู้ดำเนินการโทร
 * Col O (15): วันเวลาโทร
 * Col P (16): ผู้ดำเนินการ HosXP
 * Col Q (17): วันเวลา HosXP
 * Col R (18): แจ้งเตือน LINE แล้ว
 */
function ensureExtraHeaders(sheet) {
  const headerRange = sheet.getRange(HEADER_ROW_INDEX, 1, 1, Math.max(sheet.getLastColumn(), 18));
  const headers = headerRange.getValues()[0];
  const requiredExtras = [
    { col: 14, title: "ผู้ดำเนินการโทร" },
    { col: 15, title: "วันเวลาโทร" },
    { col: 16, title: "ผู้ดำเนินการ HosXP" },
    { col: 17, title: "วันเวลา HosXP" },
    { col: 18, title: "แจ้งเตือน LINE" }
  ];
  
  requiredExtras.forEach(item => {
    if (!headers[item.col - 1] || headers[item.col - 1].toString().trim() === "") {
      sheet.getRange(HEADER_ROW_INDEX, item.col).setValue(item.title);
    }
  });
}

/**
 * ดึงรายการนัดหมายทั้งหมด
 */
function getAllAppointments() {
  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return [];
  }
  
  ensureExtraHeaders(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), 18);
  const numRows = lastRow - DATA_START_ROW + 1;
  const values = sheet.getRange(DATA_START_ROW, 1, numRows, lastCol).getValues();
  
  const appointments = [];
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowIndex = DATA_START_ROW + i;
    
    const patientName = (row[1] || "").toString().trim();
    const hn = (row[3] || "").toString().trim();
    const rawDate = row[0];
    
    // ข้ามแถวว่าง
    if (!patientName && !hn && !rawDate) {
      continue;
    }
    
    const isoDate = normalizeDate(rawDate);
    
    // ตรวจสอบ boolean
    const tele = (row[9] === true || String(row[9]).toLowerCase() === "true");
    const hosxp = (row[10] === true || String(row[10]).toLowerCase() === "true");
    const moph = (row[11] === true || String(row[11]).toLowerCase() === "true");
    const checkMoph = (row[12] === true || String(row[12]).toLowerCase() === "true");
    
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
  let dateQuery = targetDateIso;
  if (!dateQuery) {
    const today = new Date();
    dateQuery = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  }
  
  const all = getAllAppointments();
  return all.filter(item => item.date === dateQuery);
}

/**
 * เพิ่มนัดหมายใหม่
 */
function addAppointment(data) {
  const sheet = getTargetSheet();
  ensureExtraHeaders(sheet);
  
  const lastRow = sheet.getLastRow();
  const nextRow = lastRow + 1;
  
  // รูปแบบวันที่ที่จะบันทึก
  const dateVal = data.date || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  
  const newRow = [
    dateVal,
    data.name || "",
    data.cid || "",
    data.hn || "",
    data.department || "",
    data.doctor || "",
    data.phone || "",
    data.lineName || "",
    data.notes || "",
    data.tele === true || data.tele === "true" ? true : false,
    data.hosxp === true || data.hosxp === "true" ? true : false,
    data.moph === true || data.moph === "true" ? true : false,
    data.checkMoph === true || data.checkMoph === "true" ? true : false,
    data.teleOperator || "",
    data.teleTime || "",
    data.hosOperator || "",
    data.hosTime || "",
    false // lineNotified
  ];
  
  sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
  
  return {
    success: true,
    message: "บันทึกข้อมูลนัดหมายใหม่เรียบร้อยแล้ว",
    rowIndex: nextRow,
    data: newRow
  };
}

/**
 * อัปเดตข้อมูลนัดหมาย (ข้อมูลทั่วไป หรือสถานะ Checkbox)
 */
function updateAppointment(data) {
  const sheet = getTargetSheet();
  ensureExtraHeaders(sheet);
  
  const rowIndex = parseInt(data.rowIndex, 10);
  if (!rowIndex || rowIndex < DATA_START_ROW) {
    throw new Error("หมายเลขแถว (rowIndex) ไม่ถูกต้อง: " + data.rowIndex);
  }
  
  // ดึงแถวปัจจุบันมาก่อนเพื่อคงค่าเดิมที่ไม่ถูกแก้ไข
  const currentValues = sheet.getRange(rowIndex, 1, 1, 18).getValues()[0];
  
  if (data.date !== undefined) currentValues[0] = data.date;
  if (data.name !== undefined) currentValues[1] = data.name;
  if (data.cid !== undefined) currentValues[2] = data.cid;
  if (data.hn !== undefined) currentValues[3] = data.hn;
  if (data.department !== undefined) currentValues[4] = data.department;
  if (data.doctor !== undefined) currentValues[5] = data.doctor;
  if (data.phone !== undefined) currentValues[6] = data.phone;
  if (data.lineName !== undefined) currentValues[7] = data.lineName;
  if (data.notes !== undefined) currentValues[8] = data.notes;
  
  // อัปเดตสถานะ TELE
  if (data.tele !== undefined) {
    const isTele = (data.tele === true || data.tele === "true");
    currentValues[9] = isTele;
    if (isTele) {
      if (data.operator) currentValues[13] = data.operator;
      currentValues[14] = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    }
  }
  
  // อัปเดตสถานะ HosXP
  if (data.hosxp !== undefined) {
    const isHosxp = (data.hosxp === true || data.hosxp === "true");
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
 * ลบนัดหมาย (หรือเคลียร์แถว)
 */
function deleteAppointment(rowIndex) {
  const sheet = getTargetSheet();
  const row = parseInt(rowIndex, 10);
  if (!row || row < DATA_START_ROW) {
    throw new Error("หมายเลขแถวไม่ถูกต้อง: " + rowIndex);
  }
  
  sheet.deleteRow(row);
  return {
    success: true,
    message: `ลบรายการแถวที่ ${row} เรียบร้อยแล้ว`
  };
}

/**
 * =========================================================================
 * LINE Notification System (LINE Messaging API)
 * แจ้งเตือนกลุ่ม LINE เมื่อถึงวันนัด เพื่อเตือนให้โทรเยี่ยมคนไข้
 * - สรุปรายชื่อผู้ป่วยที่ต้องโทรเยี่ยม
 * - แจ้งเฉพาะรายการที่ยังไม่ได้ดำเนินการ (TELE == false)
 * - ป้องกันการส่งแจ้งเตือนซ้ำ
 * =========================================================================
 */

function sanitizeLineToken(rawToken) {
  if (!rawToken) return "";
  let token = String(rawToken).trim();
  // ตัดคำว่า Bearer นำหน้าออกถ้ามี
  token = token.replace(/^Bearer\s+/i, "").trim();
  // ตัดเครื่องหมายคำพูดรอบข้างถ้ามี
  token = token.replace(/^["']|["']$/g, "").trim();
  return token;
}

/**
 * ส่ง LINE Flex Message แจ้งเตือนรายการนัดวันนี้
 * @param {boolean} forceSend ส่งซ้ำแม้ว่ารายการนั้นจะเคยส่งแจ้งเตือนแล้ว
 * @param {Object} overrideConfig ตัวเลือกการตั้งค่าเสริม
 */
function sendDailyLineNotification(forceSend = false, overrideConfig = null) {
  const config = getConfig();
  
  let accessToken = sanitizeLineToken(overrideConfig?.lineChannelAccessToken || config.lineChannelAccessToken);
  let destinationId = (overrideConfig?.lineDestinationId || config.lineDestinationId || "").trim();
  
  if (!accessToken) {
    return {
      success: false,
      message: "ยังไม่ได้ระบุ LINE Channel Access Token (กรุณาตั้งค่าในเมนู ⚙️ หรือใน Script Properties)"
    };
  }

  // ตรวจสอบความยาวของ Token (Channel Secret = 32 ตัวอักษร, Channel Access Token = 170+ ตัวอักษร)
  if (accessToken.length <= 40) {
    throw new Error(
      "LINE Token ที่ระบุดูเหมือนจะเป็น 'Channel Secret' (ความยาว " + accessToken.length + " ตัวอักษร)\n" +
      "การเรียก LINE Messaging API จำเป็นต้องใช้ 'Channel access token (long-lived)' ซึ่งยาวประมาณ 170+ ตัวอักษร\n" +
      "วิธีแก้ไข: ไปที่ LINE Developers Console > เลือก Channel ของคุณ > เข้าแท็บ 'Messaging API' > เลื่อนลงล่างสุดตรงหัวข้อ 'Channel access token' แล้วกดปุ่ม 'Issue' เพื่อคัดลอก Token ที่ถูกต้อง"
    );
  }

  if (!destinationId) {
    return {
      success: false,
      message: "ยังไม่ได้ระบุ LINE Destination ID (Group ID หรือ User ID)"
    };
  }
  
  const today = new Date();
  const todayIso = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  const thaiDateStr = formatThaiDate(todayIso);
  
  const allAppointments = getAllAppointments();
  
  // กรองผู้ป่วยที่นัดวันนี้ และยังไม่ได้โทร (tele == false)
  // และถ้าไม่ใช่ forceSend จะกรองเฉพาะที่ยังไม่ได้แจ้งเตือน (lineNotified == false)
  const pendingAppointments = allAppointments.filter(item => {
    if (item.date !== todayIso) return false;
    if (item.tele === true) return false; // ข้ามรายที่โทรแล้ว
    if (!forceSend && item.lineNotified === true) return false; // ป้องกันส่งซ้ำ
    return true;
  });
  
  if (pendingAppointments.length === 0) {
    return {
      success: true,
      count: 0,
      message: `ไม่มีรายการนัดที่ต้องโทรแจ้งเตือนสำหรับวันนี้ (${thaiDateStr}) หรือได้ส่งแจ้งเตือนครบแล้ว`
    };
  }
  
  // สร้าง LINE Flex Message
  const flexMessage = buildTelemedFlexMessage(pendingAppointments, thaiDateStr, config.appUrl);
  
  // ยิง LINE Messaging API Push Message
  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: destinationId,
    messages: [flexMessage]
  };
  
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
    // บันทึกเครื่องหมายว่าแจ้งเตือนแล้วเพื่อป้องกันส่งซ้ำ
    const sheet = getTargetSheet();
    pendingAppointments.forEach(item => {
      sheet.getRange(item.rowIndex, 18).setValue(true); // Col R: แจ้งเตือน LINE
    });
    
    return {
      success: true,
      count: pendingAppointments.length,
      message: `ส่งแจ้งเตือนไปยัง LINE เรียบร้อยแล้ว จำนวน ${pendingAppointments.length} ท่าน`
    };
  } else {
    let errDetail = responseBody;
    try {
      const parsed = JSON.parse(responseBody);
      if (responseCode === 401) {
        errDetail = "Token ไม่ถูกต้องหรือหมดอายุ (401 Unauthorized): " + (parsed.message || "") +
          "\nกรุณาตรวจสอบว่าได้คัดลอก Channel access token (long-lived) มาถูกต้องครบถ้วนหรือไม่";
      } else if (responseCode === 400) {
        errDetail = "คำขอไม่ถูกต้อง (400 Bad Request): " + (parsed.message || "");
      }
    } catch (e) {}
    throw new Error(`LINE API Error (${responseCode}): ${errDetail}`);
  }
}

/**
 * ฟังก์ชันสำหรับทดสอบความถูกต้องของ LINE Channel Access Token
 */
function testLineToken(testToken) {
  const token = sanitizeLineToken(testToken || getConfig().lineChannelAccessToken);
  if (!token) {
    return { success: false, message: "ยังไม่ได้ระบุ Token" };
  }
  
  const url = "https://api.line.me/v2/bot/info";
  const options = {
    method: "get",
    headers: {
      "Authorization": "Bearer " + token
    },
    muteHttpExceptions: true
  };
  
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const body = res.getContentText();
  
  if (code === 200) {
    const info = JSON.parse(body);
    return {
      success: true,
      botName: info.displayName,
      botId: info.basicId,
      message: `Token ถูกต้อง! เชื่อมต่อกับบอท "${info.displayName}" (${info.basicId}) สำเร็จ`
    };
  } else {
    return {
      success: false,
      statusCode: code,
      message: `ทดสอบ Token ไม่สำเร็จ (${code}): ${body}`
    };
  }
}

/**
 * สร้าง Flex Message โครงสร้าง Bubble สวยงามสำหรับโทรติดตามคนไข้
 */
function buildTelemedFlexMessage(patients, thaiDateStr, appUrl) {
  const patientBubbles = [];
  
  // ตัดแบ่งเป็น Carousel ถ้าผู้ป่วยเยอะ หรือรวมเป็น Bubble เดียวถ้า 1-5 ท่าน
  const itemsPerPage = 5;
  const totalPages = Math.ceil(patients.length / itemsPerPage);
  
  for (let page = 0; page < totalPages; page++) {
    const pagePatients = patients.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    
    const patientBoxes = pagePatients.map((p, idx) => {
      const num = page * itemsPerPage + idx + 1;
      return {
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
                text: `${num}. ${p.name || "ไม่ระบุชื่อ"}`,
                weight: "bold",
                size: "sm",
                color: "#1e293b",
                flex: 4
              },
              {
                type: "text",
                text: p.department ? `[${p.department}]` : "",
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
              {
                type: "text",
                text: "HN:",
                size: "xs",
                color: "#64748b",
                flex: 1
              },
              {
                type: "text",
                text: p.hn || "-",
                size: "xs",
                weight: "bold",
                color: "#0f172a",
                flex: 4
              }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              {
                type: "text",
                text: "แพทย์:",
                size: "xs",
                color: "#64748b",
                flex: 1
              },
              {
                type: "text",
                text: p.doctor || "-",
                size: "xs",
                color: "#334155",
                flex: 4
              }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              {
                type: "text",
                text: "เบอร์โทร:",
                size: "xs",
                color: "#64748b",
                flex: 2
              },
              {
                type: "text",
                text: p.phone ? `${p.phone}` : "ไม่มีเบอร์โทร",
                size: "xs",
                weight: "bold",
                color: p.phone ? "#059669" : "#dc2626",
                action: p.phone ? {
                  type: "uri",
                  label: "โทร",
                  uri: `tel:${p.phone.replace(/[^0-9]/g, "")}`
                } : undefined,
                flex: 4
              }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            margin: "xs",
            contents: [
              {
                type: "text",
                text: "นัดเพื่อ:",
                size: "xs",
                color: "#64748b",
                flex: 1
              },
              {
                type: "text",
                text: p.notes || "ติดตามอาการ",
                size: "xs",
                color: "#475569",
                wrap: true,
                flex: 4
              }
            ]
          }
        ]
      };
    });
    
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
            text: `📞 เตือนนัด TELEMED ประจำวัน`,
            color: "#e0f2fe",
            size: "xs",
            margin: "xs"
          },
          {
            type: "text",
            text: `🗓 ${thaiDateStr} (รอโทร ${patients.length} ราย)`,
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
        contents: [
          {
            type: "text",
            text: page > 0 ? `รายชื่อผู้ป่วย (หน้าที่ ${page + 1}/${totalPages})` : `รายชื่อผู้ป่วยที่ต้องโทรเยี่ยมวันนี้:`,
            size: "xs",
            color: "#64748b",
            weight: "bold",
            margin: "none"
          },
          ...patientBoxes
        ]
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
              label: "📋 เปิดระบบ TeleQueue เช็คคิว",
              uri: appUrl
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
      altText: `🔔 แจ้งเตือนนัด Telemed วันนี้ (${thaiDateStr}) ${patients.length} ท่าน`,
      contents: patientBubbles[0]
    };
  } else {
    return {
      type: "flex",
      altText: `🔔 แจ้งเตือนนัด Telemed วันนี้ (${thaiDateStr}) ${patients.length} ท่าน`,
      contents: {
        type: "carousel",
        contents: patientBubbles.slice(0, 10) // LINE รับได้สูงสุด 10 bubbles
      }
    };
  }
}

/**
 * ฟังก์ชันสร้าง Trigger ตั้งเวลาแจ้งเตือนอัตโนมัติประจำวัน
 */
function setupDailyNotificationTrigger() {
  const config = getConfig();
  
  // ลบ Trigger เดิมที่มีชื่อซ้ำ
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "dailyTriggerHandler") {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // สร้าง Trigger ใหม่ตามเวลาที่กำหนด (เช่น 08:00 น.)
  ScriptApp.newTrigger("dailyTriggerHandler")
    .timeBased()
    .everyDays(1)
    .atHour(config.autoReminderHour)
    .nearMinute(config.autoReminderMinute)
    .create();
    
  return {
    success: true,
    message: `ตั้งเวลาแจ้งเตือนอัตโนมัติทุกวัน เวลา ${String(config.autoReminderHour).padStart(2, "0")}:${String(config.autoReminderMinute).padStart(2, "0")} น. เรียบร้อยแล้ว`
  };
}

/**
 * ตัว Handler ที่ถูกเรียกโดย Trigger ประจำวัน
 */
function dailyTriggerHandler() {
  console.log("Starting daily Telemed LINE notification trigger...");
  try {
    const result = sendDailyLineNotification(false);
    console.log("Trigger Result: " + JSON.stringify(result));
  } catch (err) {
    console.error("Daily trigger error: " + err.toString());
  }
}

/**
 * บันทึกการตั้งค่าลง ScriptProperties
 */
function saveSettings(settings) {
  const props = PropertiesService.getScriptProperties();
  if (settings.spreadsheetId) props.setProperty("SPREADSHEET_ID", settings.spreadsheetId.trim());
  if (settings.sheetName !== undefined) props.setProperty("SHEET_NAME", settings.sheetName.trim());
  if (settings.lineChannelAccessToken) props.setProperty("LINE_CHANNEL_ACCESS_TOKEN", settings.lineChannelAccessToken.trim());
  if (settings.lineDestinationId) props.setProperty("LINE_DESTINATION_ID", settings.lineDestinationId.trim());
  if (settings.appUrl) props.setProperty("APP_URL", settings.appUrl.trim());
  if (settings.reminderHour !== undefined) props.setProperty("REMINDER_HOUR", String(settings.reminderHour));
  if (settings.reminderMinute !== undefined) props.setProperty("REMINDER_MINUTE", String(settings.reminderMinute));
  
  return {
    success: true,
    message: "บันทึกการตั้งค่าเรียบร้อยแล้ว",
    config: getConfig()
  };
}

/**
 * =========================================================================
 * Web App Entry Points: doGet & doPost
 * รองรับการเรียกจาก Browser และ fetch() AJAX
 * =========================================================================
 */

function doGet(e) {
  const action = e?.parameter?.action || "getAll";
  let responseData;
  
  try {
    switch (action) {
      case "getAll":
        responseData = { success: true, data: getAllAppointments() };
        break;
      case "getToday":
        responseData = { success: true, data: getAppointmentsByDate(e?.parameter?.date) };
        break;
      case "getConfig":
        const cfg = getConfig();
        // ซ่อน token บางส่วนเพื่อความปลอดภัย
        const maskedToken = cfg.lineChannelAccessToken ? cfg.lineChannelAccessToken.substring(0, 8) + "..." : "";
        responseData = { success: true, data: { ...cfg, lineChannelAccessToken: maskedToken } };
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
  let body = {};
  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      body = {};
    }
  }
  
  const action = body.action || e?.parameter?.action;
  const data = body.data || body;
  let responseData;
  
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
        const force = data.forceSend === true || data.forceSend === "true";
        responseData = sendDailyLineNotification(force, data);
        break;
      case "testLineToken":
        responseData = testLineToken(data.token);
        break;
      case "setupDailyTrigger":
        responseData = setupDailyNotificationTrigger();
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
