
import { format, addDays, parseISO, isValid, differenceInDays, isAfter, isBefore, isSameDay, addYears } from 'date-fns';
import { SemesterConfig, ScheduleRow, DayOfWeek, Subject, CAConfig, WeeklyPattern, SlotDefinition, ModuleConfig } from '../types';
import * as XLSX from 'xlsx';

export const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
export const getDayName = (date: Date) => format(date, 'EEEE') as DayOfWeek;

const parseExcelDate = (val: any): string => {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + val * 86400000);
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

export interface SemesterStats {
  subjectName: string;
  phases: {
    modulePlanned: number | string;
    completedBeforeCA: number;
  }[];
}

export interface ProgramStats {
  totalDays: number;
  sundays: number;
  holidays: number;
  assessmentDays: number;
  eventDays: number;
  workingDays: number;
  learningDays: number;
}

export interface UtilizationStats {
  subjectName: string;
  availableSlots: number;
  utilizedSlots: number;
  unutilizedSlots: number;
}

export const calculateProgramStats = (schedule: ScheduleRow[]): ProgramStats => {
  const stats: ProgramStats = {
    totalDays: schedule.length,
    sundays: 0,
    holidays: 0,
    assessmentDays: 0,
    eventDays: 0,
    workingDays: 0,
    learningDays: 0
  };

  schedule.forEach(row => {
    if (row.dayName === 'Sunday') stats.sundays++;
    if (row.status === 'holiday') stats.holidays++;
    if (row.status === 'ca') stats.assessmentDays++;
    if (row.status === 'event') stats.eventDays++;
    if (row.status === 'working') {
      stats.workingDays++;
      // A learning day is a working day where at least one slot is occupied by a subject
      const hasSubject = Object.values(row.slotMappings).some(m => m.type === 'subject');
      if (hasSubject) stats.learningDays++;
    }
  });

  return stats;
};

export const calculateUtilizationStats = (config: SemesterConfig, schedule: ScheduleRow[]): UtilizationStats[] => {
  return config.subjects.map(subject => {
    let availableSlots = 0;
    let utilizedSlots = 0;

    schedule.forEach(row => {
      if (row.status === 'working') {
        Object.keys(row.slotMappings).forEach(slotId => {
          const mappedSubjectId = config.weeklyPattern[row.dayName as DayOfWeek]?.[slotId];
          if (mappedSubjectId === subject.id) {
            availableSlots++;
            const mapping = row.slotMappings[slotId];
            // Utilized means it's not a "completed" placeholder
            if (mapping.type === 'subject' && !mapping.label.endsWith(' - completed')) {
              utilizedSlots++;
            }
          }
        });
      }
    });

    if (subject.totalLUs === 0) {
      utilizedSlots = availableSlots;
    }

    return {
      subjectName: subject.name,
      availableSlots,
      utilizedSlots,
      unutilizedSlots: Math.max(0, availableSlots - utilizedSlots)
    };
  });
};

export const calculateSemesterStats = (config: SemesterConfig, schedule: ScheduleRow[]): SemesterStats[] => {
  const stats: SemesterStats[] = [];
  const caDates = config.cas.map(ca => {
    const firstCADay = schedule.find(row => row.status === 'ca' && row.reason?.includes(ca.label));
    return firstCADay ? firstCADay.date : null;
  });

  // Tracked subjects are those with LU tracking enabled (> 0)
  const trackedSubjects = config.subjects.filter(s => s.totalLUs > 0);

  trackedSubjects.forEach(subject => {
    const subjectPhases: SemesterStats['phases'] = [];
    const maxPhases = config.cas.length;
    
    for (let i = 0; i < maxPhases; i++) {
      const module = subject.modules[i];
      const caDate = caDates[i];
      const modulePlanned = module ? module.endLU : "N/A";
      
      let completedBeforeCA = 0;
      if (typeof caDate === 'string') {
        const caDateStr = caDate;
        schedule.forEach(row => {
          if (isBefore(parseISO(row.date), parseISO(caDateStr))) {
            Object.values(row.slotMappings).forEach(mapping => {
              if (mapping.type === 'subject' && mapping.label.startsWith(`${subject.name} - LU `)) {
                completedBeforeCA++;
              }
            });
          }
        });
      }
      subjectPhases.push({ modulePlanned, completedBeforeCA });
    }
    stats.push({ subjectName: subject.name, phases: subjectPhases });
  });

  return stats;
};

