/**
 * app.js - Main Application Controller for TeleQueue
 *
 * หมายเหตุ: ตรรกะการทำงาน (DataStore / ApiService) คงเดิม
 * ปรับเฉพาะส่วนแสดงผลให้เป็น Material Design และใช้ไอคอน SVG แทนอิโมจิ
 */

// สีปุ่มของ SweetAlert2 ให้ตรงกับธีม
const COLOR = {
  primary: "#0061A4",
  success: "#146C2E",
  danger: "#B3261E"
};

const App = {
  activeTab: "dashboard",
  currentQueueDate: null,
  searchQuery: "",
  departmentFilter: "ALL",
  statusFilter: "ALL",
  isLoading: false,

  // เริ่มต้นระบบ
  init: async function() {
    this.currentQueueDate = getTodayIso();

    UI.init();

    // ตั้งค่าตัวเลือกผู้ใช้งาน
    this.initOperatorDisplay();

    // เริ่มต้น DataStore
    DataStore.init();

    // ย้ายค่า LINE เดิมที่เคยตั้งไว้ในเครื่องนี้ขึ้นเซิร์ฟเวอร์ (ครั้งเดียว) โดยไม่บล็อกหน้าจอ
    this.migrateLegacyLineSettings();

    // ผูก Event Listeners
    this.bindEvents();

    // อัปเดตสถิติและหน้าจอ
    this.renderAllViews();

    // ดึงข้อมูลล่าสุดจาก Google Sheets (ถ้าเชื่อมต่อแล้ว)
    this.syncWithGoogleSheets();
  },

  // แสดงและสลับชื่อผู้ปฏิบัติหน้าที่
  initOperatorDisplay: function() {
    const op = CONFIG.getCurrentOperator();
    const el = document.getElementById("currentOperatorName");
    if (el) el.textContent = op;
  },

  promptChangeOperator: async function() {
    const current = CONFIG.getCurrentOperator();
    const { value: name } = await Swal.fire({
      title: "ระบุชื่อผู้ปฏิบัติหน้าที่",
      input: "text",
      inputLabel: "ชื่อ-สกุล หรือ รหัสเจ้าหน้าที่ (สำหรับลงบันทึกเวร)",
      inputValue: current,
      showCancelButton: true,
      confirmButtonColor: COLOR.primary,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "กรุณาระบุชื่อผู้ปฏิบัติหน้าที่";
        }
      }
    });

    if (name) {
      CONFIG.setCurrentOperator(name.trim());
      this.initOperatorDisplay();
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `ผู้ปฏิบัติหน้าที่: ${name.trim()}`,
        showConfirmButton: false,
        timer: 1500
      });
    }
  },

  // ผูกการทำงานของปุ่มและอินพุตต่างๆ
  bindEvents: function() {
    const self = this;

    // ปุ่มสลับแท็บ
    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.getAttribute("data-tab");
        self.switchTab(tab);
      });
    });

    // ปุ่มค้นหา
    const searchInput = document.getElementById("globalSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        self.searchQuery = e.target.value.trim().toLowerCase();
        self.renderManageTable();
      });
    }

    // ตัวกรองแผนกในหน้าจัดการ
    const deptSelect = document.getElementById("manageDeptFilter");
    if (deptSelect) {
      deptSelect.addEventListener("change", (e) => {
        self.departmentFilter = e.target.value;
        self.renderManageTable();
      });
    }

    // ตัวกรองสถานะในหน้าจัดการ
    const statusSelect = document.getElementById("manageStatusFilter");
    if (statusSelect) {
      statusSelect.addEventListener("change", (e) => {
        self.statusFilter = e.target.value;
        self.renderManageTable();
      });
    }

    // คลิกที่แถวในตารางเพื่อเปิดรายละเอียด (ไม่รบกวนปุ่ม ลิงก์ และช่องติ๊กในแถว)
    ["todayQueueTableBody", "manageTableBody"].forEach(id => {
      const tbody = document.getElementById(id);
      if (!tbody) return;
      const open = (e) => {
        if (e.target.closest("a, button, input, label, select, textarea")) return;
        const row = e.target.closest("tr[data-id]");
        if (row) self.openPatientDetailModalById(row.getAttribute("data-id"));
      };
      tbody.addEventListener("click", open);
      tbody.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-id]")) {
          e.preventDefault();
          open(e);
        }
      });
    });

    // วันที่ในหน้าคิวนัดวันนี้
    const queueDateInput = document.getElementById("queueDateInput");
    if (queueDateInput) {
      queueDateInput.value = this.currentQueueDate;
      queueDateInput.addEventListener("change", (e) => {
        if (!e.target.value) return;
        self.currentQueueDate = e.target.value;
        self.renderTodayQueue();
      });
    }
  },

  // สลับแท็บ
  switchTab: function(tabName) {
    this.activeTab = tabName;

    // เปลี่ยนสถานะปุ่มเมนู (ทั้งแถบล่างบนมือถือและแถบข้างบนเดสก์ท็อป)
    document.querySelectorAll("[data-tab]").forEach(btn => {
      const active = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("is-active", active);
      if (active) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    // แสดง/ซ่อน Section
    const tabs = ["dashboard", "calendar", "today", "manage"];
    tabs.forEach(t => {
      const section = document.getElementById(`tab-${t}`);
      if (!section) return;
      if (t === tabName) {
        section.classList.remove("hidden");
        section.classList.remove("animate-in");
        void section.offsetWidth; // รีสตาร์ทแอนิเมชัน
        section.classList.add("animate-in");
      } else {
        section.classList.add("hidden");
      }
    });

    window.scrollTo({ top: 0 });

    // โหลดข้อมูลเฉพาะของแท็บนั้น
    if (tabName === "calendar") {
      setTimeout(() => {
        CalendarModule.init("calendarContainer");
      }, 50);
    } else if (tabName === "today") {
      this.renderTodayQueue();
    } else if (tabName === "manage") {
      this.renderManageTable();
    } else if (tabName === "dashboard") {
      this.renderDashboard();
    }
  },

  // แสดงสถานะการซิงค์ที่มุมบนขวา
  setSyncStatus: function(state, text) {
    const el = document.getElementById("syncStatusIndicator");
    if (!el) return;
    el.setAttribute("data-state", state);
    el.setAttribute("title", text);
    el.innerHTML = `<span class="dot"></span><span class="sync-text">${esc(text)}</span>`;
  },

  // ซิงค์ข้อมูลกับ Google Sheets
  syncWithGoogleSheets: async function() {
    this.setSyncStatus("loading", "กำลังซิงค์ข้อมูล...");

    try {
      const res = await ApiService.request("getAll");
      const hasGas = ApiService.hasGasUrl();
      if (res && res.success && !res.fromCache) {
        if (Array.isArray(res.data)) DataStore.setAll(res.data);
        this.setSyncStatus("ok", "เชื่อมต่อ Google Sheets แล้ว");
      } else {
        const list = DataStore.getAll();
        if (!hasGas) {
          this.setSyncStatus("local", `ฐานข้อมูลท้องถิ่น (${list.length} รายการ)`);
        } else {
          this.setSyncStatus("error", `ซิงค์ขัดข้อง (ใช้ข้อมูลแคช ${list.length} รายการ)`);
        }
      }
      this.renderAllViews();
    } catch (e) {
      console.error("Sync error:", e);
      this.setSyncStatus("error", "ซิงค์ขัดข้อง (ใช้ข้อมูลแคช)");
    }
  },

  // อัปเดตทุกหน้าจอ
  renderAllViews: function() {
    this.renderDashboard();
    this.renderTodayQueue();
    this.renderManageTable();
    if (this.activeTab === "calendar") {
      CalendarModule.refetchEvents();
    }
  },

  // ==========================================
  // 1. Dashboard View
  // ==========================================
  renderDashboard: function() {
    const stats = DataStore.calculateStats();

    const dateEl = document.getElementById("dashboardDate");
    if (dateEl) dateEl.textContent = `ข้อมูลประจำวันที่ ${formatThaiDateDisplay(getTodayIso())}`;

    // การ์ด 1: สรุปนัดวันนี้
    const todayCountEl = document.getElementById("statTodayCount");
    if (todayCountEl) todayCountEl.textContent = stats.todayCount;

    // การ์ด 2: นัดทั้งหมด
    const totalCountEl = document.getElementById("statTotalCount");
    if (totalCountEl) totalCountEl.textContent = stats.totalCount;

    // การ์ด 3: นัดที่ยังไม่ได้โทร
    const pendingCallEl = document.getElementById("statPendingCall");
    if (pendingCallEl) {
      pendingCallEl.textContent = stats.pendingCallToday;
      const sub = document.getElementById("statPendingCallSub");
      if (sub) sub.textContent = `ค้างโทรทั้งหมด ${stats.pendingCallAll} ราย`;
    }

    // การ์ด 4: โทรแล้วและบันทึก HosXP แล้ว
    const completedEl = document.getElementById("statCompleted");
    if (completedEl) {
      completedEl.textContent = stats.completedToday;
      const sub = document.getElementById("statCompletedSub");
      if (sub) sub.textContent = `เสร็จสมบูรณ์รวม ${stats.completedAll} ราย`;
    }

    // กล่องแจ้งเตือน: รายการที่ยังดำเนินการไม่ครบในวันนี้
    this.renderIncompleteAlerts(stats.incompleteTodayList);

    // สรุปแยกตามแผนก
    this.renderDepartmentStats(stats.deptStats);
  },

  // แจ้งเตือนรายการที่ยังดำเนินการไม่ครบ
  renderIncompleteAlerts: function(incompleteList) {
    const container = document.getElementById("incompleteAlertsContainer");
    if (!container) return;

    if (!incompleteList || incompleteList.length === 0) {
      container.innerHTML = `
        <div class="panel panel--done">
          <div class="panel-icon">${icon("check-circle", "icon--lg")}</div>
          <div>
            <h4 class="panel-title">การดำเนินการวันนี้ครบถ้วนทุกรายการแล้ว</h4>
            <p class="page-sub" style="color:inherit;opacity:.8">โทรนัดและลงบันทึกในระบบ HosXP ครบ 100%</p>
          </div>
        </div>
      `;
      return;
    }

    const items = incompleteList.map(a => {
      const missingTele = !a.tele;
      const missingHos = !a.hosxp;

      let badge = "";
      if (missingTele && missingHos) {
        badge = `<span class="badge badge--error">รอโทร และรอลง Hos</span>`;
      } else if (missingTele) {
        badge = `<span class="badge badge--warning">ยังไม่โทร</span>`;
      } else if (missingHos) {
        badge = `<span class="badge badge--warning">ยังไม่ลง HosXP</span>`;
      }

      const phone = a.phone
        ? `<a href="tel:${esc(String(a.phone).replace(/[^0-9]/g, ""))}" class="phone-link">${esc(a.phone)}</a>`
        : `<span class="cell-muted">ไม่มีเบอร์</span>`;

      const id = jsId(a.id);

      return `
        <div class="task">
          <div class="task-main">
            <span class="dept">${esc(a.department || CONFIG.DEPARTMENTS[0])}</span>
            <div style="min-width:0">
              <div class="task-name-row">
                <span class="task-name">${esc(a.name)}</span>
                <span class="task-hn">HN ${esc(a.hn || "-")}</span>
                ${badge}
              </div>
              <div class="task-meta">
                <span class="meta">${icon("stethoscope")} แพทย์ ${esc(a.doctor || "-")}</span>
                <span class="meta">${icon("phone")} ${phone}</span>
                <span class="meta">${icon("note")} ${esc(a.notes || "ติดตามอาการ")}</span>
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button type="button" onclick="App.quickToggleTele('${id}', ${!a.tele})" class="btn btn--sm ${a.tele ? "btn--success-tonal" : "btn--outlined"}">
              ${a.tele ? icon("check") : icon("phone")}
              <span>${a.tele ? "โทรแล้ว" : "ยืนยันโทร"}</span>
            </button>
            <button type="button" onclick="App.quickToggleHos('${id}', ${!a.hosxp})" class="btn btn--sm ${a.hosxp ? "btn--success-tonal" : "btn--outlined"}">
              ${a.hosxp ? icon("check") : icon("monitor")}
              <span>${a.hosxp ? "ลง Hos แล้ว" : "ยืนยันลง Hos"}</span>
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="panel panel--attention">
        <div class="panel-head">
          <h4 class="panel-title">
            <span class="pulse-dot"></span>
            <span>รายการนัดวันนี้ที่ยังดำเนินการไม่ครบ (${incompleteList.length} ราย)</span>
          </h4>
          <button type="button" onclick="App.switchTab('today')" class="btn btn--text btn--sm">
            <span>ดูคิววันนี้ทั้งหมด</span>
            ${icon("arrow-right")}
          </button>
        </div>
        <div class="task-list">
          ${items}
        </div>
      </div>
    `;
  },

  // สรุปสถิติตามแผนก
  renderDepartmentStats: function(deptStats) {
    const container = document.getElementById("deptStatsContainer");
    if (!container) return;

    const keys = Object.keys(deptStats);
    if (keys.length === 0) {
      container.innerHTML = `<p class="empty-text">ไม่มีข้อมูล</p>`;
      return;
    }

    const max = Math.max(...keys.map(k => deptStats[k]), 1);

    container.innerHTML = keys.map(k => `
      <div class="dept-row">
        <span class="dept-name" title="${esc(k)}">${esc(k)}</span>
        <div class="bar" role="img" aria-label="${esc(k)} ${deptStats[k]} ราย"><span style="width:${deptStats[k] ? Math.max(4, Math.round(deptStats[k] / max * 100)) : 0}%"></span></div>
        <span class="dept-count">${deptStats[k]} ราย</span>
      </div>
    `).join("");
  },

  // ==========================================
  // 2. Today's Queue View
  // ==========================================
  renderTodayQueue: function() {
    const dateQuery = this.currentQueueDate || getTodayIso();
    const todayList = DataStore.getByDate(dateQuery);
    const thaiDate = formatThaiDateDisplay(dateQuery);

    const titleEl = document.getElementById("queueDateHeaderTitle");
    if (titleEl) {
      titleEl.textContent = `รายการนัดประจำวันที่ ${thaiDate} (${todayList.length} ราย)`;
    }

    const queueInput = document.getElementById("queueDateInput");
    if (queueInput && queueInput.value !== dateQuery) queueInput.value = dateQuery;

    const container = document.getElementById("todayQueueTableBody");
    if (!container) return;

    if (todayList.length === 0) {
      container.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">
            <div class="empty">
              <div class="empty-icon">${icon("calendar-empty", "icon--xl")}</div>
              <div class="empty-title">ไม่มีรายการนัดหมายสำหรับวันที่ ${esc(thaiDate)}</div>
              <p class="empty-text">กดปุ่ม "เพิ่มนัด" เพื่อสร้างรายการใหม่</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const rows = todayList.map((a, idx) => {
      const isComplete = a.tele && a.hosxp;
      const id = jsId(a.id);

      const phoneHtml = a.phone
        ? `<a href="tel:${esc(String(a.phone).replace(/[^0-9]/g, ""))}" class="phone-link">${icon("phone")}<span>${esc(a.phone)}</span></a>`
        : `<span class="cell-muted">ไม่มีเบอร์โทร</span>`;

      return `
        <tr class="row-link ${isComplete ? "row--done" : ""}" data-id="${id}" tabindex="0" title="คลิกเพื่อดูรายละเอียด">
          <td class="cell-index">${idx + 1}</td>
          <td class="cell-patient">
            <div class="cell-name">${esc(a.name)}</div>
            <div class="cell-sub">HN <strong class="mono">${esc(a.hn || "-")}</strong> &nbsp;|&nbsp; ปชช. <span class="mono">${esc(a.cid || "-")}</span></div>
            ${a.lineName ? `<div class="cell-line">${icon("message")}<span>LINE: ${esc(a.lineName)}</span></div>` : ""}
          </td>
          <td class="cell-dept">
            <span class="dept">${esc(a.department || "-")}</span>
            <div class="cell-doc">พ. ${esc(a.doctor || "-")}</div>
          </td>
          <td class="cell-contact">
            ${phoneHtml}
            <div class="cell-notes" title="${esc(a.notes || "")}">${icon("note")}<span>${esc(a.notes || "-")}</span></div>
          </td>
          <td class="center cell-check" data-label="โทรนัด (TELE)">
            <label class="check-cell">
              <span class="check check--success">
                <input type="checkbox" ${a.tele ? "checked" : ""} aria-label="โทรนัดแล้ว: ${esc(a.name)}" onchange="App.handleCheckboxChange('${id}', 'tele', this.checked)">
              </span>
              <span class="check-text">
                <span class="check-state ${a.tele ? "is-on" : ""}">${a.tele ? "โทรแล้ว" : "ยังไม่โทร"}</span>
                ${a.teleOperator ? `<span class="check-by" title="${esc(a.teleOperator)} (${esc(a.teleTime || "")})">${esc(a.teleOperator)}</span>` : ""}
              </span>
            </label>
          </td>
          <td class="center cell-check" data-label="บันทึก HosXP">
            <label class="check-cell">
              <span class="check">
                <input type="checkbox" ${a.hosxp ? "checked" : ""} aria-label="บันทึก HosXP แล้ว: ${esc(a.name)}" onchange="App.handleCheckboxChange('${id}', 'hosxp', this.checked)">
              </span>
              <span class="check-text">
                <span class="check-state ${a.hosxp ? "is-on" : ""}">${a.hosxp ? "ลง Hos แล้ว" : "ยังไม่ลง"}</span>
                ${a.hosOperator ? `<span class="check-by" title="${esc(a.hosOperator)} (${esc(a.hosTime || "")})">${esc(a.hosOperator)}</span>` : ""}
              </span>
            </label>
          </td>
          <td class="cell-actions no-print">
            <div class="actions">
              <button type="button" onclick="App.openEditAppointmentModal('${id}')" class="icon-btn icon-btn--primary" title="แก้ไข" aria-label="แก้ไข ${esc(a.name)}">${icon("edit")}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = rows;
  },

  // เปลี่ยนวันในหน้าคิว
  viewQueueForDate: function(isoDate) {
    this.currentQueueDate = isoDate;
    const queueInput = document.getElementById("queueDateInput");
    if (queueInput) queueInput.value = isoDate;
    this.switchTab("today");
  },

  // เลื่อนวันในหน้าคิว (delta = -1 / +1) หรือกลับมาวันนี้ (delta = 0)
  shiftQueueDate: function(delta) {
    if (delta === 0) {
      this.currentQueueDate = getTodayIso();
    } else {
      const parts = (this.currentQueueDate || getTodayIso()).split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2] + delta);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      this.currentQueueDate = `${y}-${m}-${day}`;
    }
    const queueInput = document.getElementById("queueDateInput");
    if (queueInput) queueInput.value = this.currentQueueDate;
    this.renderTodayQueue();
  },

  // ==========================================
  // Checkbox Event & Operator Recording
  // ==========================================
  handleCheckboxChange: async function(aptId, field, isChecked) {
    const apt = DataStore.getById(aptId);
    if (!apt) return;

    const opName = CONFIG.getCurrentOperator();
    const timeNow = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updateData = {
      id: apt.id,
      rowIndex: apt.rowIndex,
      [field]: isChecked
    };

    if (isChecked) {
      if (field === "tele") {
        updateData.teleOperator = opName;
        updateData.teleTime = timeNow;
      } else if (field === "hosxp") {
        updateData.hosOperator = opName;
        updateData.hosTime = timeNow;
      }
    }

    // อัปเดต DataStore ทันที
    DataStore.update(updateData);
    this.renderDashboard();
    this.renderTodayQueue();
    this.renderManageTable();
    if (this.activeTab === "calendar") CalendarModule.refetchEvents();

    // บันทึกลง Google Sheets ผ่าน API
    try {
      const res = await ApiService.updateStatus(apt.rowIndex, field, isChecked, opName);

      const fieldTitle = field === "tele" ? "ยืนยันการโทร" : "ยืนยันบันทึก HosXP";
      const syncNote = (res && res.fromCache) ? " (บันทึกในเครื่องชั่วคราว)" : " (ลง Google Sheets แล้ว)";
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `${fieldTitle}: ${apt.name}`,
        text: `ผู้บันทึก: ${opName}${syncNote}`,
        showConfirmButton: false,
        timer: 2000
      });
    } catch (e) {
      console.error("Update status error:", e);
    }
  },

  quickToggleTele: function(aptId, isChecked) {
    this.handleCheckboxChange(aptId, "tele", isChecked);
  },

  quickToggleHos: function(aptId, isChecked) {
    this.handleCheckboxChange(aptId, "hosxp", isChecked);
  },

  // ==========================================
  // 3. Manage Appointments Table
  // ==========================================
  renderManageTable: function() {
    const appointments = DataStore.getAll();
    const query = this.searchQuery;
    const dept = this.departmentFilter;
    const status = this.statusFilter;

    const filtered = appointments.filter(a => {
      // ค้นหา
      if (query) {
        const target = `${a.name} ${a.hn} ${a.cid} ${a.phone} ${a.doctor} ${a.notes} ${a.department} ${a.lineName}`.toLowerCase();
        if (!target.includes(query)) return false;
      }
      // แผนก
      if (dept !== "ALL") {
        if ((a.department || "").toUpperCase() !== dept.toUpperCase()) return false;
      }
      // สถานะ
      if (status !== "ALL") {
        if (status === "COMPLETED" && (!a.tele || !a.hosxp)) return false;
        if (status === "PARTIAL" && !((a.tele && !a.hosxp) || (!a.tele && a.hosxp))) return false;
        if (status === "PENDING" && (a.tele || a.hosxp)) return false;
        if (status === "NO_CALL" && a.tele) return false;
      }
      return true;
    });

    // เรียงตามวันนัด: ล่าสุดอยู่บนสุด (วันเดียวกันให้แถวที่เพิ่มล่าสุดขึ้นก่อน)
    filtered.sort((x, y) => {
      const byDate = String(y.date || "").localeCompare(String(x.date || ""));
      if (byDate !== 0) return byDate;
      return (Number(y.rowIndex) || 0) - (Number(x.rowIndex) || 0);
    });

    const countEl = document.getElementById("manageTableCount");
    if (countEl) countEl.textContent = `พบ ${filtered.length} รายการ (จากทั้งหมด ${appointments.length} รายการ)`;

    const tbody = document.getElementById("manageTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            <div class="empty">
              <div class="empty-icon">${icon("search", "icon--xl")}</div>
              <div class="empty-title">ไม่พบนัดหมายที่ตรงกับเงื่อนไข</div>
              <p class="empty-text">ลองเปลี่ยนคำค้นหา หรือล้างตัวกรอง</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const rows = filtered.map((a, idx) => {
      let statusBadge = "";
      if (a.tele && a.hosxp) {
        statusBadge = `<span class="badge badge--success">${icon("check")}ครบถ้วน</span>`;
      } else if (a.tele || a.hosxp) {
        statusBadge = `<span class="badge badge--warning">${icon("hourglass")}บางส่วน</span>`;
      } else {
        statusBadge = `<span class="badge badge--error">${icon("x")}รอเริ่ม</span>`;
      }

      const id = jsId(a.id);

      return `
        <tr class="row-link" data-id="${id}" tabindex="0" title="คลิกเพื่อดูรายละเอียด">
          <td class="cell-index">${idx + 1}</td>
          <td class="cell-date" data-label="วันนัด" style="white-space:nowrap">
            <div class="cell-name">${esc(a.thaiDate)}</div>
            <div class="cell-sub mono">${esc(a.date)}</div>
          </td>
          <td class="cell-patient" data-label="ผู้ป่วย">
            <div class="cell-name">${esc(a.name)}</div>
            <div class="cell-sub mono">HN ${esc(a.hn || "-")}</div>
          </td>
          <td class="cell-dept" data-label="แผนก / แพทย์">
            <span class="dept">${esc(a.department || "-")}</span>
            <div class="cell-doc">พ. ${esc(a.doctor || "-")}</div>
          </td>
          <td class="cell-contact" data-label="เบอร์โทร / LINE">
            <div style="font-weight:600">${esc(a.phone || "-")}</div>
            ${a.lineName ? `<div class="cell-sub">LINE: ${esc(a.lineName)}</div>` : ""}
          </td>
          <td class="cell-notes-col cell-trunc" data-label="หมายเหตุ" title="${esc(a.notes || "")}">${esc(a.notes || "-")}</td>
          <td class="center cell-status" data-label="สถานะ" style="white-space:nowrap">${statusBadge}</td>
          <td class="cell-actions">
            <div class="actions">
              <button type="button" onclick="App.openEditAppointmentModal('${id}')" class="icon-btn icon-btn--primary" title="แก้ไข" aria-label="แก้ไข ${esc(a.name)}">${icon("edit")}</button>
              <button type="button" onclick="App.confirmDeleteAppointment('${id}')" class="icon-btn icon-btn--danger" title="ลบ" aria-label="ลบ ${esc(a.name)}">${icon("trash")}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = rows;
  },

  // ==========================================
  // Modal Handlers: Add, Edit, Detail, Settings
  // ==========================================

  // เปิด Modal เพิ่มนัดหมายใหม่
  openAddAppointmentModal: function() {
    const form = document.getElementById("appointmentForm");
    if (form) form.reset();

    const idInput = document.getElementById("formAppointmentId");
    if (idInput) idInput.value = "";

    const titleEl = document.getElementById("appointmentModalTitle");
    if (titleEl) titleEl.textContent = "เพิ่มนัดหมาย Telemed ใหม่";

    const dateInput = document.getElementById("formDate");
    if (dateInput) dateInput.value = this.currentQueueDate || getTodayIso();

    UI.openModal("appointmentModal");
  },

  // เปิด Modal แก้ไขนัดหมาย
  openEditAppointmentModal: function(aptId) {
    const apt = DataStore.getById(aptId);
    if (!apt) return;

    const idInput = document.getElementById("formAppointmentId");
    if (idInput) idInput.value = apt.id;

    const titleEl = document.getElementById("appointmentModalTitle");
    if (titleEl) titleEl.textContent = "แก้ไขข้อมูลนัดหมาย";

    document.getElementById("formDate").value = apt.date || "";
    document.getElementById("formName").value = apt.name || "";
    document.getElementById("formCid").value = apt.cid || "";
    document.getElementById("formHn").value = apt.hn || "";
    UI.setSelectValue(document.getElementById("formDept"), apt.department || CONFIG.DEPARTMENTS[0]);
    document.getElementById("formDoctor").value = apt.doctor || "";
    document.getElementById("formPhone").value = apt.phone || "";
    document.getElementById("formLineName").value = apt.lineName || "";
    document.getElementById("formNotes").value = apt.notes || "";
    document.getElementById("formTele").checked = apt.tele === true;
    document.getElementById("formHosxp").checked = apt.hosxp === true;

    UI.openModal("appointmentModal");
  },

  closeAppointmentModal: function() {
    UI.closeModal("appointmentModal");
  },

  // บันทึกฟอร์มเพิ่ม/แก้ไข
  handleSaveAppointment: async function(e) {
    if (e) e.preventDefault();

    const id = document.getElementById("formAppointmentId").value;
    const date = document.getElementById("formDate").value;
    const name = document.getElementById("formName").value.trim();
    const cid = document.getElementById("formCid").value.trim();
    const hn = document.getElementById("formHn").value.trim();
    const department = document.getElementById("formDept").value.trim();
    const doctor = document.getElementById("formDoctor").value.trim();
    const phone = document.getElementById("formPhone").value.trim();
    const lineName = document.getElementById("formLineName").value.trim();
    const notes = document.getElementById("formNotes").value.trim();
    const tele = document.getElementById("formTele").checked;
    const hosxp = document.getElementById("formHosxp").checked;

    if (!name || !date) {
      Swal.fire({
        icon: "warning",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
        text: "ระบุชื่อ-สกุลผู้ป่วย และวันนัดหมาย",
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    const payload = {
      date,
      name,
      cid,
      hn,
      department,
      doctor,
      phone,
      lineName,
      notes,
      tele,
      hosxp,
      operator: CONFIG.getCurrentOperator()
    };

    Swal.fire({
      title: "กำลังบันทึกข้อมูล...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let res;
      if (id) {
        // แก้ไข
        const existing = DataStore.getById(id);
        payload.id = id;
        payload.rowIndex = existing ? existing.rowIndex : null;
        res = await ApiService.updateAppointment(payload);
      } else {
        // เพิ่มใหม่
        res = await ApiService.addAppointment(payload);
      }

      this.closeAppointmentModal();
      this.renderAllViews();

      if (res && res.fromCache) {
        Swal.fire({
          icon: "warning",
          title: "บันทึกในเครื่องแล้ว แต่ยังไม่ลง Google Sheets",
          html: `
            <div class="help">
              <p class="help-error" style="color:var(--warning)">ข้อมูลแสดงบนหน้าเว็บแล้ว แต่ยังไม่สามารถส่งเข้า Google Sheets ได้</p>
              <p><strong>สาเหตุ:</strong> ${esc(res.errorMessage ? res.errorMessage : "ยังไม่ได้ระบุ Web App URL หรือ URL ยังเชื่อมต่อไม่ได้")}</p>
              <div class="help-box help-box--warn">
                <div class="help-box-title">วิธีเปิดการเชื่อมต่อกับ Google Sheets</div>
                <ol>
                  <li>เปิด Google Apps Script ในชีตของคุณ</li>
                  <li>กด <strong>การทำให้ใช้งานได้ (Deploy)</strong> &gt; <strong>การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong></li>
                  <li>เลือก <strong>เว็บแอป (Web app)</strong> และตั้งสิทธิ์เข้าถึง (Who has access) เป็น <strong>ทุกคน (Anyone)</strong></li>
                  <li>คัดลอก Web App URL มาใส่ในเมนู <strong>ตั้งค่า</strong> มุมบนขวาของหน้าเว็บนี้ แล้วกดบันทึก</li>
                </ol>
              </div>
            </div>
          `,
          confirmButtonColor: COLOR.primary
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "บันทึกลง Google Sheets สำเร็จ",
          text: `บันทึกข้อมูลของ ${name} เรียบร้อยแล้ว`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: err.message,
        confirmButtonColor: COLOR.danger
      });
    }
  },

  // ยืนยันการลบนัดหมาย
  confirmDeleteAppointment: async function(aptId) {
    const apt = DataStore.getById(aptId);
    if (!apt) return;

    const res = await Swal.fire({
      title: "ยืนยันการยกเลิก/ลบนัดหมาย?",
      text: `ต้องการลบนัดหมายของ ${apt.name} (HN: ${apt.hn || "-"}) ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: COLOR.danger,
      confirmButtonText: "ลบนัดหมาย",
      cancelButtonText: "ยกเลิก"
    });

    if (res.isConfirmed) {
      try {
        await ApiService.deleteAppointment(apt.rowIndex || apt.id);
        this.renderAllViews();
        Swal.fire({
          icon: "success",
          title: "ลบรายการเรียบร้อย",
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "ไม่สามารถลบได้",
          text: err.message
        });
      }
    }
  },

  // เปิดดูรายละเอียดคนไข้
  openPatientDetailModalById: function(aptId) {
    const apt = DataStore.getById(aptId);
    if (apt) this.openPatientDetailModal(apt);
  },

  openPatientDetailModal: function(apt) {
    const container = document.getElementById("patientDetailBody");
    if (!container) return;

    const id = jsId(apt.id);

    const statusTele = apt.tele
      ? `<div class="status-line status-line--ok">${icon("check-circle")}<div><strong>โทรนัดแล้ว</strong><small>${esc(apt.teleOperator || "เจ้าหน้าที่")} ${esc(apt.teleTime || "")}</small></div></div>`
      : `<div class="status-line status-line--no">${icon("x-circle")}<div><strong>ยังไม่ได้โทร</strong></div></div>`;

    const statusHos = apt.hosxp
      ? `<div class="status-line status-line--ok">${icon("check-circle")}<div><strong>ลงบันทึก HosXP แล้ว</strong><small>${esc(apt.hosOperator || "เจ้าหน้าที่")} ${esc(apt.hosTime || "")}</small></div></div>`
      : `<div class="status-line status-line--no">${icon("x-circle")}<div><strong>ยังไม่ได้ลง HosXP</strong></div></div>`;

    container.innerHTML = `
      <div class="detail">
        <div class="detail-hero">
          <div style="min-width:0">
            <h3 class="detail-name">${esc(apt.name)}</h3>
            <div class="detail-id">HN ${esc(apt.hn || "-")} &nbsp;|&nbsp; เลข ปชช. ${esc(apt.cid || "-")}</div>
            <div class="detail-date">${icon("calendar", "icon--sm")}<span>วันนัด <strong>${esc(apt.thaiDate)}</strong> (${esc(apt.date)})</span></div>
          </div>
          <span class="badge badge--info" style="background:#fff">${esc(apt.department || CONFIG.DEPARTMENTS[0])}</span>
        </div>

        <div class="kv-grid">
          <div class="kv">
            <div class="kv-label">แพทย์ผู้นัด</div>
            <div class="kv-value">${esc(apt.doctor || "-")}</div>
          </div>
          <div class="kv">
            <div class="kv-label">เบอร์โทรศัพท์</div>
            <div class="kv-value">
              ${apt.phone
                ? `<a href="tel:${esc(String(apt.phone).replace(/[^0-9]/g, ""))}" class="phone-link">${icon("phone")}<span>${esc(apt.phone)}</span></a>`
                : `<span class="cell-muted">ไม่มีเบอร์โทร</span>`}
            </div>
          </div>
          ${apt.lineName ? `
            <div class="kv span-2" style="grid-column:1/-1">
              <div class="kv-label">ชื่อ LINE</div>
              <div class="kv-value">${esc(apt.lineName)}</div>
            </div>
          ` : ""}
          <div class="kv" style="grid-column:1/-1">
            <div class="kv-label">หมายเหตุ / เหตุผลการนัด</div>
            <div class="kv-value" style="font-weight:500">${esc(apt.notes || "ติดตามอาการ")}</div>
          </div>
        </div>

        <div class="kv">
          <div class="kv-label" style="margin-bottom:4px">สถานะการปฏิบัติงาน</div>
          ${statusTele}
          ${statusHos}
        </div>
      </div>
    `;

    // ปุ่มดำเนินการด้านล่าง
    const foot = document.getElementById("patientDetailFoot");
    if (foot) foot.innerHTML = `
      <button type="button" onclick="App.quickToggleTele('${id}', ${!apt.tele}); App.closePatientDetailModal();" class="btn ${apt.tele ? "btn--outlined" : "btn--success"}">
        ${apt.tele ? icon("x") : icon("phone")}
        <span>${apt.tele ? "ยกเลิกสถานะโทร" : "บันทึกว่าโทรแล้ว"}</span>
      </button>
      <button type="button" onclick="App.quickToggleHos('${id}', ${!apt.hosxp}); App.closePatientDetailModal();" class="btn ${apt.hosxp ? "btn--outlined" : "btn--filled"}">
        ${apt.hosxp ? icon("x") : icon("monitor")}
        <span>${apt.hosxp ? "ยกเลิกสถานะ Hos" : "บันทึกว่าลง HosXP แล้ว"}</span>
      </button>
    `;

    UI.openModal("patientDetailModal");
  },

  closePatientDetailModal: function() {
    UI.closeModal("patientDetailModal");
  },

  // ==========================================
  // Settings Modal
  // ==========================================
  serverSettings: null,

  openSettingsModal: function() {
    const gasInput = document.getElementById("settingGasUrl");
    if (gasInput) gasInput.value = CONFIG.getGasUrl();

    const sheetInput = document.getElementById("settingSheetName");
    if (sheetInput) sheetInput.value = CONFIG.getSheetName();

    // Token / Destination ID เก็บกลางที่เซิร์ฟเวอร์ — โหลดมาแสดงหลังเปิดหน้าต่าง
    const tokenInput = document.getElementById("settingLineToken");
    if (tokenInput) { tokenInput.value = ""; tokenInput.placeholder = "กำลังโหลดจากเซิร์ฟเวอร์..."; }
    const groupInput = document.getElementById("settingLineGroupId");
    if (groupInput) groupInput.value = "";

    const operatorInput = document.getElementById("settingDefaultOperator");
    if (operatorInput) operatorInput.value = CONFIG.getCurrentOperator();

    UI.openModal("settingsModal");
    this.loadServerSettings(true);
  },

  closeSettingsModal: function() {
    UI.closeModal("settingsModal");
  },

  // แสดงสถานะการแจ้งเตือนอัตโนมัติจากข้อมูลบนเซิร์ฟเวอร์
  renderAutoStatus: function(st, errorMsg) {
    const badge = document.getElementById("autoStatusBadge");
    const text = document.getElementById("autoStatusText");
    if (!badge || !text) return;
    const setBadge = (cls, label) => { badge.className = "badge " + cls; badge.textContent = label; };

    if (errorMsg) {
      setBadge("badge--error", "เชื่อมต่อไม่ได้");
      text.textContent = "ดึงการตั้งค่าจากเซิร์ฟเวอร์ไม่ได้: " + errorMsg;
      return;
    }
    const hh = String(st.reminderHour == null ? 8 : st.reminderHour).padStart(2, "0");
    const lines = [];
    if (!st.hasLineToken || !st.lineDestinationId) {
      setBadge("badge--warning", "ยังตั้งค่าไม่ครบ");
      lines.push("ยังไม่ได้ตั้ง LINE Token และ Destination ID กรอกแล้วกดบันทึกครั้งเดียว ทุกเครื่องจะใช้ร่วมกัน");
    } else if (!st.trigger || !st.trigger.active) {
      setBadge("badge--warning", "ยังไม่ตั้งเวลา");
      lines.push("ยังไม่มีตัวตั้งเวลาส่งอัตโนมัติ กดปุ่มด้านล่างเพื่อตั้งเวลา" + (st.trigger && st.trigger.error ? " (" + st.trigger.error + ")" : ""));
    } else {
      setBadge("badge--success", "เปิดใช้งาน");
      lines.push("ส่งอัตโนมัติทุกวันประมาณ " + hh + ":00 น. (คลาดเคลื่อนได้ราว 15 นาที)");
    }
    const last = st.lastDailyRun;
    if (last && last.time) {
      lines.push("ส่งอัตโนมัติครั้งล่าสุด: " + last.time + " — " + (last.success ? "สำเร็จ" : "ไม่สำเร็จ") + " (" + last.message + ")");
      if (!last.success) setBadge("badge--error", "ครั้งล่าสุดล้มเหลว");
    } else {
      lines.push("ยังไม่มีประวัติการส่งอัตโนมัติ");
    }
    text.textContent = lines.join("\n");
    text.style.whiteSpace = "pre-line";
  },

  // โหลดการตั้งค่ากลางจากเซิร์ฟเวอร์ (fillForm = เติมลงฟอร์ม)
  loadServerSettings: async function(fillForm) {
    if (!ApiService.hasGasUrl()) {
      this.renderAutoStatus(null, "ยังไม่ได้ตั้งค่า URL เว็บแอป");
      return null;
    }
    try {
      const st = await ApiService.getSettings();
      this.serverSettings = st;
      if (fillForm) {
        const tokenInput = document.getElementById("settingLineToken");
        if (tokenInput) {
          tokenInput.value = "";
          tokenInput.placeholder = st.hasLineToken
            ? "บันทึกแล้ว " + st.lineTokenPreview + " (เว้นว่างไว้ = ใช้ค่าเดิม)"
            : "Channel access token (ยาว 170+ ตัวอักษร)";
        }
        const groupInput = document.getElementById("settingLineGroupId");
        if (groupInput) groupInput.value = st.lineDestinationId || "";
        const sheetInput = document.getElementById("settingSheetName");
        if (sheetInput && !sheetInput.value && st.sheetName) sheetInput.value = st.sheetName;
      }
      this.renderAutoStatus(st);
      return st;
    } catch (err) {
      this.serverSettings = null;
      const tokenInput = document.getElementById("settingLineToken");
      if (tokenInput) tokenInput.placeholder = "Channel access token (ยาว 170+ ตัวอักษร)";
      this.renderAutoStatus(null, err.message);
      return null;
    }
  },

  // ย้ายค่า LINE ที่เคยเก็บไว้ในเครื่องนี้ขึ้นเซิร์ฟเวอร์ครั้งเดียว (ถ้าเซิร์ฟเวอร์ยังไม่มี)
  migrateLegacyLineSettings: async function() {
    const legacy = CONFIG.getLegacyLineConfig();
    if (!legacy.token && !legacy.groupId) return;
    if (!ApiService.hasGasUrl()) return;
    try {
      const st = await ApiService.getSettings();
      const payload = {};
      if (legacy.token && !st.hasLineToken) payload.lineChannelAccessToken = legacy.token;
      if (legacy.groupId && !st.lineDestinationId) payload.lineDestinationId = legacy.groupId;
      if (Object.keys(payload).length) {
        await ApiService.saveSettingsToGas(payload);
        console.info("[Settings] ย้ายค่า LINE จากเครื่องนี้ขึ้นเซิร์ฟเวอร์แล้ว");
      }
      // ค่าบนเซิร์ฟเวอร์ครบแล้ว ลบสำเนาในเครื่องทิ้ง
      CONFIG.clearLegacyLineConfig();
    } catch (err) {
      console.warn("[Settings] ย้ายค่า LINE ขึ้นเซิร์ฟเวอร์ไม่สำเร็จ (จะลองใหม่ครั้งหน้า):", err.message);
    }
  },

  saveSettings: async function(e) {
    if (e) e.preventDefault();

    const gasUrl = document.getElementById("settingGasUrl").value.trim();
    const sheetName = document.getElementById("settingSheetName") ? document.getElementById("settingSheetName").value.trim() : "";
    const lineToken = document.getElementById("settingLineToken").value.trim();
    const lineGroupId = document.getElementById("settingLineGroupId").value.trim();
    const opName = document.getElementById("settingDefaultOperator").value.trim();

    CONFIG.setGasUrl(gasUrl);
    CONFIG.setSheetName(sheetName);
    if (opName) CONFIG.setCurrentOperator(opName);
    this.initOperatorDisplay();

    if (!gasUrl) {
      this.closeSettingsModal();
      Swal.fire({ icon: "info", title: "บันทึกการตั้งค่าในเครื่องแล้ว", text: "ยังไม่ได้ระบุ URL เว็บแอป จึงยังไม่ได้บันทึกค่า LINE", confirmButtonColor: COLOR.primary });
      return;
    }

    Swal.fire({ title: "กำลังบันทึกลงเซิร์ฟเวอร์...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await ApiService.saveSettingsToGas({
        sheetName: sheetName,
        lineChannelAccessToken: lineToken,
        lineDestinationId: lineGroupId
      });
      CONFIG.clearLegacyLineConfig();
      this.serverSettings = res.settings || null;
      this.closeSettingsModal();
      this.syncWithGoogleSheets();

      const warn = res.triggerError;
      Swal.fire({
        icon: warn ? "warning" : "success",
        title: warn ? "บันทึกแล้ว แต่ตั้งเวลาส่งอัตโนมัติไม่สำเร็จ" : "บันทึกการตั้งค่าเรียบร้อย",
        text: warn
          ? warn + " — ใน Apps Script ให้รันฟังก์ชัน setDailyTriggerAt0800 หนึ่งครั้งเพื่ออนุญาตสิทธิ์"
          : (res.message || "ทุกเครื่องใช้ค่าชุดเดียวกัน และระบบจะส่งแจ้งเตือนอัตโนมัติทุกวัน"),
        confirmButtonColor: COLOR.primary
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        html: `<div class="help"><p class="help-error">${esc(err.message)}</p><p>ค่ายังไม่ได้ถูกบันทึกบนเซิร์ฟเวอร์ ตรวจสอบแล้วลองบันทึกอีกครั้ง หากเพิ่งแก้ไฟล์ Code.gs ต้อง Deploy &gt; New version ด้วย</p></div>`,
        confirmButtonColor: COLOR.danger
      });
    }
  },

  // ตั้ง/ตรวจสอบ Trigger ส่งอัตโนมัติ
  setupTriggerFromSettings: async function() {
    try {
      const res = await ApiService.setupDailyTrigger();
      Swal.fire({ icon: "success", title: "ตั้งเวลาส่งอัตโนมัติแล้ว", text: res.message, confirmButtonColor: COLOR.success });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ตั้งเวลาไม่สำเร็จ",
        text: err.message + " — ใน Apps Script ให้รันฟังก์ชัน setDailyTriggerAt0800 หนึ่งครั้งเพื่ออนุญาตสิทธิ์ แล้ว Deploy เวอร์ชันใหม่",
        confirmButtonColor: COLOR.danger
      });
    }
    this.loadServerSettings(false);
  },

  // ทดสอบการเชื่อมต่อกับ Google Apps Script Web App
  testGasConnectionFromSettings: async function() {
    const url = document.getElementById("settingGasUrl").value.trim();
    if (!url) {
      Swal.fire({
        icon: "warning",
        title: "ยังไม่ได้ระบุ Web App URL",
        text: "กรุณาวาง URL เว็บแอปจาก Google Apps Script ก่อนทดสอบ",
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    if (!url.startsWith("https://script.google.com/macros/s/")) {
      Swal.fire({
        icon: "warning",
        title: "รูปแบบ URL ไม่ถูกต้อง",
        text: "URL ของ Google Apps Script จะต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec",
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    Swal.fire({
      title: "กำลังทดสอบเชื่อมต่อ Google Sheets...",
      text: "กำลังดึงข้อมูลทดสอบจากชีต",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      CONFIG.setGasUrl(url);
      const sheetInput = document.getElementById("settingSheetName");
      const sheetName = sheetInput ? sheetInput.value.trim() : "";
      if (sheetName) {
        CONFIG.setSheetName(sheetName);
        try {
          await ApiService.saveSettingsToGas({ sheetName: sheetName });
        } catch (e) { console.warn("save sheetName failed:", e.message); }
      }
      const res = await ApiService.request("getAll");
      if (res && res.success && !res.fromCache) {
        const count = res.data ? res.data.length : 0;
        if (count > 0) {
          Swal.fire({
            icon: "success",
            title: "เชื่อมต่อ Google Sheets สำเร็จ",
            text: `ดึงข้อมูลได้สำเร็จ จำนวน ${count} รายการ ระบบพร้อมบันทึกข้อมูลลงชีตแล้ว`,
            confirmButtonColor: COLOR.success
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "เชื่อมต่อสำเร็จ แต่พบข้อมูล 0 รายการ",
            html: `
              <div class="help">
                <p>เชื่อมต่อ Web App ได้เรียบร้อย แต่แผ่นงานที่ดึงมายังไม่มีข้อมูลนัดหมาย</p>
                <div class="help-box help-box--warn">
                  <div class="help-box-title">คำแนะนำ</div>
                  <ul>
                    <li>หากเพิ่งเพิ่มแผ่นงานใหม่ (เช่น "Home") ระบบอาจไปอ่านแท็บนั้น</li>
                    <li>ระบุชื่อแผ่นงานที่มีข้อมูลจริง (เช่น <strong>Sheet1</strong> หรือ <strong>รายการนัด</strong>) ในช่อง "ชื่อแผ่นงานในชีต" แล้วกดทดสอบอีกครั้ง</li>
                    <li>หรือใน Google Sheets ให้ลากแท็บแผ่นงานที่มีข้อมูลมาไว้เป็นแท็บแรกสุด (ซ้ายสุด)</li>
                  </ul>
                </div>
              </div>
            `,
            confirmButtonColor: COLOR.primary
          });
        }
      } else {
        throw new Error(res ? res.errorMessage || res.message : "ไม่สามารถเชื่อมต่อได้");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "เชื่อมต่อ Google Sheets ไม่สำเร็จ",
        html: `
          <div class="help">
            <p class="help-error">${esc(err.message)}</p>
            <div class="help-box">
              <div class="help-box-title">สาเหตุที่พบบ่อย</div>
              <ul>
                <li>สิทธิ์เข้าถึงไม่ได้ตั้งเป็น <strong>ทุกคน (Anyone)</strong>: ใน Apps Script ให้เลือก Deploy &gt; New deployment &gt; Who has access เป็น <strong>Anyone</strong></li>
                <li>URL ไม่ลงท้ายด้วย <code>/exec</code> (ต้องเป็น URL จากการ Deploy เป็น Web app เท่านั้น)</li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonColor: COLOR.danger
      });
    }
  },

  // ทดสอบ LINE Token จากหน้าต่างตั้งค่า
  testLineTokenFromSettings: async function() {
    const token = document.getElementById("settingLineToken").value.trim();
    const hasStored = !!(this.serverSettings && this.serverSettings.hasLineToken);
    if (!token && !hasStored) {
      Swal.fire({
        icon: "warning",
        title: "ยังไม่ได้ระบุ Token",
        text: "กรุณาวาง Channel access token ก่อนกดทดสอบ",
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    if (token && token.length <= 40) {
      Swal.fire({
        icon: "error",
        title: "Token สั้นเกินไป",
        html: `
          <div class="help">
            <p class="help-error">Token ที่ระบุมีความยาวเพียง ${token.length} ตัวอักษร ซึ่งน่าจะเป็น "Channel Secret" ไม่ใช่ "Channel access token"</p>
            <div class="help-box">
              <div class="help-box-title">วิธีแก้ไข</div>
              <ol>
                <li>ไปที่ <a href="https://developers.line.biz/" target="_blank" rel="noopener">LINE Developers Console</a></li>
                <li>เลือก Channel ของคุณ</li>
                <li>คลิกแท็บ <strong>Messaging API</strong> (ไม่ใช่ Basic settings)</li>
                <li>เลื่อนลงล่างสุดตรงหัวข้อ <strong>Channel access token</strong></li>
                <li>กดปุ่ม <strong>Issue</strong> เพื่อคัดลอก Token ยาว 170+ ตัวอักษร</li>
              </ol>
            </div>
          </div>
        `,
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    Swal.fire({
      title: "กำลังทดสอบ Token...",
      text: "เชื่อมต่อกับเซิร์ฟเวอร์ LINE เพื่อตรวจสอบสถานะ",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await ApiService.testLineToken(token);
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "Token ถูกต้องและใช้งานได้",
          text: res.message,
          confirmButtonColor: COLOR.success
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "ทดสอบไม่สำเร็จ",
          text: res.message || "LINE ปฏิเสธการเชื่อมต่อ กรุณาตรวจสอบว่าคัดลอก Token มาครบถ้วนหรือไม่",
          confirmButtonColor: COLOR.danger
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message,
        confirmButtonColor: COLOR.danger
      });
    }
  },

  // ทดสอบส่งข้อความจริงเข้ากลุ่ม LINE
  sendTestMessageFromSettings: async function() {
    const token = document.getElementById("settingLineToken").value.trim();
    const groupId = document.getElementById("settingLineGroupId").value.trim();
    const st = this.serverSettings || {};
    const hasToken = !!(token || st.hasLineToken);
    const hasDest = !!(groupId || st.lineDestinationId);

    if (!hasToken || !hasDest) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาระบุข้อมูลให้ครบ",
        text: "ต้องระบุทั้ง Channel Access Token และ Destination ID ก่อนทดสอบส่ง",
        confirmButtonColor: COLOR.primary
      });
      return;
    }

    Swal.fire({
      title: "กำลังส่งข้อความทดสอบ...",
      text: "กำลังส่งข้อความเข้ากลุ่ม LINE ปลายทาง",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await ApiService.sendTestLineMessage(token, groupId);
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "ส่งข้อความทดสอบสำเร็จ",
          text: "ข้อความทดสอบถูกส่งเข้ากลุ่ม LINE เรียบร้อยแล้ว กรุณาเปิดดูในแอป LINE",
          confirmButtonColor: COLOR.success
        });
      } else {
        throw new Error(res.message || "ส่งไม่สำเร็จ");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ส่งข้อความทดสอบไม่สำเร็จ",
        html: `
          <div class="help">
            <p class="help-error">${esc(err.message)}</p>
            <div class="help-box">
              <div class="help-box-title">คำแนะนำในการตรวจสอบ</div>
              <ul>
                <li>บอท (LINE Official Account) ได้ถูก<strong>เชิญเข้ากลุ่ม LINE</strong> นั้นแล้วหรือยัง? (ถ้าบอทไม่ได้อยู่ในกลุ่ม จะส่งเข้ากลุ่มไม่ได้)</li>
                <li>Destination ID ต้องเป็นรหัสที่ขึ้นต้นด้วย <code>C...</code> (สำหรับกลุ่ม) หรือ <code>U...</code> (สำหรับบุคคล) เท่านั้น <em>(ไม่ใช่ชื่อกลุ่ม)</em></li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonColor: COLOR.danger
      });
    }
  }
};

window.App = App;

// เริ่มต้นแอปพลิเคชันเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
