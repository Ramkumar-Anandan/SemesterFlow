import { format, addDays, parseISO, isValid, differenceInDays, isAfter, isBefore, isSameDay } from 'date-fns';
import { SemesterConfig, ScheduleRow, DayOfWeek, Subject, CAConfig, SlotDefinition } from '../types';
import * as XLSX from 'xlsx';

export const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || !isValid(d)) return "0000-00-00";
  return format(d, 'yyyy-MM-dd');
};

export const getDayName = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || !isValid(d)) return 'Monday' as DayOfWeek;
  return format(d, 'EEEE') as DayOfWeek;
};

const parseExcelDate = (val: any): string => {
  if (!val) return "";
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const hours = val.getHours();
    let snappedDate = new Date(val.getTime());
    if (hours >= 20) snappedDate = addDays(val, 1);
    return formatDate(snappedDate);
  }

  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + (val * 86400000) + 43200000); 
    return formatDate(jsDate);
  }

  const strVal = String(val).trim();
  if (!strVal) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) return strVal.substring(0, 10);
  const dmhMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmhMatch) {
    const [_, d, m, y] = dmhMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const isoDate = parseISO(strVal);
  if (isValid(isoDate)) return formatDate(isoDate);
  return strVal;
};

const getVal = (obj: any, keys: string[]) => {
  const foundKey = Object.keys(obj).find(k => {
    const cleanK = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    return keys.some(target => {
      const cleanTarget = target.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      return cleanK === cleanTarget;
    });
  });
  return foundKey ? obj[foundKey] : undefined;
};

const formatTimeForExport = (timeStr: string): string => timeStr.replace(':', '');

export const calculateProgramStats = (schedule: ScheduleRow[]) => {
  const stats = { 
    totalDays: schedule.length, 
    restSaturdays: 0, 
    restSundays: 0, 
    restDaysTotal: 0,
    holidays: 0, 
    assessmentDays: 0, 
    eventDays: 0, 
    workingDays: 0, 
    learningDays: 0 
  };

  schedule.forEach(row => {
    if (row.status === 'weekend') {
      stats.restDaysTotal++;
      if (row.dayName === 'Saturday') stats.restSaturdays++;
      if (row.dayName === 'Sunday') stats.restSundays++;
    }
    if (row.status === 'holiday') stats.holidays++;
    if (row.status === 'ca') stats.assessmentDays++;
    if (row.status === 'event') stats.eventDays++;
    if (row.status === 'working') {
      stats.workingDays++;
      // A learning day is a working day where at least one slot is assigned to a subject
      const hasSubject = Object.values(row.slotMappings).some(m => m.type === 'subject' && !m.label.endsWith(' - completed'));
      if (hasSubject) stats.learningDays++;
    }
  });
  return stats;
};

export const calculateUtilizationStats = (config: SemesterConfig, schedule: ScheduleRow[]) => {
  return config.subjects
    .filter(subject => subject.totalLUs > 0)
    .map(subject => {
      let availableSlots = 0;
      let utilizedSlots = 0;
      schedule.forEach(row => {
        if (row.status === 'working') {
          Object.keys(row.slotMappings).forEach(slotId => {
            if (config.weeklyPattern[row.dayName as DayOfWeek]?.[slotId] === subject.id) {
              availableSlots++;
              if (row.slotMappings[slotId].type === 'subject' && !row.slotMappings[slotId].label.endsWith(' - completed')) utilizedSlots++;
            }
          });
        }
      });
      return { 
        subjectName: subject.name, 
        totalTargetLUs: subject.totalLUs,
        availableSlots, 
        utilizedSlots, 
        unutilizedSlots: Math.max(0, availableSlots - utilizedSlots) 
      };
    });
};