export const exportToExcel = (schedule: ScheduleRow[], slots: SlotDefinition[], config: SemesterConfig) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Detailed Schedule
  const scheduleHeaders = ["Phase Wk/D", "Date", "Day", "Status", "Reason", ...slots.map(s => s.label)];
  const scheduleRowsData = schedule.map(row => {
    const slotContent = slots.map(slot => {
      const mapping = row.slotMappings[slot.id];
      if (mapping.type === 'subject') return mapping.label;
      if (mapping.type === 'ca') return "ASSESSMENT";
      if (mapping.type === 'event') return "EVENT";
      return "";
    });
    return [`W${row.weekNumber}D${row.dayInWeek}`, row.date, row.dayName, row.status, row.reason || "", ...slotContent];
  });
  const wsSchedule = XLSX.utils.aoa_to_sheet([scheduleHeaders, ...scheduleRowsData]);
  XLSX.utils.book_append_sheet(wb, wsSchedule, "Master Schedule");

  // Sheet 2: Statistics & Reports
  const programStats = calculateProgramStats(schedule);
  const phasingStats = calculateSemesterStats(config, schedule);
  const utilizationStats = calculateUtilizationStats(config, schedule);

  const statsOutput: any[][] = [];

  statsOutput.push(["PROGRAM-LEVEL STATISTICS"]);
  statsOutput.push(["Metric", "Value"]);
  statsOutput.push(["Total Semester Days", programStats.totalDays]);
  statsOutput.push(["Total Sundays", programStats.sundays]);
  statsOutput.push(["Total Public Holidays", programStats.holidays]);
  statsOutput.push(["Total Assessment Days", programStats.assessmentDays]);
  statsOutput.push(["Total Event Days", programStats.eventDays]);
  statsOutput.push(["Total Working Days", programStats.workingDays]);
  statsOutput.push(["Total Learning Days", programStats.learningDays]);
  statsOutput.push([]);

  statsOutput.push(["SUBJECT SLOT UTILIZATION"]);
  statsOutput.push(["Subject Name", "Total Available Slots", "Utilized Slots", "Unutilized Slots"]);
  utilizationStats.forEach(u => {
    statsOutput.push([u.subjectName, u.availableSlots, u.utilizedSlots, u.unutilizedSlots]);
  });
  statsOutput.push([]);

  statsOutput.push(["SUBJECT PHASING STATISTICS (Tracked Only)"]);
  const maxPhases = config.cas.length;
  const phasingHeaders = ["Subject Name"];
  for (let i = 1; i <= maxPhases; i++) {
    phasingHeaders.push(`Planned till Mod ${i}`, `Completed before CA ${i}`);
  }
  statsOutput.push(phasingHeaders);
  phasingStats.forEach(s => {
    // Fix: Explicitly type row as (string | number)[] to avoid TypeScript error when pushing numbers into an inferred string array.
    const row: (string | number)[] = [s.subjectName];
    for (let i = 0; i < maxPhases; i++) {
      const p = s.phases[i];
      row.push(p?.modulePlanned ?? "-", p?.completedBeforeCA ?? 0);
    }
    statsOutput.push(row);
  });

  const wsStats = XLSX.utils.aoa_to_sheet(statsOutput);
  XLSX.utils.book_append_sheet(wb, wsStats, "Reports & Statistics");

  XLSX.writeFile(wb, `${config.name.replace(/\s+/g, '_')}_Academic_Report.xlsx`);
};

