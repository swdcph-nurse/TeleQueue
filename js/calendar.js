/**
 * calendar.js - FullCalendar Integration with Month, Week, Day, List Views and Color Coding
 */

let calendarInstance = null;

// สีสถานะตามธีม Material (พื้นอ่อน + ขอบซ้ายเข้ม + ตัวอักษรเข้ม)
const STATUS_COLORS = {
  done:    { bg: "#D5F3DC", border: "#1E8E3E", text: "#00210B" },
  partial: { bg: "#FFE9B5", border: "#D98E04", text: "#261A00" },
  pending: { bg: "#FCE1DE", border: "#D93025", text: "#410002" }
};

const CalendarModule = {
  selectedDepartment: "ALL",
  selectedStatus: "ALL",

  isCompact: function() {
    return window.matchMedia("(max-width: 599.98px)").matches;
  },

  // แถบเครื่องมือ: บนมือถือย้ายปุ่มเปลี่ยนมุมมองไปไว้ด้านล่างเพื่อไม่ให้แน่น
  getToolbars: function() {
    if (this.isCompact()) {
      return {
        header: { left: "prev,next", center: "title", right: "today" },
        footer: { center: "dayGridMonth,listMonth" }
      };
    }
    return {
      header: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
      },
      footer: false
    };
  },

  init: function(containerId) {
    const calendarEl = document.getElementById(containerId);
    if (!calendarEl) return;

    if (calendarInstance) {
      calendarInstance.destroy();
    }

    const self = this;
    const bars = this.getToolbars();

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "th",
      firstDay: 1, // เริ่มวันจันทร์
      height: "auto",
      dayMaxEvents: 3,
      headerToolbar: bars.header,
      footerToolbar: bars.footer,
      windowResize: function() {
        const next = self.getToolbars();
        calendarInstance.setOption("headerToolbar", next.header);
        calendarInstance.setOption("footerToolbar", next.footer);
      },
      buttonText: {
        today: "วันนี้",
        month: "เดือน",
        week: "สัปดาห์",
        day: "วัน",
        list: "รายการนัด"
      },
      views: {
        dayGridMonth: {
          titleFormat: { year: "numeric", month: "long" }
        }
      },
      eventTimeFormat: {
        hour: "2-digit",
        minute: "2-digit",
        meridiem: false
      },
      events: function(info, successCallback, failureCallback) {
        const events = self.getFormattedEvents();
        successCallback(events);
      },
      eventClick: function(info) {
        const aptId = info.event.id;
        const apt = DataStore.getById(aptId);
        if (apt && window.App) {
          window.App.openPatientDetailModal(apt);
        }
      },
      dateClick: function(info) {
        // เมื่อคลิกวันที่ในปฏิทิน ให้สลับไปหน้าคิวของวันนั้น
        if (window.App) {
          window.App.viewQueueForDate(info.dateStr);
        }
      },
      eventDidMount: function(info) {
        // Tooltip แสดงรายละเอียดเมื่อชี้เมาส์
        const p = info.event.extendedProps;
        const statusText = (p.tele && p.hosxp) ? "ดำเนินการครบแล้ว" :
                           (p.tele && !p.hosxp) ? "โทรแล้ว (ยังไม่ลง Hos)" :
                           (!p.tele && p.hosxp) ? "ลง Hos แล้ว (ยังไม่โทร)" :
                           "ยังไม่โทรและยังไม่ลง Hos";

        info.el.setAttribute("title",
          `${p.name || "-"}\nHN: ${p.hn || "-"}\nแผนก: ${p.department || "-"}\nเบอร์: ${p.phone || "-"}\nนัดเพื่อ: ${p.notes || "-"}\nสถานะ: ${statusText}`
        );
      }
    });

    calendarInstance.render();
  },

  // แปลงนัดหมายเป็น Events สำหรับ FullCalendar พร้อมแยกสีตามเงื่อนไข
  getFormattedEvents: function() {
    const appointments = DataStore.getAll();
    const filtered = appointments.filter(a => {
      if (this.selectedDepartment !== "ALL") {
        if ((a.department || "").toUpperCase() !== this.selectedDepartment.toUpperCase()) {
          return false;
        }
      }
      if (this.selectedStatus !== "ALL") {
        if (this.selectedStatus === "COMPLETED" && (!a.tele || !a.hosxp)) return false;
        if (this.selectedStatus === "PARTIAL" && !((a.tele && !a.hosxp) || (!a.tele && a.hosxp))) return false;
        if (this.selectedStatus === "PENDING" && (a.tele || a.hosxp)) return false;
        if (this.selectedStatus === "NO_CALL" && a.tele) return false;
      }
      return true;
    });

    return filtered.map(a => {
      let c = STATUS_COLORS.pending; // แดง (ยังไม่ดำเนินการ)

      if (a.tele && a.hosxp) {
        c = STATUS_COLORS.done; // เขียว (โทรแล้ว + HosXP แล้ว)
      } else if (a.tele || a.hosxp) {
        c = STATUS_COLORS.partial; // เหลือง/ส้ม (ดำเนินการบางส่วน)
      }

      const deptPrefix = a.department ? `[${a.department}] ` : "";
      const title = `${deptPrefix}${a.name || "ไม่ระบุชื่อ"} (HN: ${a.hn || "-"})`;

      return {
        id: a.id,
        title: title,
        start: a.date,
        allDay: true,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: c.text,
        extendedProps: {
          ...a
        }
      };
    });
  },

  // รีเฟรชปฏิทิน
  refetchEvents: function() {
    if (calendarInstance) {
      calendarInstance.refetchEvents();
    }
  },

  // กรองตามแผนก
  filterDepartment: function(dept) {
    this.selectedDepartment = dept;
    this.refetchEvents();
  },

  // กรองตามสถานะ
  filterStatus: function(status) {
    this.selectedStatus = status;
    this.refetchEvents();
  },

  // เลื่อนปฏิทินไปยังวันที่ระบุ
  gotoDate: function(dateStr) {
    if (calendarInstance && dateStr) {
      calendarInstance.gotoDate(dateStr);
    }
  }
};

window.CalendarModule = CalendarModule;
