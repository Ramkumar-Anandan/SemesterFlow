
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface ModuleConfig {
  id: string;
  name: string;
  startLU: number;
  endLU: number;
  color: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  totalLUs: number;
  modules: ModuleConfig[];
  // New fields for structured export
  courseId?: string;
  mentorId?: string;
  defaultLuId?: string; // Fallback LU ID if no sequential mapping is used
  luIdMap?: Record<number, string>; // Maps LU number to specific LU ID string
}

export interface SlotDefinition {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

export interface Holiday {
  id: string;
  date: string;
  reason: string;
}

export interface CAConfig {
  id: string;
  label: string; 
  weekOrder: number; // Weeks in current phase
  duration: number; // Assessment days
  eventDays: number; // Event days attached to this CA
}

export interface WeeklyPattern {
  [day: string]: {
    [slotId: string]: string; // subjectId
  };
}

export interface SemesterConfig {
  startDate: string;
  endDate: string;
  name: string;
  squadNumber: string; // New field for squad identification
  workingDays: DayOfWeek[];
  slots: SlotDefinition[];
  subjects: Subject[];
  weeklyPattern: WeeklyPattern;
  holidays: Holiday[];
  cas: CAConfig[];
}

export interface ScheduleRow {
  date: string;
  dayName: string;
  weekNumber: number;
  dayInWeek: number; // 1-7 (Relative to Phase Anchor)
  status: 'working' | 'holiday' | 'weekend' | 'blocked' | 'ca' | 'event';
  reason?: string;
  slotMappings: {
    [slotId: string]: {
      type: 'subject' | 'ca' | 'event' | 'empty';
      label: string;
      color?: string;
      subjectId?: string; // Internal ID
      luNumber?: number; // The sequence number of the LU
    };
  };
}