export const generateMasterSchedule = (config: SemesterConfig): ScheduleRow[] => {
  if (!config.startDate || !config.endDate) return [];
  const start = parseISO(config.startDate);
  const end = parseISO(config.endDate);
  if (!isValid(start) || !isValid(end) || isAfter(start, end) || isAfter(start, addYears(start, 5))) return [];

  const rows: ScheduleRow[] = [];
  const holidaySet = new Set(config.holidays.map(h => h.date));
  const holidayMap = new Map(config.holidays.map(h => [h.date, h.reason]));
  const anchorDate = start;

  const subjectLUCounters: Record<string, number> = {};

  const addDayToSchedule = (date: Date, type: 'normal' | 'ca' | 'event', caRef?: CAConfig) => {
    if (isAfter(date, end)) return false;
    const dateStr = formatDate(date);
    const dayName = getDayName(date);
    const diffFromStart = differenceInDays(date, anchorDate);
    const weekNumber = Math.floor(diffFromStart / 7) + 1;
    const dayInWeek = (diffFromStart % 7) + 1;

    const isHoliday = holidaySet.has(dateStr);
    const holidayReason = holidayMap.get(dateStr);
    const isWorkingDayConfig = config.workingDays.includes(dayName as DayOfWeek);
    
    let status: ScheduleRow['status'] = 'working';
    let reason = '';
    if (isHoliday) { status = 'holiday'; reason = holidayReason || 'Holiday'; }
    else if (!isWorkingDayConfig) { status = 'weekend'; reason = 'Rest Day'; }
    else if (type === 'ca') { status = 'ca'; reason = caRef?.label || 'Assessment'; }
    else if (type === 'event') { status = 'event'; reason = `Event (${caRef?.label})`; }

    const slotMappings: ScheduleRow['slotMappings'] = {};
    config.slots.forEach(slot => {
      if (status === 'ca') {
        slotMappings[slot.id] = { type: 'ca', label: 'ASSESSMENT' };
      } else if (status === 'event') {
        slotMappings[slot.id] = { type: 'event', label: 'EVENT' };
      } else if (status === 'working') {
        const subjectId = config.weeklyPattern[dayName]?.[slot.id];
        const subject = config.subjects.find(s => s.id === subjectId);
        if (subject) {
          if (subject.totalLUs && subject.totalLUs > 0) {
            subjectLUCounters[subjectId] = (subjectLUCounters[subjectId] || 0) + 1;
            const currentLU = subjectLUCounters[subjectId];
            
            if (currentLU <= subject.totalLUs) {
              const activeModule = subject.modules.find(m => currentLU >= m.startLU && currentLU <= m.endLU);
              slotMappings[slot.id] = { 
                type: 'subject', 
                label: `${subject.name} - LU ${currentLU}`, 
                color: activeModule ? activeModule.color : subject.color 
              };
            } else {
              slotMappings[slot.id] = { 
                type: 'subject', 
                label: `${subject.name} - completed`, 
                color: '#94a3b8' 
              };
            }
          } else {
            slotMappings[slot.id] = { 
              type: 'subject', 
              label: subject.name, 
              color: subject.color 
            };
          }
        } else {
          slotMappings[slot.id] = { type: 'empty', label: '' };
        }
      } else {
        slotMappings[slot.id] = { type: 'empty', label: '' };
      }
    });

    rows.push({ date: dateStr, dayName, weekNumber, dayInWeek, status, reason, slotMappings });
    return true;
  };

  const isWorking = (date: Date) => {
    const dStr = formatDate(date);
    return config.workingDays.includes(getDayName(date)) && !holidaySet.has(dStr);
  };

  let safetyCounter = 0;
  const MAX_DAYS = 5000;
  let currentProcessingDate = start;

  for (const ca of config.cas) {
    if (safetyCounter > MAX_DAYS) break;
    const phaseDates: Date[] = [];
    for (let i = 0; i < ca.weekOrder * 7; i++) {
      const d = addDays(currentProcessingDate, i);
      if (isAfter(d, end)) break;
      phaseDates.push(d);
    }
    const workingInPhase = phaseDates.filter(d => isWorking(d));
    const totalBlockNeeded = ca.duration + ca.eventDays;
    const caDates = workingInPhase.slice(-totalBlockNeeded).slice(0, ca.duration);
    const eventDates = workingInPhase.slice(-ca.eventDays);
    const lastDateToFill = phaseDates.length > 0 ? phaseDates[phaseDates.length - 1] : currentProcessingDate;
    let d = currentProcessingDate;
    while (!isAfter(d, lastDateToFill) && safetyCounter < MAX_DAYS) {
      const isCA = caDates.some(cd => isSameDay(cd, d));
      const isEvent = eventDates.some(ed => isSameDay(ed, d));
      const type = isCA ? 'ca' : (isEvent ? 'event' : 'normal');
      if (!addDayToSchedule(d, type, ca)) break;
      d = addDays(d, 1);
      safetyCounter++;
    }
    currentProcessingDate = d;
  }
  while ((isBefore(currentProcessingDate, end) || isSameDay(currentProcessingDate, end)) && safetyCounter < MAX_DAYS) {
    if (!addDayToSchedule(currentProcessingDate, 'normal')) break;
    currentProcessingDate = addDays(currentProcessingDate, 1);
    safetyCounter++;
  }
  return rows;
};

export const downloadExcelTemplate = () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Property", "Value", "Format"],
    ["Semester Name", "Academic Plan", "Text"],
    ["Start Date", "2025-12-15", "YYYY-MM-DD or DD/MM/YYYY"],
    ["End Date", "2026-04-21", "YYYY-MM-DD or DD/MM/YYYY"],
    ["Working Days", "Monday, Tuesday, Wednesday, Thursday, Friday", "Comma separated"]
  ]), "1. Settings");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Name", "Total LUs", "Base Color (Hex Code)"],
    ["Applied Physics", "20", "#6366f1"],
    ["General Elective", "0", "#ec4899"]
  ]), "2. Subjects");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Slot Label", "Start Time", "End Time"],
    ["Period 1", "09:00", "10:30"]
  ]), "3. Slots");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Day", "Period 1"],
    ["Monday", "Applied Physics"],
    ["Tuesday", "General Elective"]
  ]), "4. Weekly Pattern");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Date", "Reason"],
    ["2026-01-01", "New Year"]
  ]), "5. Holidays");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["CA Label", "Target Week (Relative)", "CA Duration", "Event Days"],
    ["CA 1", "4", "2", "1"]
  ]), "6. Assessments");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Subject Name", "Module Name", "Start LU", "End LU", "Color (Hex)"],
    ["Applied Physics", "Module 1", "1", "10", "#ef4444"],
    ["Applied Physics", "Module 2", "11", "20", "#3b82f6"]
  ]), "7. Modules");

  XLSX.writeFile(wb, "SemesterFlow_LU_Template.xlsx");
};