export const calculateSemesterStats = (config: SemesterConfig, schedule: ScheduleRow[]) => {
  const stats: any[] = [];
  const caDates = config.cas.map(ca => schedule.find(row => row.status === 'ca' && row.reason?.includes(ca.label))?.date || null);
  config.subjects.filter(s => s.totalLUs > 0).forEach(subject => {
    const subjectPhases = config.cas.map((_, i) => {
      const module = subject.modules[i];
      const caDate = caDates[i];
      let completedBeforeCA = 0;
      if (caDate) {
        const caDateObj = parseISO(caDate);
        if (isValid(caDateObj)) {
          schedule.forEach(row => {
            const rowDateObj = parseISO(row.date);
            if (isValid(rowDateObj) && isBefore(rowDateObj, caDateObj)) {
              Object.values(row.slotMappings).forEach(m => {
                if (m.type === 'subject' && m.subjectId === subject.id && !m.label.endsWith('completed')) completedBeforeCA++;
              });
            }
          });
        }
      }
      return { modulePlanned: module ? String(module.endLU) : "N/A", completedBeforeCA };
    });
    stats.push({ subjectName: subject.name, phases: subjectPhases });
  });
  return stats;
};

export const generateMasterSchedule = (config: SemesterConfig): ScheduleRow[] => {
  if (!config.startDate || !config.endDate) return [];
  const start = parseISO(config.startDate);
  const end = parseISO(config.endDate);
  if (!isValid(start) || !isValid(end)) return [];

  const rows: ScheduleRow[] = [];
  const holidaySet = new Set(config.holidays.map(h => h.date));
  const holidayMap = new Map(config.holidays.map(h => [h.date, h.reason]));
  const subjectLUCounters: Record<string, number> = {};

  const addDay = (date: Date, type: 'normal' | 'ca' | 'event', phaseId?: string, caRef?: CAConfig) => {
    const dateStr = formatDate(date);
    const dayName = getDayName(date);
    const diff = differenceInDays(date, start);
    const isHoliday = holidaySet.has(dateStr);
    const isWorkingDay = config.workingDays.includes(dayName as DayOfWeek);
    
    let status: ScheduleRow['status'] = 'working';
    let reason = '';
    if (isHoliday) { status = 'holiday'; reason = holidayMap.get(dateStr) || 'Holiday'; }
    else if (!isWorkingDay) { status = 'weekend'; reason = 'Rest Day'; }
    else if (type === 'ca') { status = 'ca'; reason = caRef?.label || 'Assessment'; }
    else if (type === 'event') { status = 'event'; reason = `Event (${caRef?.label})`; }

    const slotMappings: ScheduleRow['slotMappings'] = {};
    config.slots.forEach(slot => {
      if (status === 'ca') slotMappings[slot.id] = { type: 'ca', label: 'ASSESSMENT' };
      else if (status === 'event') slotMappings[slot.id] = { type: 'event', label: 'EVENT' };
      else if (status === 'working') {
        const subId = config.weeklyPattern[dayName]?.[slot.id];
        const sub = config.subjects.find(s => s.id === subId);
        if (sub) {
          if (sub.totalLUs > 0) {
            const currentLU = (subjectLUCounters[subId] || 0) + 1;
            subjectLUCounters[subId] = currentLU;
            if (currentLU <= sub.totalLUs) {
              const activeMod = sub.modules.find(m => currentLU >= m.startLU && currentLU <= m.endLU);
              const resolvedCourseId = sub.courseIdMap?.[currentLU] || sub.courseId;
              slotMappings[slot.id] = { 
                type: 'subject', 
                label: `${sub.name} - LU ${currentLU}`, 
                color: activeMod?.color || sub.color,
                subjectId: sub.id,
                luNumber: currentLU,
                courseId: resolvedCourseId
              };
            } else {
              slotMappings[slot.id] = { type: 'subject', label: `${sub.name} - completed`, color: '#94a3b8', subjectId: sub.id, courseId: sub.courseId };
            }
          } else {
            slotMappings[slot.id] = { type: 'subject', label: sub.name, color: sub.color, subjectId: sub.id, courseId: sub.courseId };
          }
        } else slotMappings[slot.id] = { type: 'empty', label: '' };
      } else slotMappings[slot.id] = { type: 'empty', label: '' };
    });
    rows.push({ date: dateStr, dayName, weekNumber: Math.floor(diff / 7) + 1, dayInWeek: (diff % 7) + 1, phaseId, status, reason, slotMappings });
    return true;
  };

  const isActuallyWorking = (d: Date) => config.workingDays.includes(getDayName(d)) && !holidaySet.has(formatDate(d));

  let currentPhasePointer = start;
  
  // Use the order from input, as Target Week is now relative to the previous assessment
  for (const ca of config.cas) {
    const relativeWeeks = ca.weekOrder || 1;
    let phaseLimitDate = addDays(currentPhasePointer, relativeWeeks * 7);

    // Ensure we don't skip the end of the semester
    if (isAfter(phaseLimitDate, end)) phaseLimitDate = end;

    const workingDaysInPhase = [];
    for (let d = currentPhasePointer; isBefore(d, phaseLimitDate) && !isAfter(d, end); d = addDays(d, 1)) {
      if (isActuallyWorking(d)) workingDaysInPhase.push(d);
    }

    const caCount = ca.duration || 0;
    const eventCount = ca.eventDays || 0;
    const totalBlock = caCount + eventCount;

    let caDates: Date[] = [];
    let eventDates: Date[] = [];

    // Correctly handle slices to avoid slice(-0) which returns the whole array
    if (totalBlock > 0 && workingDaysInPhase.length >= totalBlock) {
      const blockDates = workingDaysInPhase.slice(-totalBlock);
      if (caCount > 0) caDates = blockDates.slice(0, caCount);
      if (eventCount > 0) eventDates = blockDates.slice(-eventCount);
    } else if (totalBlock > 0) {
      // Prioritize CA if phase window is too tight
      caDates = workingDaysInPhase.slice(0, caCount);
      const remaining = workingDaysInPhase.length - caDates.length;
      if (remaining > 0 && eventCount > 0) {
        eventDates = workingDaysInPhase.slice(caDates.length, caDates.length + eventCount);
      }
    }

    // Process all days in the phase window
    for (let d = currentPhasePointer; isBefore(d, phaseLimitDate) && !isAfter(d, end); d = addDays(d, 1)) {
      const isCA = caDates.some(cd => isSameDay(cd, d));
      const isEvent = eventDates.some(ed => isSameDay(ed, d));
      const type = isCA ? 'ca' : (isEvent ? 'event' : 'normal');
      addDay(d, type, ca.id, ca);
    }

    currentPhasePointer = phaseLimitDate;
    if (isAfter(currentPhasePointer, end)) break;
  }

  // Final fill for post-assessment instructional days
  for (let d = currentPhasePointer; !isAfter(d, end); d = addDays(d, 1)) {
    addDay(d, 'normal', 'post-ca-phase');
  }
  
  return rows;
};

