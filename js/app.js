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

    // เปลี่ยนสถานะปุ่มแท็บ
    document.querySelectorAll("[data-tab]").forEach(btn => {
      const active = btn.getAttribute("data-tab") === tabName;
      if (active) {
        btn.classList.add("bg-sky-600", "text-white", "shadow-sm");
        btn.classList.remove("text-slate-600", "hover:bg-slate-100");
      } else {
        btn.classList.remove("bg-sky-600", "text-white", "shadow-sm");
        btn.classList.add("text-slate-600", "hover:bg-slate-100");
      }
    });

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
    const syncStatusEl = document.getElementById("syncStatusIndicator");
    if (syncStatusEl) {
      syncStatusEl.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping mr-1.5"></span> กำลังซิงค์ข้อมูล...`;
    }

    try {
      const list = await ApiService.getAllAppointments();
      if (syncStatusEl) {
        const isConnected = ApiService.hasGasUrl();
        syncStatusEl.innerHTML = isConnected ? 
          `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5"></span> เชื่อมต่อ Google Sheets แล้ว` :
          `<span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-500 mr-1.5"></span> ฐานข้อมูลท้องถิ่น (${list.length} รายการ)`;
      }
      this.renderAllViews();
    } catch (e) {
      console.error("Sync error:", e);
      if (syncStatusEl) {
        syncStatusEl.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5"></span> ซิงค์ขัดข้อง (ใช้ข้อมูลแคช)`;
      }
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
      if (sub) sub.textContent = `(ค้างโทรทั้งหมด ${stats.pendingCallAll} ราย)`;
    }

    // การ์ด 4: โทรแล้วและบันทึก HosXP แล้ว
    const completedEl = document.getElementById("statCompleted");
    if (completedEl) {
      completedEl.textContent = stats.completedToday;
      const sub = document.getElementById("statCompletedSub");
      if (sub) sub.textContent = `(เสร็จสมบูรณ์รวม ${stats.completedAll} ราย)`;
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
        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">✓</div>
            <div>
              <h4 class="font-bold text-sm">การดำเนินการวันนี้ครบถ้วนทุกรายการแล้ว!</h4>
              <p class="text-xs text-emerald-600 mt-0.5">โทรนัดและลงบันทึกในระบบ HosXP ครบ 100%</p>
            </div>
          </div>
          <span class="text-xs font-semibold px-3 py-1 bg-emerald-200 text-emerald-900 rounded-full">ยอดเยี่ยม</span>
        </div>
      `;
      return;
    }

    const items = incompleteList.map(a => {
      const missingTele = !a.tele;
      const missingHos = !a.hosxp;
      
      let badge = "";
      if (missingTele && missingHos) {
        badge = `<span class="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-md font-bold">รอโทร & รอลง Hos</span>`;
      } else if (missingTele) {
        badge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-md font-bold">ยังไม่โทร</span>`;
      } else if (missingHos) {
        badge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-md font-bold">ยังไม่ลง HosXP</span>`;
      }

      return `
        <div class="bg-white p-3.5 rounded-xl border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-rose-300 transition-colors">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs mt-0.5">
              ${a.department || "MED"}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-800 text-sm">${a.name}</span>
                <span class="text-xs text-slate-500 font-mono">HN: ${a.hn || "-"}</span>
                ${badge}
              </div>
              <div class="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>🩺 แพทย์: ${a.doctor || "-"}</span>
                <span>📞 เบอร์: <a href="tel:${a.phone}" class="text-sky-600 font-bold hover:underline">${a.phone || "ไม่มีเบอร์"}</a></span>
                <span>📝 ${a.notes || "ติดตามอาการ"}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="App.quickToggleTele('${a.id}', ${!a.tele})" class="px-3 py-1.5 text-xs font-semibold rounded-lg ${a.tele ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'}">
              ${a.tele ? "✓ โทรแล้ว" : "📞 ยืนยันโทร"}
            </button>
            <button onclick="App.quickToggleHos('${a.id}', ${!a.hosxp})" class="px-3 py-1.5 text-xs font-semibold rounded-lg ${a.hosxp ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}">
              ${a.hosxp ? "✓ ลง Hos แล้ว" : "💻 ยืนยันลง Hos"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 md:p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h4 class="font-bold text-slate-900 text-sm md:text-base">แจ้งเตือน: รายการนัดวันนี้ที่ยังดำเนินการไม่ครบ (${incompleteList.length} ราย)</h4>
          </div>
          <button onclick="App.switchTab('today')" class="text-xs font-bold text-rose-700 hover:underline">
            ดูคิววันนี้ทั้งหมด →
          </button>
        </div>
        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
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
      container.innerHTML = `<p class="text-xs text-slate-400">ไม่มีข้อมูล</p>`;
      return;
    }

    const html = keys.map(k => `
      <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
        <span class="font-bold text-slate-700 text-xs">${k}</span>
        <span class="px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full font-bold text-xs">${deptStats[k]} ราย</span>
      </div>
    `).join("");

    container.innerHTML = html;
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

    const container = document.getElementById("todayQueueTableBody");
    if (!container) return;

    if (todayList.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400">
            <div class="text-4xl mb-2">🗓</div>
            <div class="font-semibold text-slate-600">ไม่มีรายการนัดหมายสำหรับวันที่ ${thaiDate}</div>
            <p class="text-xs text-slate-400 mt-1">สามารถกดปุ่ม "เพิ่มนัดหมายใหม่" เพื่อสร้างรายการ</p>
          </td>
        </tr>
      `;
      return;
    }

    const rows = todayList.map((a, idx) => {
      const isComplete = a.tele && a.hosxp;
      const rowBg = isComplete ? "bg-emerald-50/40" : "";

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${rowBg}">
          <td class="py-3.5 px-4 text-xs font-mono text-slate-400 text-center">${idx + 1}</td>
          <td class="py-3.5 px-4">
            <div class="font-bold text-slate-900 text-sm">${a.name}</div>
            <div class="text-xs text-slate-500 font-mono mt-0.5">HN: <span class="font-bold text-slate-700">${a.hn || "-"}</span> | ปชช: ${a.cid || "-"}</div>
            ${a.lineName ? `<div class="text-[11px] text-emerald-600 font-medium">💬 Line: ${a.lineName}</div>` : ""}
          </td>
          <td class="py-3.5 px-4 text-xs">
            <span class="inline-block px-2.5 py-1 rounded-md font-bold text-xs bg-sky-100 text-sky-800 mb-1">${a.department || "-"}</span>
            <div class="text-slate-600">พ. ${a.doctor || "-"}</div>
          </td>
          <td class="py-3.5 px-4 text-xs">
            ${a.phone ? `
              <div class="flex items-center gap-1.5">
                <a href="tel:${a.phone.replace(/[^0-9]/g, "")}" class="font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">
                  📞 ${a.phone}
                </a>
              </div>
            ` : `<span class="text-slate-400 italic">ไม่มีเบอร์โทร</span>`}
            <div class="text-slate-500 mt-1 text-[11px] line-clamp-2" title="${a.notes || ''}">
              📝 ${a.notes || "-"}
            </div>
          </td>
          <!-- Checkbox TELE -->
          <td class="py-3.5 px-4 text-center">
            <label class="inline-flex flex-col items-center cursor-pointer select-none">
              <input type="checkbox" ${a.tele ? "checked" : ""} onchange="App.handleCheckboxChange('${a.id}', 'tele', this.checked)" class="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer">
              <span class="text-[10px] mt-1 font-semibold ${a.tele ? 'text-emerald-700' : 'text-slate-400'}">
                ${a.tele ? 'โทรแล้ว' : 'ยังไม่โทร'}
              </span>
              ${a.teleOperator ? `<span class="text-[9px] text-slate-400 truncate max-w-[80px]" title="${a.teleOperator} (${a.teleTime || ''})">${a.teleOperator}</span>` : ''}
            </label>
          </td>
          <!-- Checkbox HosXP -->
          <td class="py-3.5 px-4 text-center">
            <label class="inline-flex flex-col items-center cursor-pointer select-none">
              <input type="checkbox" ${a.hosxp ? "checked" : ""} onchange="App.handleCheckboxChange('${a.id}', 'hosxp', this.checked)" class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="text-[10px] mt-1 font-semibold ${a.hosxp ? 'text-indigo-700' : 'text-slate-400'}">
                ${a.hosxp ? 'ลง Hos แล้ว' : 'ยังไม่ลง'}
              </span>
              ${a.hosOperator ? `<span class="text-[9px] text-slate-400 truncate max-w-[80px]" title="${a.hosOperator} (${a.hosTime || ''})">${a.hosOperator}</span>` : ''}
            </label>
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="App.openPatientDetailModalById('${a.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg" title="ดูข้อมูล">
                🔍
              </button>
              <button onclick="App.openEditAppointmentModal('${a.id}')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="แก้ไข">
                ✏️
              </button>
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
      await ApiService.updateStatus(apt.rowIndex, field, isChecked, opName);
      
      const fieldTitle = field === "tele" ? "ยืนยันการโทร" : "ยืนยันบันทึก HosXP";
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `${fieldTitle}: ${apt.name}`,
        text: `ผู้บันทึก: ${opName}`,
        showConfirmButton: false,
        timer: 1800
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

    const tbody = document.getElementById("manageTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 text-center text-slate-400">
            <div class="text-3xl mb-1">🔍</div>
            <div class="font-semibold text-slate-600">ไม่พบนัดหมายที่ตรงกับเงื่อนไข</div>
            <p class="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือล้างตัวกรอง</p>
          </td>
        </tr>
      `;
      return;
    }

    const rows = filtered.map((a, idx) => {
      let statusBadge = "";
      if (a.tele && a.hosxp) {
        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">✓ ครบถ้วน</span>`;
      } else if (a.tele || a.hosxp) {
        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">⏳ บางส่วน</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">✕ รอเริ่ม</span>`;
      }

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors text-xs">
          <td class="py-3 px-3 text-slate-400 font-mono text-center">${idx + 1}</td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="font-bold text-slate-900">${a.thaiDate}</span>
            <div class="text-[10px] text-slate-400 font-mono">${a.date}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-bold text-slate-800">${a.name}</div>
            <div class="text-[11px] text-slate-500 font-mono">HN: ${a.hn || "-"}</div>
          </td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold">${a.department || "-"}</span>
            <div class="text-slate-500 mt-0.5">พ. ${a.doctor || "-"}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-semibold text-slate-800">${a.phone || "-"}</div>
            ${a.lineName ? `<div class="text-slate-400 text-[11px]">Line: ${a.lineName}</div>` : ""}
          </td>
          <td class="py-3 px-3 max-w-xs truncate" title="${a.notes || ''}">
            ${a.notes || "-"}
          </td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="py-3 px-3 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1">
              <button onclick="App.openPatientDetailModalById('${a.id}')" class="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded" title="ดูรายละเอียด">
                ดู
              </button>
              <button onclick="App.openEditAppointmentModal('${a.id}')" class="px-2 py-1 text-sky-600 hover:bg-sky-50 rounded" title="แก้ไข">
                แก้ไข
              </button>
              <button onclick="App.confirmDeleteAppointment('${a.id}')" class="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded" title="ลบ">
                ลบ
              </button>
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
    if (titleEl) titleEl.textContent = "➕ เพิ่มนัดหมาย Telemed ใหม่";

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
    if (titleEl) titleEl.textContent = "✏️ แก้ไขข้อมูลนัดหมาย";

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
      if (id) {
        // แก้ไข
        const existing = DataStore.getById(id);
        payload.id = id;
        payload.rowIndex = existing ? existing.rowIndex : null;
        await ApiService.updateAppointment(payload);
      } else {
        // เพิ่มใหม่
        await ApiService.addAppointment(payload);
      }

      this.closeAppointmentModal();
      this.renderAllViews();

      Swal.fire({
        icon: "success",
        title: "บันทึกข้อมูลสำเร็จ",
        timer: 1500,
        showConfirmButton: false
      });
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
      `<span class="text-emerald-700 font-bold">✓ โทรนัดแล้ว (${apt.teleOperator || 'เจ้าหน้าที่'} - ${apt.teleTime || ''})</span>` :
      `<span class="text-rose-600 font-bold">✕ ยังไม่ได้โทร</span>`;

    const statusHos = apt.hosxp ? 
      `<span class="text-indigo-700 font-bold">✓ ลงบันทึก HosXP แล้ว (${apt.hosOperator || 'เจ้าหน้าที่'} - ${apt.hosTime || ''})</span>` :
      `<span class="text-rose-600 font-bold">✕ ยังไม่ได้ลง HosXP</span>`;

    container.innerHTML = `
      <div class="space-y-4 text-sm font-sans">
        <div class="bg-sky-50 p-4 rounded-2xl border border-sky-100 flex justify-between items-start">
          <div>
            <h3 class="text-lg font-bold text-slate-900">${apt.name}</h3>
            <div class="text-xs text-slate-500 font-mono mt-0.5">HN: <strong class="text-slate-800">${apt.hn || "-"}</strong> | เลข ปชช: ${apt.cid || "-"}</div>
            <div class="mt-2 text-xs text-sky-800 font-medium">
              🗓 วันนัด: <strong>${apt.thaiDate} (${apt.date})</strong>
            </div>
          </div>
          <span class="px-3 py-1 bg-sky-200 text-sky-900 font-bold text-xs rounded-full">${apt.department || "MED"}</span>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="text-slate-400 block mb-0.5">แพทย์ผู้นัด</span>
            <span class="font-bold text-slate-800 text-sm">${apt.doctor || "-"}</span>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="text-slate-400 block mb-0.5">เบอร์โทรศัพท์</span>
            ${apt.phone ? `
              <a href="tel:${apt.phone.replace(/[^0-9]/g, "")}" class="font-bold text-emerald-600 hover:underline text-sm flex items-center gap-1">
                📞 ${apt.phone}
              </a>
            ` : `<span class="text-slate-400">ไม่มีเบอร์โทร</span>`}
          </div>
        </div>

        ${apt.lineName ? `
          <div class="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-xs">
            <span class="text-emerald-700 font-semibold">ชื่อ Line:</span>
            <span class="text-slate-800 ml-1 font-medium">${apt.lineName}</span>
          </div>
        ` : ''}

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
          <span class="text-slate-400 block mb-1">หมายเหตุ / เหตุผลการนัด</span>
          <p class="text-slate-700 leading-relaxed font-medium">${apt.notes || "ติดตามอาการ"}</p>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
          <div class="font-bold text-slate-700">สถานะการปฏิบัติงาน:</div>
          <div>📞 การโทรนัด: ${statusTele}</div>
          <div>💻 การลงบันทึก HosXP: ${statusHos}</div>
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="App.quickToggleTele('${apt.id}', ${!apt.tele}); App.closePatientDetailModal();" class="flex-1 py-2 px-3 text-xs font-bold rounded-xl ${apt.tele ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}">
            ${apt.tele ? 'ยกเลิกสถานะโทร' : '✓ บันทึกว่าโทรแล้ว'}
          </button>
          <button onclick="App.quickToggleHos('${apt.id}', ${!apt.hosxp}); App.closePatientDetailModal();" class="flex-1 py-2 px-3 text-xs font-bold rounded-xl ${apt.hosxp ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}">
            ${apt.hosxp ? 'ยกเลิกสถานะ Hos' : '✓ บันทึกว่าลง HosXP แล้ว'}
          </button>
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
  }
};

window.App = App;

// เริ่มต้นแอปพลิเคชันเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
