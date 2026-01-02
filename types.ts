
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
  courseId?: string; // Default/Global Course ID
  mentorId?: string;
  defaultLuId?: string;
  luIdMap?: Record<number, string>; // Maps LU number to LU ID string
  courseIdMap?: Record<number, string>; // Maps LU number to specific Course ID string
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
  weekOrder: number;
  duration: number;
  eventDays: number;
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
  squadNumber: string;
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
  dayInWeek: number;
  phaseId?: string; // ID of the CA phase this row belongs to
  status: 'working' | 'holiday' | 'weekend' | 'blocked' | 'ca' | 'event';
  reason?: string;
  slotMappings: {
    [slotId: string]: {
      type: 'subject' | 'ca' | 'event' | 'empty';
      label: string;
      color?: string;
      subjectId?: string;
      luNumber?: number;
      courseId?: string; // Resolved Course ID for this specific slot
    };
  };
}