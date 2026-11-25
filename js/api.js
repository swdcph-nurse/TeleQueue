/**
 * api.js - API client for Google Apps Script Web App and Google Sheets
 */

const ApiService = {
  // ตรวจสอบว่ากำหนด GAS URL ไว้หรือไม่
  hasGasUrl: function() {
    const url = CONFIG.getGasUrl();
    return !!(url && url.startsWith("http"));
  },

  // ส่งคำขอไปยัง Google Apps Script Web App
  request: async function(action, data = null) {
    const gasUrl = CONFIG.getGasUrl();
    
    // ถ้ายังไม่ได้ตั้งค่า GAS URL ให้ใช้ข้อมูล Local DataStore
    if (!gasUrl) {
      console.info(`[API Mode: Local Cache] Action: ${action}`);
      return this.handleLocalFallback(action, data);
    }

    try {
      const options = {
        method: "POST",
        mode: "cors",
        headers: {
          // ใช้ text/plain เพื่อป้องกัน CORS preflight OPTIONS request กับ Google Apps Script
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      };

      const response = await fetch(gasUrl, options);
      if (!response.ok) {
        throw new Error(`GAS API HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.warn(`[API Warning] Request to GAS failed, falling back to Local Cache: ${error.message}`);
      return this.handleLocalFallback(action, data, error.message);
    }
  },

  // Fallback ประมวลผลในเครื่องกรณีไม่มีเน็ตหรือยังไม่ได้เชื่อม GAS URL
  handleLocalFallback: function(action, data, errorMessage = null) {
    switch (action) {
      case "getAll":
        return {
          success: true,
          fromCache: true,
          errorMessage: errorMessage,
          data: DataStore.getAll()
        };
      case "add": {
        const newApt = DataStore.add(data);
        return {
          success: true,
          fromCache: true,
          message: "บันทึกข้อมูลเรียบร้อย (บันทึกในเครื่องชั่วคราว)",
          data: newApt
        };
      }
      case "update":
      case "updateStatus": {
        const updated = DataStore.update(data);
        return {
          success: !!updated,
          fromCache: true,
          message: updated ? "อัปเดตสถานะเรียบร้อย" : "ไม่พบรายการ",
          data: updated
        };
      }
      case "delete": {
        DataStore.delete(data.rowIndex || data.id);
        return {
          success: true,
          fromCache: true,
          message: "ลบรายการเรียบร้อย"
        };
      }
      case "sendLineNotification": {
        const todayIso = getTodayIso();
        const pending = DataStore.getAll().filter(a => a.date === todayIso && !a.tele);
        return {
          success: true,
          fromCache: true,
          count: pending.length,
          message: `[โหมดจำลอง] จำลองส่งแจ้งเตือน LINE สำหรับผู้ป่วย ${pending.length} ท่านเรียบร้อย`
        };
      }
      default:
        return {
          success: false,
          fromCache: true,
          message: "Local action handler not implemented: " + action
        };
    }
  },

  // ดึงข้อมูลนัดหมายทั้งหมด
  getAllAppointments: async function() {
    const res = await this.request("getAll");
    if (res && res.success && Array.isArray(res.data)) {
      DataStore.setAll(res.data);
      return res.data;
    }
    return DataStore.getAll();
  },

  // เพิ่มนัดหมายใหม่
  addAppointment: async function(appointmentData) {
    const res = await this.request("add", appointmentData);
    if (res && res.success) {
      if (!res.fromCache) {
        // ซิงค์เข้า local
        DataStore.add({ ...appointmentData, rowIndex: res.rowIndex });
      }
    }
    return res;
  },

  // อัปเดตข้อมูลนัดหมาย
  updateAppointment: async function(appointmentData) {
    const res = await this.request("update", appointmentData);
    if (res && res.success && !res.fromCache) {
      DataStore.update(appointmentData);
    }
    return res;
  },

  // อัปเดตสถานะการโทร หรือ HosXP โดยตรง
  updateStatus: async function(rowIndex, field, value, operator) {
    const payload = {
      rowIndex: rowIndex,
      [field]: value,
      operator: operator || CONFIG.getCurrentOperator()
    };
    
    // อัปเดตฝั่ง Local ทันทีเพื่อ UI ไวไม่มีสะดุด (Optimistic UI update)
    DataStore.update(payload);
    
    const res = await this.request("updateStatus", payload);
    return res;
  },

  // ลบนัดหมาย
  deleteAppointment: async function(rowIndex) {
    const res = await this.request("delete", { rowIndex: rowIndex });
    if (res && res.success && !res.fromCache) {
      DataStore.delete(rowIndex);
    }
    return res;
  },

  // เรียก GAS แบบเข้มงวด: ไม่ใช้ข้อมูลจำลองในเครื่อง ถ้าไม่สำเร็จจะ throw เสมอ
  requestStrict: async function(action, data = null) {
    const gasUrl = CONFIG.getGasUrl();
    if (!gasUrl) throw new Error("ยังไม่ได้ตั้งค่า URL เว็บแอป Google Apps Script");
    let response;
    try {
      response = await fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, data: data })
      });
    } catch (err) {
      throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (" + err.message + ")");
    }
    if (!response.ok) throw new Error("เซิร์ฟเวอร์ตอบกลับผิดพลาด HTTP " + response.status);
    let result;
    try {
      result = await response.json();
    } catch (err) {
      throw new Error("เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง (ตรวจสอบว่า Deploy เป็นเวอร์ชันล่าสุดและเปิดให้ Anyone เข้าถึง)");
    }
    if (!result || !result.success) {
      throw new Error((result && (result.message || result.error)) || "เซิร์ฟเวอร์ไม่ยอมรับคำขอ");
    }
    return result;
  },

  // อ่านการตั้งค่ากลางจากเซิร์ฟเวอร์ (ใช้ร่วมกันทุกเครื่อง)
  getSettings: async function() {
    const res = await this.requestStrict("getSettings");
    return res.data;
  },

  // บันทึกการตั้งค่ากลางลงเซิร์ฟเวอร์ (throw ถ้าไม่สำเร็จ)
  saveSettingsToGas: async function(settings) {
    return await this.requestStrict("saveSettings", settings);
  },

  // ส่งแจ้งเตือน LINE ประจำวัน โดยใช้ค่าที่บันทึกไว้บนเซิร์ฟเวอร์
  sendDailyLineNotification: async function(forceSend = false) {
    return await this.request("sendLineNotification", { forceSend: forceSend });
  },

  // ส่งข้อความทดสอบ (ถ้าไม่ระบุค่า จะใช้ค่าที่บันทึกไว้บนเซิร์ฟเวอร์)
  sendTestLineMessage: async function(token, groupId) {
    return await this.requestStrict("sendTestMessage", {
      lineChannelAccessToken: token || "",
      lineDestinationId: groupId || ""
    });
  },

  // ทดสอบ LINE Channel Access Token (ถ้าไม่ระบุ จะใช้ค่าที่บันทึกไว้บนเซิร์ฟเวอร์)
  testLineToken: async function(token) {
    return await this.requestStrict("testLineToken", { token: token || "" });
  },

  // ตั้ง/ตรวจสอบ Trigger แจ้งเตือนอัตโนมัติใน Google Apps Script
  setupDailyTrigger: async function() {
    return await this.requestStrict("setupDailyTrigger", {});
  }
};

window.ApiService = ApiService;
