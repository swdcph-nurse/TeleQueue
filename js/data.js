/**
 * data.js - Data models, initial snapshot from Google Sheets, normalization and stats helpers
 */

// แปลงชื่อแผนกให้อยู่ใน 8 แผนกมาตรฐาน
function normalizeDepartment(raw) {
  if (!raw) return "อายุรกรรมทั่วไป";
  var s = String(raw).trim().toLowerCase();
  if (s === "med" || (s.includes("อายุรกรรม") && !s.includes("มะเร็ง"))) return "อายุรกรรมทั่วไป";
  if (s.includes("มะเร็ง") || s.includes("onco")) return "อายุรกรรมมะเร็ง";
  if (s === "sx" || s === "sx." || s.includes("ศัลยกรรม") || s.includes("surgery")) return "ศัลยกรรมทั่วไป";
  if (s.includes("ortho") || s.includes("กระดูก") || s.includes("ออร์โธ")) return "ออร์โธปิดิกส์";
  if (s.includes("ob") || s.includes("สูติ") || s.includes("นรีเวช")) return "สูติ-นรีเวช";
  if (s === "ped" || s.includes("กุมาร") || s.includes("เด็ก")) return "กุมารเวชกรรม";
  if (s.includes("eye") || s.includes("ตา") || s.includes("จักษุ")) return "จักษุ";
  if (s.includes("ent") || s.includes("โสต") || s.includes("หู") || s.includes("คอ") || s.includes("จมูก")) return "โสต ศอ นาสิก";
  return raw.trim();
}

// ฟังก์ชันแปลงวันที่ใดๆ ให้เป็น ISO YYYY-MM-DD
function normalizeDateStr(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    let year = parseInt(m[1], 10);
    const month = String(parseInt(m[2], 10)).padStart(2, "0");
    const day = String(parseInt(m[3], 10)).padStart(2, "0");
    if (year > 2400) {
      year -= 543;
    } else if (year >= 1960 && year <= 1975) {
      year = year + 57; // 1969 -> 2026
    }
    return `${year}-${month}-${day}`;
  }
  return s;
}

