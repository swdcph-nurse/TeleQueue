/**
 * lineNotification.js - LINE Messaging API Notification Manager & Flex Message Preview
 */

const LineNotificationModule = {
  // สรุปข้อความแบบ Text สวยงามสำหรับคัดลอกด้วยตนเอง
  generateTextSummary: function(patients, thaiDateStr) {
    if (!patients || patients.length === 0) {
      return `🏥 ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ\n🗓 ประจำวันที่ ${thaiDateStr}\n✅ ไม่มีคิวนัด Telemed ที่ต้องโทรติดตามสำหรับวันนี้`;
    }

    let text = `🏥 ตึกพิเศษปาริฉัตร - หอสงฆ์อาพาธ\n`;
    text += `📞 แจ้งเตือนนัด TELEMED ประจำวันที่ ${thaiDateStr}\n`;
    text += `⏰ สรุปรายชื่อผู้ป่วยที่ต้องโทรเยี่ยม (${patients.length} ท่าน):\n`;
    text += `────────────────────\n`;

    patients.forEach((p, index) => {
      text += `${index + 1}. ${p.name || "ไม่ระบุชื่อ"} (HN: ${p.hn || "-"})\n`;
      text += `   🩺 แผนก: ${p.department || "-"} | แพทย์: ${p.doctor || "-"}\n`;
      text += `   📞 โทร: ${p.phone || "ไม่มีเบอร์"}\n`;
      if (p.lineName) text += `   💬 Line: ${p.lineName}\n`;
      text += `   📝 นัดเพื่อ: ${p.notes || "ติดตามอาการ"}\n`;
      text += `────────────────────\n`;
    });

    text += `\n📋 ตรวจสอบและลงบันทึกคิว: ${CONFIG.GITHUB_REPO_URL}`;
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
          <div class="p-6 text-center text-slate-500 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div class="text-4xl mb-2">🎉</div>
            <h4 class="font-bold text-emerald-800 text-lg">ดำเนินการโทรครบแล้วทุกราย</h4>
            <p class="text-sm text-emerald-600 mt-1">ไม่มีผู้ป่วยที่ค้างโทรสำหรับวันนี้ (${thaiDateStr})</p>
          </div>
        `;
      } else {
        let itemsHtml = pending.map((p, idx) => `
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
            <div class="flex justify-between items-center font-bold text-slate-800 text-sm">
              <span>${idx + 1}. ${p.name}</span>
              <span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs">${p.department || "ทั่วไป"}</span>
            </div>
            <div class="text-slate-600 flex justify-between">
              <span>HN: <strong class="text-slate-900">${p.hn || "-"}</strong></span>
              <span>แพทย์: <strong>${p.doctor || "-"}</strong></span>
            </div>
            <div class="flex justify-between items-center text-slate-600">
              <span>โทร: <strong class="text-emerald-700">${p.phone || "ไม่มีเบอร์"}</strong></span>
              ${p.lineName ? `<span class="text-slate-500">Line: ${p.lineName}</span>` : ""}
            </div>
            <div class="text-slate-500 bg-white p-1.5 rounded border border-slate-100">
              📝 ${p.notes || "ติดตามอาการ"}
            </div>
          </div>
        `).join("");

        previewContainer.innerHTML = `
          <div class="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden font-sans">
            <div class="bg-sky-600 p-4 text-white">
              <div class="text-xs font-semibold uppercase tracking-wider text-sky-100">🏥 ตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ</div>
              <h3 class="text-base font-bold mt-0.5">📞 แจ้งเตือนนัด TELEMED ประจำวัน</h3>
              <div class="text-xs text-amber-200 font-medium mt-1">🗓 ${thaiDateStr} (รอโทร ${pending.length} ท่าน)</div>
            </div>
            <div class="p-3 space-y-2 max-h-72 overflow-y-auto">
              ${itemsHtml}
            </div>
            <div class="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <span class="inline-block w-full py-2 bg-sky-600 text-white text-xs font-bold rounded-lg shadow-sm">
                📋 เปิดระบบ TeleQueue เช็คคิว
              </span>
              <p class="text-[10px] text-slate-400 mt-1">ส่งผ่าน LINE Messaging API อัตโนมัติ</p>
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
    const modal = document.getElementById("lineNotificationModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  // ปิด Modal
  closePreviewModal: function() {
    const modal = document.getElementById("lineNotificationModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  // ดำเนินการยิง API แจ้งเตือนเข้า LINE กลุ่ม
  sendNotification: async function(force = false) {
    const pending = this.getPendingTodayPatients();
    if (pending.length === 0 && !force) {
      Swal.fire({
        icon: "info",
        title: "ไม่มีรายการที่ต้องแจ้งเตือน",
        text: "ผู้ป่วยทุกคนในวันนี้นัดโทรเรียบร้อยแล้ว หรือไม่มีนัดสำหรับวันนี้",
        confirmButtonColor: "#0284c7"
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
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#64748b",
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
          confirmButtonColor: "#0284c7"
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
        confirmButtonColor: "#ef4444"
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