export const parseExcelImport = async (file: File): Promise<Partial<SemesterConfig>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const config: Partial<SemesterConfig> = {};
        const subjectMapByName = new Map<string, Subject>();

        // 1. Settings
        const sSheet = workbook.Sheets["1. Settings"];
        if (sSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(sSheet, { header: 1 });
          rows.forEach((r: any) => {
            if (r[0] === "Semester Name") config.name = String(r[1]);
            if (r[0] === "Start Date") config.startDate = parseExcelDate(r[1]);
            if (r[0] === "End Date") config.endDate = parseExcelDate(r[1]);
            if (r[0] === "Working Days") config.workingDays = (String(r[1] || "")).split(',').map((s: string) => s.trim() as DayOfWeek);
          });
        }

        // 2. Subjects
        const subSheet = workbook.Sheets["2. Subjects"];
        if (subSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(subSheet);
          config.subjects = rows.map((r: any) => {
            const rawLU = r["Total LUs"];
            const subject: Subject = {
              id: Math.random().toString(36).substr(2, 9),
              name: String(r["Name"] || "Unnamed Subject"),
              totalLUs: (rawLU === undefined || rawLU === null || String(rawLU).trim() === "") ? 0 : (parseInt(rawLU) || 0),
              color: String(r["Base Color (Hex Code)"] || "#6366f1"),
              modules: []
            };
            subjectMapByName.set(subject.name, subject);
            return subject;
          });
        }

        // 7. Modules
        const modSheet = workbook.Sheets["7. Modules"];
        if (modSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(modSheet);
          rows.forEach((r: any) => {
            const subjectName = String(r["Subject Name"]);
            const subject = subjectMapByName.get(subjectName);
            if (subject) {
              subject.modules.push({
                id: Math.random().toString(36).substr(2, 9),
                name: String(r["Module Name"]),
                startLU: parseInt(r["Start LU"]) || 1,
                endLU: parseInt(r["End LU"]) || 1,
                color: String(r["Color (Hex)"] || "#6366f1")
              });
            }
          });
        }

        // 3. Slots
        const slotSheet = workbook.Sheets["3. Slots"];
        const slotMapByLabel = new Map<string, string>();
        if (slotSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(slotSheet);
          config.slots = rows.map((r: any, idx: number) => {
            const id = `slot_${idx}`;
            const label = String(r["Slot Label"] || `Slot ${idx + 1}`);
            slotMapByLabel.set(label, id);
            return { id, label, startTime: String(r["Start Time"] || "09:00"), endTime: String(r["End Time"] || "10:00") };
          });
        }

        // 4. Weekly Pattern
        const patternSheet = workbook.Sheets["4. Weekly Pattern"];
        if (patternSheet) {
          const patternRows = XLSX.utils.sheet_to_json<any>(patternSheet);
          const weeklyPattern: WeeklyPattern = {};
          patternRows.forEach((r: any) => {
            const day = String(r["Day"]);
            if (!weeklyPattern[day]) weeklyPattern[day] = {};
            Object.keys(r).forEach(key => {
              if (key === "Day") return;
              const slotId = slotMapByLabel.get(key);
              const subjectObj = subjectMapByName.get(String(r[key]));
              if (slotId && subjectObj) { weeklyPattern[day][slotId] = subjectObj.id; }
            });
          });
          config.weeklyPattern = weeklyPattern;
        }

        // 5. Holidays
        const holidaySheet = workbook.Sheets["5. Holidays"];
        if (holidaySheet) {
          const rows = XLSX.utils.sheet_to_json<any>(holidaySheet);
          config.holidays = rows.map((r: any) => ({ id: Math.random().toString(36).substr(2, 9), date: parseExcelDate(r["Date"]), reason: String(r["Reason"] || "Holiday") }));
        }

        // 6. Assessments
        const caSheet = workbook.Sheets["6. Assessments"];
        if (caSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(caSheet);
          config.cas = rows.map((r: any) => ({ id: Math.random().toString(36).substr(2, 9), label: String(r["CA Label"] || "Assessment"), weekOrder: Math.max(1, parseInt(r["Target Week (Relative)"]) || 1), duration: Math.max(0, parseInt(r["CA Duration"]) || 1), eventDays: Math.max(0, parseInt(r["Event Days"]) || 0) }));
        }

        resolve(config);
      } catch (err) { reject(err); }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