export const exportStructuredScheduleToExcel = (schedule: ScheduleRow[], slots: SlotDefinition[], config: SemesterConfig) => {
  const wb = XLSX.utils.book_new();
  const data: any[][] = [[(config.squadNumber || '').replace(/\s+/g, '')], ["slot_number", "date", "from", "to", "course_id", "lu_id", "mentor_id"]];
  schedule.forEach(row => {
    slots.forEach((slot, idx) => {
      const m = row.slotMappings[slot.id];
      if (m.type === 'subject') {
        const sub = config.subjects.find(s => s.id === m.subjectId);
        if (sub) {
          const luId = m.luNumber ? (sub.luIdMap?.[m.luNumber] || sub.defaultLuId || `LU_${m.luNumber}`) : (sub.defaultLuId || "");
          data.push([idx + 1, row.date, formatTimeForExport(slot.startTime), formatTimeForExport(slot.endTime), m.courseId || sub.courseId || "", luId, sub.mentorId || ""]);
        }
      }
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Matrix");
  XLSX.writeFile(wb, `${config.name}_Matrix.xlsx`);
};

export const exportToExcel = (schedule: ScheduleRow[], slots: SlotDefinition[], config: SemesterConfig) => {
  const wb = XLSX.utils.book_new();
  const headers = ["Phase Wk/D", "Date", "Day", "Status", "Reason", ...slots.map(s => s.label)];
  const rows = schedule.map(r => [`W${r.weekNumber}D${r.dayInWeek}`, r.date, r.dayName, r.status, r.reason || "", ...slots.map(s => r.slotMappings[s.id].label)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Master Schedule");
  XLSX.writeFile(wb, `${config.name}_Report.xlsx`);
};

export const downloadExcelTemplate = () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Property", "Value"], ["Semester Name", "Spring 25"], ["Squad Number", "S42"], ["Start Date", "2025-01-06"], ["End Date", "2025-05-30"], ["Working Days", "Monday, Tuesday, Wednesday, Thursday, Friday"]]), "1. Settings");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", "Total LUs", "Base Color"], ["Applied Physics", "20", "#6366f1"]]), "2. Subjects");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Slot Label", "Start Time", "End Time"], ["Slot 1", "09:00", "10:30"]]), "3. Slots");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Day", "Slot 1"], ["Monday", "Applied Physics"]]), "4. Weekly Pattern");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Reason"], ["2025-01-26", "Republic Day"]]), "5. Holidays");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["CA Label", "Target Week", "CA Duration", "Event Days"], ["CA 1", "4", "2", "1"]]), "6. Assessments");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Subject Name", "Module Name", "Start LU", "End LU", "Color"], ["Applied Physics", "Module 1", "1", "10", "#ef4444"]]), "7. Modules");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Course Name", "Default Course ID", "Default LU ID", "Mentor ID"], ["Applied Physics", "PHYS101", "PHYS_BASE", "M01"]]), "8. ID Mapping");
  const s9Data = [
    ["Applied Physics", "", "", "Growth Coaching", "", ""],
    ["Course ID", "LU Number", "LU ID", "Course ID", "LU Number", "LU ID"],
    ["PHYS101", 1, "AP_LU_1", "GRW200", 1, "GH_LU_1"],
    ["PHYS102", 2, "AP_LU_2", "GRW200", 2, "GH_LU_2"]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s9Data), "9. LU ID Mapping");
  XLSX.writeFile(wb, "SemesterFlow_Academic_Template.xlsx");
};

