const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/**
 * app.js - Main Application Controller for TeleQueue
 */

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
    
    // ตั้งค่าตัวเลือกผู้ใช้งาน
    this.initOperatorDisplay();

    // เริ่มต้น DataStore
    DataStore.init();

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
      confirmButtonColor: "#0284c7",
      cancelButtonColor: "#64748b",
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

    // วันที่ในหน้าคิวนัดวันนี้
    const queueDateInput = document.getElementById("queueDateInput");
    if (queueDateInput) {
      queueDateInput.value = this.currentQueueDate;
      queueDateInput.addEventListener("change", (e) => {
        self.currentQueueDate = e.target.value;
        self.renderTodayQueue();
      });
    }
  },

  // สลับแท็บ
  switchTab: function(tabName) {
    this.activeTab = tabName;

    // Navigation (bottom bar / rail / drawer) active state
    document.querySelectorAll("#mainNav [data-tab]").forEach(btn => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tabName);
    });

    // อัปเดตชื่อหัวข้อแถบบนสุด
    const topTitle = document.getElementById("topNavSectionTitle");
    if (topTitle) {
      const sectionTitles = {
        dashboard: "ภาพรวมระบบ (Dashboard)",
        today: "รายการนัดประจำวัน",
        calendar: "ปฏิทินนัดหมาย",
        manage: "จัดการนัดหมายทั้งหมด"
      };
      topTitle.textContent = sectionTitles[tabName] || tabName;
    }

    // แสดง/ซ่อน Section
    const tabs = ["dashboard", "calendar", "today", "manage"];
    tabs.forEach(t => {
      const section = document.getElementById(`tab-${t}`);
      if (section) {
        if (t === tabName) {
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      }
    });

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

  // ซิงค์ข้อมูลกับ Google Sheets
  syncWithGoogleSheets: async function() {
    const el = document.getElementById("syncStatusIndicator");
    const set = (c, t) => { if (el) el.innerHTML = `<span class="dot dot-${c}"></span><span class="sync-t">${t}</span>`; };
    set("wait", "กำลังซิงค์ข้อมูล...");
    try {
      const list = await ApiService.getAllAppointments();
      const on = ApiService.hasGasUrl();
      set(on ? "ok" : "info", on ? "เชื่อมต่อ Google Sheets แล้ว" : `ฐานข้อมูลท้องถิ่น (${list.length} รายการ)`);
      this.renderAllViews();
    } catch (e) {
      console.error("Sync error:", e);
      set("err", "ซิงค์ขัดข้อง (ใช้ข้อมูลแคช)");
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
    const pBar = document.getElementById("heroProgressBar");
    if (pBar) pBar.style.width = (stats.todayCount ? Math.round(stats.completedToday / stats.todayCount * 100) : 0) + "%";
    const pTxt = document.getElementById("heroProgressText");
    if (pTxt) pTxt.textContent = `${stats.completedToday} จาก ${stats.todayCount} ราย`;

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

  // ป้ายสถานะ + ขั้นตอน (ใช้ร่วมกันทุกหน้า)
  _badge: function(a) {
    const k = a.tele && a.hosxp ? ["done", "check", "ครบถ้วน"] : (a.tele || a.hosxp) ? ["part", "clock", "บางส่วน"] : ["wait", "alertTriangle", "รอเริ่ม"];
    return `<span class="chip chip-${k[0]}">${Icons[k[1]]("w-3.5 h-3.5")}${k[2]}</span>`;
  },
  _steps: function(a) {
    const t = (f, on, icon, title, doneTxt, op) => `<label class="step"><input type="checkbox" ${on ? "checked" : ""} onchange="App.handleCheckboxChange('${a.id}','${f}',this.checked)"><span class="step-ic">${Icons[icon]("w-5 h-5")}</span><span class="step-tx"><b>${title}</b><small>${on ? doneTxt + (op ? " · " + esc(op) : "") : "ยังไม่ดำเนินการ"}</small></span></label>`;
    return `<div class="steps">${t("tele", a.tele, "phone", "โทรนัด", "โทรแล้ว", a.teleOperator)}${t("hosxp", a.hosxp, "fileText", "บันทึก HosXP", "บันทึกแล้ว", a.hosOperator)}</div>`;
  },

  // แจ้งเตือนรายการที่ยังดำเนินการไม่ครบ
  renderIncompleteAlerts: function(list) {
    const c = document.getElementById("incompleteAlertsContainer");
    if (!c) return;
    if (!list || list.length === 0) {
      c.innerHTML = `<div class="banner banner-ok">${Icons.checkCircle("w-6 h-6")}<div><b>ดำเนินการครบทุกรายการแล้ว</b><p>โทรนัดและบันทึก HosXP ครบสำหรับวันนี้</p></div></div>`;
      return;
    }
    c.innerHTML = `<section class="card"><div class="card-h"><h3>ค้างดำเนินการวันนี้<span class="count">${list.length}</span></h3><button class="btn-text btn-sm" onclick="App.switchTab('today')">ดูคิววันนี้</button></div><div class="li-list" style="max-height:320px;overflow:auto">${list.map(a => `
      <div class="li"><span class="avatar">${esc((a.department || "?").slice(0, 2))}</span>
        <div class="li-b"><b>${esc(a.name)}</b><small>HN ${esc(a.hn || "-")} · ${esc(a.doctor || "-")}${a.phone ? " · " + esc(a.phone) : ""}</small></div>
        <div class="li-act">
          <button class="btn-tonal btn-sm ${a.tele ? "is-on" : ""}" onclick="App.quickToggleTele('${a.id}', ${!a.tele})">${a.tele ? "โทรแล้ว" : "ยืนยันโทร"}</button>
          <button class="btn-tonal btn-sm ${a.hosxp ? "is-on" : ""}" onclick="App.quickToggleHos('${a.id}', ${!a.hosxp})">${a.hosxp ? "ลง Hos แล้ว" : "ยืนยันลง Hos"}</button>
        </div></div>`).join("")}</div></section>`;
  },

  // สรุปสถิติตามแผนก
  renderDepartmentStats: function(s) {
    const c = document.getElementById("deptStatsContainer");
    if (!c) return;
    const k = Object.keys(s);
    if (!k.length) { c.innerHTML = `<p class="muted">ไม่มีข้อมูล</p>`; return; }
    const m = Math.max(...k.map(x => s[x]), 1);
    c.innerHTML = k.map(x => `<div class="meter"><span>${esc(x)}</span><div class="track"><i style="width:${Math.round(s[x] / m * 100)}%"></i></div><b>${s[x]}</b></div>`).join("");
  },

  // ==========================================
  // 2. Today's Queue View
  // ==========================================
  renderTodayQueue: function() {
    const d = this.currentQueueDate || getTodayIso();
    const list = DataStore.getByDate(d);
    const th = formatThaiDateDisplay(d);
    const t = document.getElementById("queueDateHeaderTitle");
    if (t) t.textContent = `คิวนัดวันที่ ${th} (${list.length} ราย)`;
    const c = document.getElementById("todayQueueList");
    if (!c) return;
    if (!list.length) {
      c.innerHTML = `<div class="empty">${Icons.calendar("w-12 h-12")}<b>ไม่มีนัดหมายวันที่ ${th}</b><p>กดปุ่มเพิ่มนัดหมายเพื่อสร้างรายการ</p></div>`;
      return;
    }
    c.innerHTML = list.map(a => {
      const tel = a.phone ? String(a.phone).replace(/[^0-9]/g, "") : "";
      return `<article class="card q ${a.tele && a.hosxp ? "q-done" : ""}">
        <div class="q-h"><div><h3>${esc(a.name)}</h3><small>HN ${esc(a.hn || "-")} · ปชช. ${esc(a.cid || "-")}</small></div><span class="chip chip-dept">${esc(a.department || "-")}</span></div>
        <div class="q-m"><span>${Icons.stethoscope("w-4 h-4")} พ. ${esc(a.doctor || "-")}</span>${a.lineName ? `<span class="q-l">${Icons.message("w-4 h-4")} ${esc(a.lineName)}</span>` : ""}</div>
        ${a.notes ? `<p class="q-n">${esc(a.notes)}</p>` : ""}
        ${this._steps(a)}
        <div class="q-f">${tel ? `<a class="btn-tonal btn-sm" href="tel:${tel}">${Icons.phone("w-4 h-4")} ${esc(a.phone)}</a>` : `<span class="muted">ไม่มีเบอร์โทร</span>`}<span class="grow"></span>
          <button class="icon-btn" title="ดูข้อมูล" onclick="App.openPatientDetailModalById('${a.id}')">${Icons.eye("w-5 h-5")}</button>
          <button class="icon-btn" title="แก้ไข" onclick="App.openEditAppointmentModal('${a.id}')">${Icons.edit("w-5 h-5")}</button></div>
      </article>`;
    }).join("");
  },

  // เลื่อนวันในหน้าคิว +1 / -1
  navigateQueueDate: function(delta) {
    const current = this.currentQueueDate || getTodayIso();
    const d = new Date(current);
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().substring(0, 10);
    this.currentQueueDate = iso;
    const queueInput = document.getElementById("queueDateInput");
    if (queueInput) queueInput.value = iso;
    this.renderTodayQueue();
  },

  // เปลี่ยนวันในหน้าคิว
  viewQueueForDate: function(isoDate) {
    this.currentQueueDate = isoDate;
    const queueInput = document.getElementById("queueDateInput");
    if (queueInput) queueInput.value = isoDate;
    this.switchTab("today");
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

    const countEl = document.getElementById("manageTableCount");
    if (countEl) countEl.textContent = `พบ ${filtered.length} รายการ (จากทั้งหมด ${appointments.length} รายการ)`;

    const c = document.getElementById("manageList");
    if (!c) return;
    if (!filtered.length) {
      c.innerHTML = `<div class="empty">${Icons.search("w-12 h-12")}<b>ไม่พบนัดหมายที่ตรงกับเงื่อนไข</b><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p></div>`;
      return;
    }
    c.innerHTML = filtered.map(a => `
      <div class="li"><span class="avatar">${esc((a.department || "?").slice(0, 2))}</span>
        <div class="li-b"><b>${esc(a.name)}</b><small>${esc(a.thaiDate)} · HN ${esc(a.hn || "-")} · ${esc(a.department || "-")} · พ. ${esc(a.doctor || "-")}</small>${a.notes ? `<small class="li-n">${esc(a.notes)}</small>` : ""}</div>
        ${this._badge(a)}
        <div class="li-act">
          <button class="icon-btn" title="ดูรายละเอียด" onclick="App.openPatientDetailModalById('${a.id}')">${Icons.eye("w-5 h-5")}</button>
          <button class="icon-btn" title="แก้ไข" onclick="App.openEditAppointmentModal('${a.id}')">${Icons.edit("w-5 h-5")}</button>
          <button class="icon-btn" title="ลบ" style="color:var(--err)" onclick="App.confirmDeleteAppointment('${a.id}')">${Icons.trash("w-5 h-5")}</button>
        </div></div>`).join("");
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

    const modal = document.getElementById("appointmentModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
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
    document.getElementById("formDept").value = apt.department || "MED";
    document.getElementById("formDoctor").value = apt.doctor || "";
    document.getElementById("formPhone").value = apt.phone || "";
    document.getElementById("formLineName").value = apt.lineName || "";
    document.getElementById("formNotes").value = apt.notes || "";
    document.getElementById("formTele").checked = apt.tele === true;
    document.getElementById("formHosxp").checked = apt.hosxp === true;

    const modal = document.getElementById("appointmentModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closeAppointmentModal: function() {
    const modal = document.getElementById("appointmentModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
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
        confirmButtonColor: "#0284c7"
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
      hosxp
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
          title: "บันทึกในเครื่องแล้ว (แต่ยังไม่ลง Google Sheets)",
          html: `
            <div class="text-left text-xs space-y-2">
              <p class="text-amber-800 font-bold">ข้อมูลแสดงบนหน้าเว็บแล้ว แต่ยังไม่สามารถส่งเข้า Google Sheets ได้</p>
              <p class="text-slate-600"><strong>สาเหตุ:</strong> ${res.errorMessage ? res.errorMessage : "ยังไม่ได้ระบุ Web App URL หรือ URL ยังเชื่อมต่อไม่ได้"}</p>
              <div class="bg-amber-50 p-3 rounded-xl border border-amber-200 mt-2">
                <p class="font-bold text-amber-900">วิธีเปิดการเชื่อมต่อกับ Google Sheets:</p>
                <ol class="list-decimal pl-4 space-y-1 text-slate-700 mt-1">
                  <li>เปิด Google Apps Script ในชีตของคุณ</li>
                  <li>กด <strong>การทำให้ใช้งานได้ (Deploy)</strong> > <strong>การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong></li>
                  <li>เลือก <strong>เว็บแอป (Web app)</strong> และตั้งสิทธิ์เข้าถึง (Who has access) เป็น <strong>ทุกคน (Anyone)</strong></li>
                  <li>คัดลอก Web App URL มาใส่ในเมนู <strong>ตั้งค่า</strong> มุมบนขวาของหน้าเว็บนี้ แล้วกดบันทึก</li>
                </ol>
              </div>
            </div>
          `,
          confirmButtonColor: "#0284c7"
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "บันทึกลง Google Sheets สำเร็จ!",
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
        confirmButtonColor: "#ef4444"
      });
    }
  },

  // ยืนยันการลบนัดหมาย
  confirmDeleteAppointment: async function(aptId) {
    const apt = DataStore.getById(aptId);
    if (!apt) return;

    const res = await Swal.fire({
      title: "ยืนยันการยกเลิก/ลบนัดหมาย?",
      text: `ต้องการลบนัดหมายของ ${apt.name} (HN: ${apt.hn || '-'}) ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
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

    const statusTele = apt.tele ? 
      `<span class="text-emerald-700 font-bold">โทรนัดแล้ว (${apt.teleOperator || 'เจ้าหน้าที่'} - ${apt.teleTime || ''})</span>` :
      `<span class="text-rose-600 font-bold">ยังไม่ได้โทร</span>`;

    const statusHos = apt.hosxp ? 
      `<span class="text-indigo-700 font-bold">ลงบันทึก HosXP แล้ว (${apt.hosOperator || 'เจ้าหน้าที่'} - ${apt.hosTime || ''})</span>` :
      `<span class="text-rose-600 font-bold">ยังไม่ได้ลง HosXP</span>`;

    const tel = apt.phone ? String(apt.phone).replace(/[^0-9]/g, "") : "";
    container.innerHTML = `
      <div class="detail">
        <div class="detail-h"><div><h4>${esc(apt.name)}</h4><small>HN ${esc(apt.hn || "-")} · ปชช. ${esc(apt.cid || "-")}</small><p>วันนัด ${esc(apt.thaiDate)} (${esc(apt.date)})</p></div><span class="chip" style="background:#fff">${esc(apt.department || "-")}</span></div>
        <dl class="kv">
          <div><dt>แพทย์ผู้นัด</dt><dd>${esc(apt.doctor || "-")}</dd></div>
          <div><dt>เบอร์โทรศัพท์</dt><dd>${tel ? `<a href="tel:${tel}" style="color:var(--primary)">${esc(apt.phone)}</a>` : "-"}</dd></div>
          ${apt.lineName ? `<div style="grid-column:1/-1"><dt>ชื่อ LINE</dt><dd>${esc(apt.lineName)}</dd></div>` : ""}
          <div style="grid-column:1/-1"><dt>หมายเหตุ / เหตุผลการนัด</dt><dd style="font-weight:400">${esc(apt.notes || "ติดตามอาการ")}</dd></div>
        </dl>
        ${this._steps(apt)}
        <div class="dlg-act">
          <button class="btn-tonal" onclick="App.closePatientDetailModal(); App.openEditAppointmentModal('${apt.id}')">แก้ไขข้อมูล</button>
          <button class="btn" onclick="App.closePatientDetailModal()">ปิด</button>
        </div>
      </div>
    `;

    const modal = document.getElementById("patientDetailModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closePatientDetailModal: function() {
    const modal = document.getElementById("patientDetailModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  // ==========================================
  // Settings Modal
  // ==========================================
  openSettingsModal: function() {
    const gasInput = document.getElementById("settingGasUrl");
    if (gasInput) gasInput.value = CONFIG.getGasUrl();

    const lineCfg = CONFIG.getLineConfig();
    const tokenInput = document.getElementById("settingLineToken");
    if (tokenInput) tokenInput.value = lineCfg.token;

    const groupInput = document.getElementById("settingLineGroupId");
    if (groupInput) groupInput.value = lineCfg.groupId;

    const operatorInput = document.getElementById("settingDefaultOperator");
    if (operatorInput) operatorInput.value = CONFIG.getCurrentOperator();

    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closeSettingsModal: function() {
    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  saveSettings: async function(e) {
    if (e) e.preventDefault();

    const gasUrl = document.getElementById("settingGasUrl").value.trim();
    const lineToken = document.getElementById("settingLineToken").value.trim();
    const lineGroupId = document.getElementById("settingLineGroupId").value.trim();
    const opName = document.getElementById("settingDefaultOperator").value.trim();

    CONFIG.setGasUrl(gasUrl);
    CONFIG.setLineConfig(lineToken, lineGroupId);
    if (opName) CONFIG.setCurrentOperator(opName);
    this.initOperatorDisplay();

    // ถ้ามี GAS URL ให้ส่งการตั้งค่าไปบันทึกใน Script Properties
    if (gasUrl) {
      try {
        await ApiService.saveSettingsToGas({
          lineChannelAccessToken: lineToken,
          lineDestinationId: lineGroupId
        });
      } catch (err) {
        console.warn("Could not save settings to GAS backend directly:", err);
      }
    }

    this.closeSettingsModal();
    this.syncWithGoogleSheets();

    Swal.fire({
      icon: "success",
      title: "บันทึกการตั้งค่าเรียบร้อย",
      timer: 1500,
      showConfirmButton: false
    });
  },

  // ทดสอบการเชื่อมต่อกับ Google Apps Script Web App
  testGasConnectionFromSettings: async function() {
    const url = document.getElementById("settingGasUrl").value.trim();
    if (!url) {
      Swal.fire({
        icon: "warning",
        title: "ยังไม่ได้ระบุ Web App URL",
        text: "กรุณาวาง URL เว็บแอปจาก Google Apps Script ก่อนทดสอบ",
        confirmButtonColor: "#0284c7"
      });
      return;
    }

    if (!url.startsWith("https://script.google.com/macros/s/")) {
      Swal.fire({
        icon: "warning",
        title: "รูปแบบ URL ไม่ถูกต้อง",
        text: "URL ของ Google Apps Script จะต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec",
        confirmButtonColor: "#0284c7"
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
      const res = await ApiService.request("getAll");
      if (res && res.success && !res.fromCache) {
        Swal.fire({
          icon: "success",
          title: "เชื่อมต่อ Google Sheets สำเร็จ!",
          text: `ดึงข้อมูลได้สำเร็จ จำนวน ${res.data ? res.data.length : 0} รายการ ระบบพร้อมบันทึกข้อมูลลงชีตแล้วครับ`,
          confirmButtonColor: "#10b981"
        });
      } else {
        throw new Error(res ? res.errorMessage || res.message : "ไม่สามารถเชื่อมต่อได้");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "เชื่อมต่อ Google Sheets ไม่สำเร็จ",
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-rose-600 font-bold">${err.message}</p>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
              <p class="font-bold mb-1">สาเหตุที่พบบ่อย:</p>
              <ul class="list-disc pl-4 space-y-1">
                <li>สิทธิ์เข้าถึงไม่ได้ตั้งเป็น <strong>ทุกคน (Anyone)</strong>: ใน Apps Script ให้เลือก Deploy > New deployment > Who has access เป็น <strong>Anyone</strong></li>
                <li>URL ไม่ลงท้ายด้วย <code>/exec</code> (ต้องเป็น URL จากการ Deploy เป็น Web app เท่านั้น)</li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonColor: "#ef4444"
      });
    }
  },

  // ทดสอบ LINE Token จากหน้าต่างตั้งค่า
  testLineTokenFromSettings: async function() {
    let token = document.getElementById("settingLineToken").value.trim();
    if (!token) {
      token = CONFIG.getLineConfig().token;
    }
    if (!token) {
      Swal.fire({
        icon: "warning",
        title: "ยังไม่ได้ระบุ Token",
        text: "กรุณาวาง Channel access token ก่อนกดทดสอบ",
        confirmButtonColor: "#0284c7"
      });
      return;
    }

    if (token.length <= 40) {
      Swal.fire({
        icon: "error",
        title: "Token สั้นเกินไป!",
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-rose-600 font-bold">Token ที่ระบุมีความยาวเพียง ${token.length} ตัวอักษร ซึ่งน่าจะเป็น "Channel Secret" ไม่ใช่ "Channel access token"</p>
            <p><strong>วิธีแก้ไข:</strong></p>
            <ol class="list-decimal pl-4 space-y-1">
              <li>ไปที่ <a href="https://developers.line.biz/" target="_blank" class="text-teal-600 underline">LINE Developers Console</a></li>
              <li>เลือก Channel ของคุณ</li>
              <li>คลิกแท็บ <strong>Messaging API</strong> (ไม่ใช่ Basic settings)</li>
              <li>เลื่อนลงล่างสุดตรงหัวข้อ <strong>Channel access token</strong></li>
              <li>กดปุ่ม <strong>Issue</strong> เพื่อคัดลอก Token ยาว 170+ ตัวอักษร</li>
            </ol>
          </div>
        `,
        confirmButtonColor: "#0284c7"
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
          title: "Token ถูกต้องและใช้งานได้!",
          text: res.message,
          confirmButtonColor: "#10b981"
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "ทดสอบไม่สำเร็จ",
          text: res.message || "LINE ปฏิเสธการเชื่อมต่อ กรุณาตรวจสอบว่าคัดลอก Token มาครบถ้วนหรือไม่",
          confirmButtonColor: "#ef4444"
        });
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

  // ทดสอบส่งข้อความจริงเข้ากลุ่ม LINE
  sendTestMessageFromSettings: async function() {
    const token = document.getElementById("settingLineToken").value.trim() || CONFIG.getLineConfig().token;
    const groupId = document.getElementById("settingLineGroupId").value.trim() || CONFIG.getLineConfig().groupId;

    if (!token || !groupId) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาระบุข้อมูลให้ครบ",
        text: "ต้องระบุทั้ง Channel Access Token และ Destination ID ก่อนทดสอบส่ง",
        confirmButtonColor: "#0284c7"
      });
      return;
    }

    // บันทึกลง config ก่อนส่ง
    CONFIG.setLineConfig(token, groupId);

    Swal.fire({
      title: "กำลังส่งข้อความทดสอบ...",
      text: "กำลังส่งข้อความเข้ากลุ่ม LINE ปลายทาง",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await ApiService.sendTestLineMessage();
      if (res && res.success) {
        Swal.fire({
          icon: "success",
          title: "ส่งข้อความทดสอบสำเร็จ!",
          text: "ข้อความทดสอบถูกส่งเข้ากลุ่ม LINE เรียบร้อยแล้ว กรุณาเปิดดูในแอป LINE",
          confirmButtonColor: "#10b981"
        });
      } else {
        throw new Error(res.message || "ส่งไม่สำเร็จ");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ส่งข้อความทดสอบไม่สำเร็จ",
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-rose-600 font-bold">${err.message}</p>
            <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <p class="font-bold text-slate-700">คำแนะนำในการตรวจสอบ:</p>
              <ul class="list-disc pl-4 space-y-1 text-slate-600 mt-1">
                <li>บอท (LINE Official Account) ได้ถูก<strong>เชิญเข้ากลุ่ม LINE</strong> นั้นแล้วหรือยัง? (ถ้าบอทไม่ได้อยู่ในกลุ่ม จะส่งเข้ากลุ่มไม่ได้)</li>
                <li>Destination ID ต้องเป็นรหัสที่ขึ้นต้นด้วย <code>C...</code> (สำหรับกลุ่ม) หรือ <code>U...</code> (สำหรับบุคคล) เท่านั้น <em>(ไม่ใช่ชื่อกลุ่ม)</em></li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonColor: "#ef4444"
      });
    }
  }
};

window.App = App;

// เริ่มต้นแอปพลิเคชันเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
