/**
 * ui.js - UI helpers: SVG icons, HTML escaping, modal control
 *
 * ไอคอนทั้งหมดเป็น SVG sprite ที่ฝังอยู่ใน index.html (id รูปแบบ "i-ชื่อไอคอน")
 * เรียกใช้ผ่าน icon("phone") แทนการใช้อิโมจิ
 */

// สร้างแท็ก SVG อ้างอิง sprite
function icon(name, extraClass) {
  return `<svg class="icon${extraClass ? " " + extraClass : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

// ป้องกัน HTML injection จากข้อมูลที่มาจาก Google Sheets
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ใช้กับค่า id ที่จะใส่ใน onclick="..." ตัดอักขระที่ไม่ใช่ตัวอักษร/ตัวเลข/-/./: ออก
function jsId(value) {
  return esc(String(value === null || value === undefined ? "" : value).replace(/[^\w\-.:]/g, ""));
}

const UI = {
  _lastFocus: null,

  openModal: function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    this._lastFocus = document.activeElement;
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");

    // โฟกัสช่องแรกที่กรอกได้ (หรือปุ่มปิด) เพื่อให้ใช้งานด้วยคีย์บอร์ดได้
    setTimeout(() => {
      const target = modal.querySelector("input:not([type=hidden]):not([type=checkbox]), select, textarea") ||
                     modal.querySelector("[data-modal-close]");
      // ไม่โฟกัสอัตโนมัติบนมือถือ เพื่อไม่ให้คีย์บอร์ดเด้งขึ้นบังฟอร์ม
      if (target && window.matchMedia("(min-width: 720px)").matches) target.focus();
    }, 60);
  },

  closeModal: function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("is-open");
    if (!document.querySelector(".modal.is-open")) {
      document.body.classList.remove("modal-open");
    }
    if (this._lastFocus && typeof this._lastFocus.focus === "function") {
      this._lastFocus.focus();
    }
  },

  init: function() {
    // คลิกพื้นหลังเพื่อปิด
    document.querySelectorAll(".modal").forEach(modal => {
      modal.addEventListener("mousedown", (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });

    // กด Esc เพื่อปิดหน้าต่างบนสุด
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelectorAll(".modal.is-open");
      if (open.length && !document.querySelector(".swal2-container")) {
        this.closeModal(open[open.length - 1].id);
      }
    });
  }
};

window.icon = icon;
window.esc = esc;
window.jsId = jsId;
window.UI = UI;