// แปลงวันที่ ISO เป็น พ.ศ. แสดงผลภาษาไทย
function formatThaiDateDisplay(isoDate) {
  if (!isoDate) return "-";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const y = parseInt(parts[0], 10) + 543;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const thaiMonths = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${thaiMonths[m] || m} ${y}`;
}

// ดึงวันที่วันนี้ในรูปแบบ YYYY-MM-DD (ค.ศ.)
function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ข้อมูลเริ่มต้นที่คัดลอกจาก Google Sheets จริงของตึกพิเศษปาริฉัตร-หอสงฆ์อาพาธ
const RAW_INITIAL_DATA = [
  { rawDate: "2568-11-25", name: "พระภิกษุพิชัย คะเสริมราช", cid: "", hn: "670003273", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "พ.พิชัย", notes: "", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2568-11-19", name: "น.ส.ทัศณี กุลศรี", cid: "3-4807-00578-66-9", hn: "540004589", department: "med", doctor: "นพ.เสฏฐนันท์", phone: "", lineName: "nunnun91", notes: "แม่พี่นันRN นัดฟังผลH/C", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2568-12-07", name: "นางจันทา ไชยรบ", cid: "3471200589972", hn: "410120053", department: "med", doctor: "พ.กานต์", phone: "0610971282", lineName: "นายฮ้อยเติ่ง", notes: "ฟังผลH/C=NG โทร+ถ่ายภาพหน้าจอไว้แล้ว", tele: true, hosxp: true, moph: true, checkMoph: true },
  { rawDate: "2568-12-24", name: "นายรักษ์  ไชยเลิศ", cid: "3-4712-00919-91-3", hn: "460012850", department: "Sx", doctor: "นพ.นภัทร", phone: "0807659346", lineName: "รักษ์  ไชยเลิศ", notes: "ติดตามอาการหลังผ่าไส้ติ่ง", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-01-04", name: "นายประยูรณ์  จันทร์เรือง", cid: "", hn: "450007269", department: "med", doctor: "", phone: "", lineName: "", notes: "", tele: true, hosxp: true, moph: true, checkMoph: true },
  { rawDate: "2569-01-04", name: "นายจรวด  ลาแสดง", cid: "", hn: "490004050", department: "med", doctor: "", phone: "", lineName: "", notes: "", tele: true, hosxp: true, moph: true, checkMoph: true },
  { rawDate: "2569-01-26", name: "น.ส.นวิญญา สุวรรณเทน", cid: "1-4799-00199-98-1", hn: "680008915", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "wynd.", notes: "ติดตามอาการหลังผ่าLC", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-01-21", name: "น.ส.ปริตา พรมจินดา", cid: "1-4786-00164-25-1", hn: "520002250", department: "med", doctor: "นพ.สิทธิพงษ์", phone: "", lineName: "", notes: "ฟังผลH/C", tele: true, hosxp: true, moph: true, checkMoph: true },
  { rawDate: "2569-01-26", name: "ด.ช.ชนกันต์ พรมโคตร", cid: "1-4199-03497-56-8", hn: "670009949", department: "ped", doctor: "พ.กานต์", phone: "0832411199", lineName: "Yuwadee", notes: "ฟังผลstool exam", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-02-09", name: "นางสุวรรณี สงแดง", cid: "5-4106-00101-65-4", hn: "69000799", department: "sx", doctor: "พ.นภัทร", phone: "", lineName: "วารี", notes: "ติดตามอาการ", tele: true, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-01-30", name: "ด.ญ.กุลณัฐ ทวีกัน", cid: "1-4786-00454-86-1", hn: "670000685", department: "ped", doctor: "พ.กานต์", phone: "", lineName: "", notes: "ติดตามอาการ", tele: false, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-01-29", name: "นายวุฒิชัย กิ่งมิ่งแฮ", cid: "3-4111-00888-43-9", hn: "630002684", department: "med", doctor: "พ.ณัฐวรางค์", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-01-30", name: "นายเด่นศักดิ์ ราวิวัฒน์", cid: "3-4108-00091-07-9", hn: "620009763", department: "Med", doctor: "พญ.ณัฐวรางค์", phone: "088-3104601", lineName: "ญาติเด่นศักดิ์", notes: "ฟังผล H/C = NG", tele: true, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-02-05", name: "นายวัชรพงศ์ ดวงสุภา", cid: "1-4786-00019-96-1", hn: "450007249", department: "Med", doctor: "พญ.ณัฐวรางค์", phone: "0984207770", lineName: "วัชรพงศ์ 5/2/69", notes: "ฟังผล H/C", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-02-06", name: "นายธนากร สมจินดา", cid: "1-4706-00118-72-4", hn: "580007991", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "096-1545869", lineName: "ญาติธนากร6/2", notes: "ฟังผล H/C", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-02-12", name: "นางสาวอรพรรณ บุญเพื่อ", cid: "1-4786-00194-97-5", hn: "530011350", department: "MED", doctor: "พ.สุเมธ", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-02-12", name: "นางประไพ โคตรปัญญา", cid: "3-4712-00191-77-4", hn: "410108766", department: "MED", doctor: "พ.สุเมธ", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-09", name: "ด.ช.ปัญญากร คำตานิตย์", cid: "1-4786-00339-10-8", hn: "600008306", department: "Sx", doctor: "ณภัทร", phone: "0820487668", lineName: "ปัญญากร นัด9/03/69", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-02", name: "นายธนกฤต สารมาศ", cid: "1-4705-00132-75-0", hn: "420002520", department: "MED", doctor: "พ.สุเมธ", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-19", name: "นางทันสมัย เนื่องจากจันทร์", cid: "3-4712-00092-32-6", hn: "450001329", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-19", name: "นายประไพ สุวรรณการ", cid: "5-4712-00015-83-2", hn: "440012526", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "", lineName: "", notes: "ฟังผล H/C UC", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-19", name: "น.ส.นภาลัย  ช่างสอน", cid: "1-4712-00066-66-3", hn: "430004416", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-20", name: "นางสุภัสตา สุริยะจันทร์", cid: "3-4712-00958-26-9", hn: "680004540", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "0952209716", lineName: "Telemed20/3/69สุภัสตา", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-03-30", name: "ร.ต.ต.นรินทร์ สังฆะพิลา", cid: "3-4712-01624-89-5", hn: "370028428", department: "MED", doctor: "นพ.สุเมธ", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-05-15", name: "นางสุนันท์ จอดนอก", cid: "3-4109-00557-97-5", hn: "490004450", department: "Sx", doctor: "นพ.นภัทร", phone: "0927131880", lineName: "สุนันท์จอดนอกTele15/5", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-04", name: "น.ส.อธิติยา ดำรงจิตร", cid: "1478600053972", hn: "470000111", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-07", name: "นางดวงจันทร์ ชุลเฟื้อง", cid: "3480100725679", hn: "400093672", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "", lineName: "Tumsak Tele7/6/69", notes: "ฟังผล H/C, RSC", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-11", name: "นางคำปุ่น เกษสะอาด", cid: "3471300215004", hn: "490003535", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "No growth", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-15", name: "นายทองเกื้อ สายคำพันธ์", cid: "3471200638965", hn: "460005968", department: "MED", doctor: "พ.อมร", phone: "No growth", lineName: "ทองเกื้อ Tele15/6/69", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-12", name: "น.ส.จันทร์จ้าว จันทร์สมคอย", cid: "1478600005374", hn: "510005502", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "No growth", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-06-24", name: "นางสุกัญญา พิมพ์ปัดชา", cid: "3471201125457", hn: "670008294", department: "MED", doctor: "พญ.เบญจวรรณ", phone: "", lineName: "Telemed 24/6/69สุกัญญา", notes: "ฟังผล H/C", tele: false, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-07-04", name: "นายเอกวัช ปิ่นใจ", cid: "3471200160399", hn: "540000638", department: "MED", doctor: "พ.กุลวดี", phone: "0872247670", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-07", name: "ด.ญ.ชนาภา สิงห์แก้ว", cid: "1478600221034", hn: "550000945", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "", notes: "ติดตามอาการ p/o appendectomy", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-08", name: "นายสมชาย สิงขรณ์", cid: "3410100922768", hn: "400093729", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "TeleMedคุณสมชาย8/8/69", notes: "ติดตามหลังผ่าไส้เลื่อน", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-18", name: "นางสาวสุกัญญ ยะสาร ", cid: "1478600179798", hn: "520012718", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "Telemedสุกัญญา18/8/69", notes: "ติดตามอาการ p/o appendectomy", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-12", name: "นายวัชรพงศ์ ดวงสุภา", cid: "1478600019961", hn: "450007249", department: "MED", doctor: "นพ.สิทธิิพงษ์", phone: "", lineName: "Telemedวัชรพงศ์12/8/69", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-17", name: "ร.ต.อ.สภักดิ์ บุราณ", cid: "3360400611971", hn: "620007797", department: "MED", doctor: "นพ.สิทธิพงษ์", phone: "", lineName: "Telemedสภักดิ์17/8/69", notes: "ฟังผล H/C, RSC", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-17", name: "นายธนภัทร โคตรบุดดา", cid: "1480101251062", hn: "450007288", department: "MED", doctor: "นพ.สิทธิพงษ์", phone: "", lineName: "Telemedธนภัทร17/8/69", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-19", name: "นางศิริพร คุณวงศ์", cid: "3471201076596", hn: "490010167", department: "MED", doctor: "พ.กุลวดีี", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-08-20", name: "นายชาย  ประคำไทย", cid: "3471200077513", hn: "450015436", department: "MED", doctor: "นพ.สิทธิพงษ์", phone: "061-1243589", lineName: "", notes: "ฟังผล H/C", tele: false, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-09-02", name: "นางจำนง จันทะเสน", cid: "3471200361963", hn: "560005935", department: "MED", doctor: "พญ.อิสรีย์", phone: "091-3572955", lineName: "นางจำนง tele 2/9/69", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: true, checkMoph: false },
  { rawDate: "2569-09-17", name: "ด.ญ.ญาณิศา เรืองวิชชา", cid: "1478600463275", hn: "670008257", department: "กุมาร", doctor: "พ.จุฬาลักษณ์", phone: "0857445922", lineName: "", notes: "", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-10-06", name: "นายกิเลนทอง สีสว่าง", cid: "3471201542503", hn: "460013923", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "", notes: "", tele: false, hosxp: false, moph: false, checkMoph: false },
  { rawDate: "2569-09-29", name: "นายธีรัสสะ ศรีมี", cid: "1479900890633", hn: "680004542", department: "MED", doctor: "พญ.ณัฎฐกมล", phone: "", lineName: "Line: Thiratsa", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-10-19", name: "ด.ช.ณภัทร ช้วนรักธรรม", cid: "1103101464487", hn: "650006657", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "ณภัทร Telemed 19ต.ค.69", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-10-19", name: "ด.ช.วีระวัฒน์ พลสวัสดิ์", cid: "1478600425373", hn: "", department: "กุมาร", doctor: "พ.พลอยลัดดา", phone: "0833265383", lineName: "วีระวัฒน์Telemed19ตค69", notes: "ติดตามอาการ ลูกพี่เฟิร์สแผนไทย", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-03", name: "นายจักรพันธ์  ต้นสายธนินท์", cid: "3471200271972", hn: "440015535", department: "Sx.", doctor: "นพ.นภัทร", phone: "098-1042927", lineName: "จักรพันธ์telemed 31/10/69", notes: "", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-10-20", name: "นางอารมณ์ จัดแจง", cid: "3411100840771", hn: "570001255", department: "MED", doctor: "พ.วิศรุต", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-10", name: "นายสมัย ไม้สน", cid: "3700100767719", hn: "690009982", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "", notes: "ติดตามอาการ", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-17", name: "นางสุนิศา นมนวน", cid: "1471200198195", hn: "410108574", department: "กุมาร", doctor: "พ.ยิ่งหทัย", phone: "0612538531", lineName: "สุนิศา Telemed17พ.ย.", notes: "ฟังผล H/C U/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-20", name: "นางนัก สารโพธิ์คำ", cid: "3430900761009", hn: "430016885", department: "MED", doctor: "พ.กุลวดี", phone: "0807566371", lineName: "Telemed นางนัก 20พ.ย.", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-20", name: "นางลัดดา วงศ์ษา", cid: "3430100446079", hn: "580004526", department: "MED", doctor: "พ.กุลวดี", phone: "", lineName: "", notes: "ฟังผล H/C", tele: true, hosxp: true, moph: false, checkMoph: false },
  { rawDate: "2569-11-21", name: "นายอดิศร วรราช", cid: "3471200889123", hn: "680011245", department: "MED", doctor: "พญ.ณัฐวรางค์", phone: "0895551234", lineName: "Adisorn 21/11", notes: "ติดตามความดันและผลเลือด H/C", tele: false, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-11-21", name: "นางมะลิวัลย์ คำพา", cid: "3471200123456", hn: "550009812", department: "Sx", doctor: "นพ.นภัทร", phone: "0921114321", lineName: "Maliwan Tele", notes: "ติดตามอาการแผลผ่าตัดถุงน้ำดี", tele: true, hosxp: false, moph: true, checkMoph: false },
  { rawDate: "2569-12-04", name: "พระเฉวตร แก้วเกิด", cid: "3411100824180", hn: "520001376", department: "Sx", doctor: "นพ.นภัทร", phone: "", lineName: "พระเศวตร Tele  4 ธ.ค.", notes: "ติิดตามผลหลังผ่าตัด Hernioplasty (พี่ชายพี่เปิ้ล)", tele: false, hosxp: false, moph: false, checkMoph: false }
];

// แปลงเป็น Object รูปแบบมาตรฐาน
function parseInitialSnapshot() {
  return RAW_INITIAL_DATA.map((item, idx) => {
    const isoDate = normalizeDateStr(item.rawDate);
    return {
      rowIndex: idx + 3,
      id: "APT-" + (idx + 1),
      date: isoDate,
      thaiDate: formatThaiDateDisplay(isoDate),
      rawDate: item.rawDate,
      name: item.name,
      cid: item.cid || "",
      hn: item.hn || "",
      department: normalizeDepartment(item.department),
      doctor: item.doctor || "",
      phone: item.phone || "",
      lineName: item.lineName || "",
      notes: item.notes || "",
      tele: item.tele === true,
      hosxp: item.hosxp === true,
      moph: item.moph === true,
      checkMoph: item.checkMoph === true,
      teleOperator: item.tele ? "พยาบาลเวรปาริฉัตร" : "",
      teleTime: item.tele ? "2026-11-20 09:30:00" : "",
      hosOperator: item.hosxp ? "พยาบาลเวรปาริฉัตร" : "",
      hosTime: item.hosxp ? "2026-11-20 10:15:00" : "",
      lineNotified: false
    };
  });
}

// โมดูลจัดการข้อมูลในเครื่อง (Local Cache)
const DataStore = {
  appointments: [],

  init: function() {
    const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE);
    if (cached) {
      try {
        this.appointments = JSON.parse(cached);
        return;
      } catch (e) {
        console.warn("Cannot parse cached appointments, falling back to snapshot", e);
      }
    }
    this.appointments = parseInitialSnapshot();
    this.saveToStorage();
  },

  getAll: function() {
    return [...this.appointments];
  },

  getById: function(id) {
    return this.appointments.find(a => a.id === id || String(a.rowIndex) === String(id));
  },

  getByDate: function(isoDate) {
    return this.appointments.filter(a => a.date === isoDate);
  },

  getToday: function() {
    const today = getTodayIso();
    return this.getByDate(today);
  },

  add: function(apt) {
    const isoDate = normalizeDateStr(apt.date || getTodayIso());
    const newApt = {
      ...apt,
      rowIndex: this.appointments.length + 3,
      id: "APT-" + Date.now(),
      date: isoDate,
      thaiDate: formatThaiDateDisplay(isoDate),
      department: normalizeDepartment(apt.department),
      tele: apt.tele === true,
      hosxp: apt.hosxp === true,
      moph: apt.moph === true,
      checkMoph: apt.checkMoph === true,
      lineNotified: false
    };
    this.appointments.unshift(newApt);
    this.saveToStorage();
    return newApt;
  },

  update: function(updatedApt) {
    const idx = this.appointments.findIndex(a => 
      (updatedApt.id && a.id === updatedApt.id) || 
      (updatedApt.rowIndex && a.rowIndex === parseInt(updatedApt.rowIndex, 10))
    );
    if (idx !== -1) {
      if (updatedApt.date) {
        updatedApt.date = normalizeDateStr(updatedApt.date);
        updatedApt.thaiDate = formatThaiDateDisplay(updatedApt.date);
      }
      if (updatedApt.department) {
        updatedApt.department = normalizeDepartment(updatedApt.department);
      }
      this.appointments[idx] = { ...this.appointments[idx], ...updatedApt };
      this.saveToStorage();
      return this.appointments[idx];
    }
    return null;
  },

  delete: function(idOrRowIndex) {
    this.appointments = this.appointments.filter(a => 
      a.id !== idOrRowIndex && String(a.rowIndex) !== String(idOrRowIndex)
    );
    this.saveToStorage();
  },

  setAll: function(list) {
    this.appointments = list.map((a, idx) => ({
      ...a,
      id: a.id || ("APT-" + (a.rowIndex || idx + 3)),
      thaiDate: formatThaiDateDisplay(a.date),
      department: normalizeDepartment(a.department)
    }));
    this.saveToStorage();
  },

  saveToStorage: function() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE, JSON.stringify(this.appointments));
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },

  // คำนวณสถิติสำหรับ Dashboard
  calculateStats: function() {
    const todayIso = getTodayIso();
    const all = this.appointments;
    const todayList = all.filter(a => a.date === todayIso);
    
    // 1. สรุปจำนวนนัดวันนี้
    const todayCount = todayList.length;

    // 2. นัดทั้งหมด
    const totalCount = all.length;

    // 3. นัดที่ยังไม่ได้โทร (ภาพรวมและวันนี้)
    const pendingCallToday = todayList.filter(a => !a.tele).length;
    const pendingCallAll = all.filter(a => !a.tele).length;

    // 4. จำนวนที่โทรแล้วและบันทึก HosXP แล้ว (ภาพรวมและวันนี้)
    const completedToday = todayList.filter(a => a.tele && a.hosxp).length;
    const completedAll = all.filter(a => a.tele && a.hosxp).length;

    // 5. แจ้งเตือนรายการที่ยังดำเนินการไม่ครบ (วันนี้: ยังไม่โทร หรือ ยังไม่ลง HosXP)
    const incompleteTodayList = todayList.filter(a => !a.tele || !a.hosxp);
    const incompleteTodayCount = incompleteTodayList.length;

    // 6. แยกตามสถานะ
    // สมบูรณ์ (เขียว)
    const statusCompleted = all.filter(a => a.tele && a.hosxp).length;
    // บางส่วน (ส้ม) เช่น โทรแล้วแต่ยังไม่ลง Hos
    const statusPartial = all.filter(a => (a.tele && !a.hosxp) || (!a.tele && a.hosxp)).length;
    // ยังไม่เริ่ม (แดง)
    const statusPending = all.filter(a => !a.tele && !a.hosxp).length;

    // 7. สรุปตามแผนก (ครอบคลุมทั้ง 8 แผนก)
    const deptStats = {};
    if (window.CONFIG && Array.isArray(window.CONFIG.DEPARTMENTS)) {
      window.CONFIG.DEPARTMENTS.forEach(dep => { deptStats[dep] = 0; });
    }
    all.forEach(a => {
      const d = normalizeDepartment(a.department);
      deptStats[d] = (deptStats[d] || 0) + 1;
    });

    return {
      todayIso,
      todayCount,
      totalCount,
      pendingCallToday,
      pendingCallAll,
      completedToday,
      completedAll,
      incompleteTodayCount,
      incompleteTodayList,
      statusCompleted,
      statusPartial,
      statusPending,
      deptStats
    };
  }
};

window.DataStore = DataStore;
window.normalizeDateStr = normalizeDateStr;
window.formatThaiDateDisplay = formatThaiDateDisplay;
window.getTodayIso = getTodayIso;
