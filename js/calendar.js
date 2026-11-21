/**
 * calendar.js - FullCalendar Integration with Month, Week, Day, List Views and Color Coding
 */

let calendarInstance = null;

const CalendarModule = {
  selectedDepartment: "ALL",
  selectedStatus: "ALL",

  init: function(containerId) {
    const calendarEl = document.getElementById(containerId);
    if (!calendarEl) return;

    if (calendarInstance) {
      calendarInstance.destroy();
    }

    const self = this;

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "th",
      firstDay: 1, // เริ่มวันจันทร์
      height: "auto",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
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
        const statusText = (p.tele && p.hosxp) ? "[ครบถ้วน] ดำเนินการครบแล้ว" :
                           (p.tele && !p.hosxp) ? "[รอลง Hos] โทรแล้ว (ยังไม่ลง Hos)" :
                           (!p.tele && p.hosxp) ? "[รอโทร] ลง Hos แล้ว (ยังไม่โทร)" :
                           "[รอดำเนินการ] ยังไม่โทรและยังไม่ลง Hos";
        
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
      let bgColor = "#ef4444"; // แดง (ยังไม่ดำเนินการ)
      let borderColor = "#dc2626";
      let textColor = "#ffffff";

      if (a.tele && a.hosxp) {
        // เขียว (โทรแล้ว + HosXP แล้ว)
        bgColor = "#10b981";
        borderColor = "#059669";
      } else if (a.tele || a.hosxp) {
        // เหลือง/ส้ม (ดำเนินการบางส่วน)
        bgColor = "#f59e0b";
        borderColor = "#d97706";
      }

      const deptPrefix = a.department ? `[${a.department}] ` : "";
      const title = `${deptPrefix}${a.name || "ไม่ระบุชื่อ"} (HN: ${a.hn || "-"})`;

      return {
        id: a.id,
        title: title,
        start: a.date,
        allDay: true,
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: textColor,
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
