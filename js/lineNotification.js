/**
 * lineNotification.js - LINE Messaging API Notification Manager & Flex Message Preview
 */

const LineNotificationModule = {
  // สรุปข้อความแบบ Text สำหรับคัดลอกด้วยตนเอง (ข้อความล้วน ไม่ใช้อิโมจิ)
  generateTextSummary: function(patients, thaiDateStr) {
    const divider = "--------------------\n";

    if (!patients || patients.length === 0) {
      return `ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ\nประจำวันที่ ${thaiDateStr}\nไม่มีคิวนัด Telemed ที่ต้องโทรติดตามสำหรับวันนี้`;
    }

    let text = `ตึกพิเศษปาริฉัตร - หอสงฆ์อาพาธ\n`;
    text += `แจ้งเตือนนัด TELEMED ประจำวันที่ ${thaiDateStr}\n`;
    text += `สรุปรายชื่อผู้ป่วยที่ต้องโทรเยี่ยม (${patients.length} ท่าน):\n`;
    text += divider;

    patients.forEach((p, index) => {
      text += `${index + 1}. ${p.name || "ไม่ระบุชื่อ"} (HN: ${p.hn || "-"})\n`;
      text += `   แผนก: ${p.department || "-"} | แพทย์: ${p.doctor || "-"}\n`;
      text += `   โทร: ${p.phone || "ไม่มีเบอร์"}\n`;
      if (p.lineName) text += `   LINE: ${p.lineName}\n`;
      text += `   นัดเพื่อ: ${p.notes || "ติดตามอาการ"}\n`;
      text += divider;
    });

    text += `\nตรวจสอบและลงบันทึกคิว: ${CONFIG.GITHUB_REPO_URL}`;
    return text;
  },

  // ดึงรายชื่อผู้ป่วยที่ต้องโทรวันนี้ (tele == false)
  getPendingTodayPatients: function() {
    const todayIso = getTodayIso();
    const all = DataStore.getAll();
    return all.filter(a => a.date === todayIso && !a.tele);
  },

  // แสดง Modal พรีวิวการแจ้งเตือน LINE
  openPreviewModal: function() {
    const pending = this.getPendingTodayPatients();
    const todayIso = getTodayIso();
    const thaiDateStr = formatThaiDateDisplay(todayIso);
    
    const previewContainer = document.getElementById("lineFlexPreview");
    const summaryText = this.generateTextSummary(pending, thaiDateStr);

    if (previewContainer) {
      if (pending.length === 0) {
        previewContainer.innerHTML = `
          <div class="empty">
            <div class="empty-icon" style="background:var(--success-c);color:var(--success)">${icon("check-circle", "icon--xl")}</div>
            <div class="empty-title">ดำเนินการโทรครบแล้วทุกราย</div>
            <p class="empty-text">ไม่มีผู้ป่วยที่ค้างโทรสำหรับวันนี้ (${esc(thaiDateStr)})</p>
          </div>
        `;
      } else {
        const itemsHtml = pending.map((p, idx) => `
          <div class="flex-item">
            <div class="flex-item-top">
              <span>${idx + 1}. ${esc(p.name)}</span>
              <span class="dept">${esc(p.department || "ทั่วไป")}</span>
            </div>
            <div class="flex-item-row">
              <span>HN <strong>${esc(p.hn || "-")}</strong></span>
              <span>แพทย์ <strong>${esc(p.doctor || "-")}</strong></span>
            </div>
            <div class="flex-item-row">
              <span>โทร <strong style="color:var(--success)">${esc(p.phone || "ไม่มีเบอร์")}</strong></span>
              ${p.lineName ? `<span>LINE ${esc(p.lineName)}</span>` : ""}
            </div>
            <div class="meta" style="margin-top:2px">${icon("note")}<span>${esc(p.notes || "ติดตามอาการ")}</span></div>
          </div>
        `).join("");

        previewContainer.innerHTML = `
          <div class="flex-card">
            <div class="flex-card-head">
              <div class="flex-card-eyebrow">ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ</div>
              <div class="flex-card-title">แจ้งเตือนนัด TELEMED ประจำวัน</div>
              <div class="flex-card-date">${icon("calendar", "icon--sm")}<span>${esc(thaiDateStr)} (รอโทร ${pending.length} ท่าน)</span></div>
            </div>
            <div class="flex-card-body">
              ${itemsHtml}
            </div>
            <div class="flex-card-foot">
              <span>เปิดระบบ TeleQueue เช็คคิว</span>
              <small>ส่งผ่าน LINE Messaging API อัตโนมัติ</small>
            </div>
          </div>
        `;
      }
    }

    // อัปเดตช่องข้อความสรุป
    const rawTextEl = document.getElementById("lineRawTextSummary");
    if (rawTextEl) {
      rawTextEl.value = summaryText;
    }

    // แสดง Modal
    UI.openModal("lineNotificationModal");
  },

  // ปิด Modal
  closePreviewModal: function() {
    UI.closeModal("lineNotificationModal");
  },

  // ดำเนินการยิง API แจ้งเตือนเข้า LINE กลุ่ม
  sendNotification: async function(force = false) {
    const pending = this.getPendingTodayPatients();
    if (pending.length === 0 && !force) {
      Swal.fire({
        icon: "info",
        title: "ไม่มีรายการที่ต้องแจ้งเตือน",
        text: "ผู้ป่วยทุกคนในวันนี้นัดโทรเรียบร้อยแล้ว หรือไม่มีนัดสำหรับวันนี้",
        confirmButtonColor: "#0061A4"
      });
      return;
    }

    // ตรวจสอบว่าเคยแจ้งเตือนไปแล้วหรือไม่ เพื่อป้องกันการส่งซ้ำ
    const alreadyNotified = pending.some(p => p.lineNotified);
    if (alreadyNotified && !force) {
      const confirmRes = await Swal.fire({
        title: "รายการนี้เคยส่งแจ้งเตือนแล้ว",
        text: "พบรายการที่เคยแจ้งเตือนไปยังกลุ่ม LINE แล้ว คุณต้องการส่งซ้ำอีกครั้งหรือไม่?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#0061A4",
        confirmButtonText: "ยืนยันส่งซ้ำ",
        cancelButtonText: "ยกเลิก"
      });
      if (!confirmRes.isConfirmed) {
        return;
      }
    }

    Swal.fire({
      title: "กำลังส่งข้อความ...",
      text: "กำลังส่งการแจ้งเตือนไปยังกลุ่ม LINE ด้วย Messaging API",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await ApiService.sendDailyLineNotification(true);
      if (res && res.success) {
        // อัปเดตสถานะใน local ให้ตรงกัน
        pending.forEach(p => {
          DataStore.update({ id: p.id, lineNotified: true });
        });

        Swal.fire({
          icon: "success",
          title: "ส่งแจ้งเตือนสำเร็จ!",
          text: res.message || `ส่งสรุปผู้ป่วย ${pending.length} ท่านไปยังกลุ่ม LINE เรียบร้อยแล้ว`,
          confirmButtonColor: "#0061A4"
        });
        this.closePreviewModal();
      } else {
        throw new Error(res.message || "ไม่สามารถส่งข้อความได้");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message,
        confirmButtonColor: "#B3261E"
      });
    }
  },

  // คัดลอกข้อความสรุปไปยัง Clipboard
  copySummaryToClipboard: function() {
    const rawTextEl = document.getElementById("lineRawTextSummary");
    if (!rawTextEl) return;

    rawTextEl.select();
    navigator.clipboard.writeText(rawTextEl.value).then(() => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "คัดลอกข้อความเรียบร้อย",
        showConfirmButton: false,
        timer: 2000
      });
    }).catch(() => {
      document.execCommand("copy");
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "คัดลอกข้อความเรียบร้อย",
        showConfirmButton: false,
        timer: 2000
      });
    });
  }
};

window.LineNotificationModule = LineNotificationModule;