export const parseExcelImport = async (file: File): Promise<Partial<SemesterConfig>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const config: Partial<SemesterConfig> = {};
        const subjectMap = new Map<string, Subject>();

        const sSheet = wb.Sheets["1. Settings"];
        if (sSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(sSheet, { header: 1 });
          rows.forEach(r => {
            if (r[0] === "Semester Name") config.name = String(r[1]);
            if (r[0] === "Squad Number") config.squadNumber = String(r[1] || "");
            if (r[0] === "Start Date") config.startDate = parseExcelDate(r[1]);
            if (r[0] === "End Date") config.endDate = parseExcelDate(r[1]);
            if (r[0] === "Working Days") config.workingDays = String(r[1]).split(',').map(s => s.trim() as DayOfWeek);
          });
        }

        const subSheet = wb.Sheets["2. Subjects"];
        if (subSheet) {
          config.subjects = XLSX.utils.sheet_to_json<any>(subSheet).map(r => {
            const name = String(getVal(r, ["Name", "Subject Name"]) || "");
            const s = { id: Math.random().toString(36).substr(2, 9), name, totalLUs: parseInt(getVal(r, ["Total LUs"]) || 0), color: String(getVal(r, ["Base Color", "Color"]) || "#6366f1"), modules: [], luIdMap: {}, courseIdMap: {} };
            subjectMap.set(s.name, s);
            return s;
          });
        }

        const idSheet = wb.Sheets["8. ID Mapping"];
        if (idSheet) {
          XLSX.utils.sheet_to_json<any>(idSheet).forEach(r => {
            const s = subjectMap.get(String(getVal(r, ["Course Name", "Subject Name", "Name"])));
            if (s) { 
              s.courseId = String(getVal(r, ["Default Course ID", "Course ID"]) || ""); 
              s.defaultLuId = String(getVal(r, ["Default LU ID", "LU ID"]) || ""); 
              s.mentorId = String(getVal(r, ["Mentor ID"]) || ""); 
            }
          });
        }

        const luSheet = wb.Sheets["9. LU ID Mapping"];
        if (luSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(luSheet, { header: 1 });
          if (rows.length >= 2) {
            const subRow = rows[0]; 
            for (let col = 0; col < subRow.length; col += 3) {
              const subjectName = String(subRow[col] || "").trim();
              if (!subjectName || subjectName === "undefined") break; 
              
              const s = subjectMap.get(subjectName);
              if (s) {
                for (let r = 2; r < rows.length; r++) {
                  const cId = rows[r][col];
                  const luNum = parseInt(rows[r][col+1]);
                  const luId = rows[r][col+2];
                  if (!isNaN(luNum)) {
                    if (luId) s.luIdMap![luNum] = String(luId);
                    if (cId) s.courseIdMap![luNum] = String(cId);
                  }
                }
              }
            }
          }
        }

        const modSheet = wb.Sheets["7. Modules"];
        if (modSheet) {
          XLSX.utils.sheet_to_json<any>(modSheet).forEach(r => {
            const s = subjectMap.get(String(getVal(r, ["Subject Name", "Name"])));
            if (s) s.modules.push({ 
              id: Math.random().toString(36).substr(2, 9), 
              name: String(getVal(r, ["Module Name"]) || ""), 
              startLU: parseInt(getVal(r, ["Start LU"]) || 1), 
              endLU: parseInt(getVal(r, ["End LU"]) || 1), 
              color: String(getVal(r, ["Color"]) || "#6366f1") 
            });
          });
        }

        const slotSheet = wb.Sheets["3. Slots"];
        const slotMap = new Map<string, string>();
        if (slotSheet) {
          config.slots = XLSX.utils.sheet_to_json<any>(slotSheet).map((r, i) => {
            const id = `s${i}`;
            const label = String(getVal(r, ["Slot Label", "Label"]) || `Slot ${i+1}`);
            slotMap.set(label, id);
            return { id, label, startTime: String(getVal(r, ["Start Time"]) || "09:00"), endTime: String(getVal(r, ["End Time"]) || "10:30") };
          });
        }

        const patSheet = wb.Sheets["4. Weekly Pattern"];
        if (patSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(patSheet);
          config.weeklyPattern = {};
          rows.forEach(r => {
            const d = String(getVal(r, ["Day"]) || "");
            if (d) {
              config.weeklyPattern![d] = {};
              Object.keys(r).forEach(k => { 
                if (k !== "Day" && slotMap.has(k)) {
                  const subName = String(r[k]);
                  config.weeklyPattern![d][slotMap.get(k)!] = subjectMap.get(subName)?.id || ""; 
                }
              });
            }
          });
        }

        const holSheet = wb.Sheets["5. Holidays"];
        if (holSheet) config.holidays = XLSX.utils.sheet_to_json<any>(holSheet).map(r => ({ 
          id: Math.random().toString(36).substr(2, 9), 
          date: parseExcelDate(getVal(r, ["Date"])), 
          reason: String(getVal(r, ["Reason"]) || "Holiday") 
        }));

        const caSheet = wb.Sheets["6. Assessments"];
        if (caSheet) config.cas = XLSX.utils.sheet_to_json<any>(caSheet).map(r => ({ 
          id: Math.random().toString(36).substr(2, 9), 
          label: String(getVal(r, ["CA Label", "Label", "CI Label", "CI"]) || "CA"), 
          weekOrder: Math.max(1, parseInt(getVal(r, ["Target Week", "Week Order", "Week"]) || 1)), 
          duration: Math.max(0, parseInt(getVal(r, ["CA Duration", "Duration", "CI Duration"]) || 0)), 
          eventDays: Math.max(0, parseInt(getVal(r, ["Event Days", "Events"]) || 0)) 
        }));

        resolve(config);
      } catch (err) { reject(err); }
    };
    reader.readAsBinaryString(file);
  });
};