import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Settings, 
  Plus, 
  Trash2, 
  Sparkles, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  BookOpen,
  CalendarDays,
  ArrowRight,
  Upload,
  FileText,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  RefreshCw,
  Layout,
  Loader2,
  X,
  BarChart3,
  List,
  Target,
  Activity,
  CalendarCheck,
  Database,
  Table,
  Users,
  XCircle,
  Umbrella
} from 'lucide-react';
import { parseISO, isValid } from 'date-fns';
import { SemesterConfig, Subject, SlotDefinition, Holiday, CAConfig, ScheduleRow, ModuleConfig } from './types';
import { DAYS_OF_WEEK, COURSE_COLORS } from './constants';
import { generateMasterSchedule, downloadExcelTemplate, parseExcelImport, exportToExcel, exportStructuredScheduleToExcel, calculateSemesterStats, calculateProgramStats, calculateUtilizationStats, getDayName } from './utils/dateUtils';

const App: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); 
  const [loading, setLoading] = useState(false);
  const [editingSubjectModules, setEditingSubjectModules] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'detailed' | 'stats' | 'structured'>('detailed');
  
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');

  const [config, setConfig] = useState<SemesterConfig>({
    name: 'Academic Phased Plan',
    squadNumber: '',
    startDate: '2025-01-06',
    endDate: '2025-05-30',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    slots: [
      { id: 's1', label: 'Slot 1', startTime: '09:00', endTime: '10:30' },
      { id: 's2', label: 'Slot 2', startTime: '11:00', endTime: '12:30' }
    ],
    subjects: [],
    weeklyPattern: {},
    holidays: [],
    cas: []
  });

  const masterSchedule = useMemo(() => generateMasterSchedule(config), [config]);
  const phasingStats = useMemo(() => calculateSemesterStats(config, masterSchedule), [config, masterSchedule]);
  const programStats = useMemo(() => calculateProgramStats(masterSchedule), [masterSchedule]);
  const utilizationStats = useMemo(() => calculateUtilizationStats(config, masterSchedule), [config, masterSchedule]);

  const utilizationTotals = useMemo(() => {
    return utilizationStats.reduce((acc, curr) => ({
      totalTargetLUs: acc.totalTargetLUs + curr.totalTargetLUs,
      availableSlots: acc.availableSlots + curr.availableSlots,
      utilizedSlots: acc.utilizedSlots + curr.utilizedSlots,
      unutilizedSlots: acc.unutilizedSlots + curr.unutilizedSlots
    }), { totalTargetLUs: 0, availableSlots: 0, utilizedSlots: 0, unutilizedSlots: 0 });
  }, [utilizationStats]);

  const validateSubjectLUs = (subject: Subject): { valid: boolean; reason?: string } => {
    if (subject.totalLUs === 0) return { valid: true };
    if (subject.modules.length === 0) return { valid: false, reason: "Missing module configuration for tracked subject." };
    
    const lastModule = subject.modules[subject.modules.length - 1];
    if (lastModule.endLU !== subject.totalLUs) {
      return { 
        valid: false, 
        reason: `LU Mismatch: Semester requires ${subject.totalLUs} LUs, but final Module ends at ${lastModule.endLU}.` 
      };
    }
    return { valid: true };
  };

  const validationSummary = useMemo(() => {
    const total = config.subjects.length;
    const invalid = config.subjects.filter(s => !validateSubjectLUs(s).valid).length;
    return { total, invalid, valid: total - invalid };
  }, [config.subjects]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setTimeout(async () => {
      try {
        const importedData = await parseExcelImport(file);
        setConfig(prev => ({
          ...prev,
          ...importedData,
          subjects: importedData.subjects || prev.subjects,
          slots: importedData.slots || prev.slots,
          cas: importedData.cas || prev.cas,
          weeklyPattern: importedData.weeklyPattern || prev.weeklyPattern,
          holidays: importedData.holidays || prev.holidays
        }));
      } catch (err) {
        console.error(err);
        alert("Error during import. Check date formats and sheet names.");
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    }, 100);
  };

  const addManualHoliday = () => {
    if (!newHolidayDate || !newHolidayReason) return;
    setConfig({
      ...config,
      holidays: [
        ...config.holidays,
        { id: Math.random().toString(36).substr(2, 9), date: newHolidayDate, reason: newHolidayReason }
      ]
    });
    setNewHolidayDate('');
    setNewHolidayReason('');
  };

  const deleteHoliday = (id: string) => {
    setConfig({
      ...config,
      holidays: config.holidays.filter(h => h.id !== id)
    });
  };

  const addSubject = (name: string) => {
    if (!name.trim()) return;
    setConfig({ 
      ...config, 
      subjects: [...config.subjects, {
        id: Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        color: COURSE_COLORS[config.subjects.length % COURSE_COLORS.length],
        totalLUs: 0,
        modules: [],
        luIdMap: {}
      }]
    });
  };

  const addCA = () => {
    const newCA: CAConfig = {
      id: Math.random().toString(36).substr(2, 9),
      label: `CA ${config.cas.length + 1}`,
      weekOrder: 4,
      duration: 2,
      eventDays: 1
    };
    setConfig({ ...config, cas: [...config.cas, newCA] });
  };

  const updateSubjectLUs = (id: string, lus: number) => {
    setConfig({
      ...config,
      subjects: config.subjects.map(s => s.id === id ? { ...s, totalLUs: lus } : s)
    });
  };

  const addModule = (subjectId: string) => {
    setConfig({
      ...config,
      subjects: config.subjects.map(s => {
        if (s.id !== subjectId) return s;
        const newMod: ModuleConfig = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Module ${s.modules.length + 1}`,
          startLU: 1,
          endLU: 1,
          color: COURSE_COLORS[s.modules.length % COURSE_COLORS.length]
        };
        return { ...s, modules: [...s.modules, newMod] };
      })
    });
  };

  const stepsInfo = [
    { label: "Settings", icon: <Settings size={14}/> },
    { label: "Timeline", icon: <RefreshCw size={14}/> },
    { label: "Subjects", icon: <Layers size={14}/> },
    { label: "Mapping", icon: <FileText size={14}/> },
    { label: "Master Plan", icon: <CalendarDays size={14}/> },
  ];

  const currentEditingSubject = config.subjects.find(s => s.id === editingSubjectModules);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="font-black text-slate-800 tracking-tighter text-lg">Synchronizing Semester Logic...</p>
          </div>
        </div>
      )}

      {editingSubjectModules && currentEditingSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
               <div>
                 <h3 className="text-xl font-black">Modules: {currentEditingSubject.name}</h3>
                 <p className="text-slate-400 text-xs mt-1 font-bold">Total Semester LUs: {currentEditingSubject.totalLUs}</p>
               </div>
               <button onClick={() => setEditingSubjectModules(null)} className="p-3 hover:bg-white/10 rounded-full transition"><X /></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
               {currentEditingSubject.modules.map((mod, idx) => (
                 <div key={mod.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Name</label>
                      <input value={mod.name} onChange={e => {
                        const newSubs = [...config.subjects];
                        const sIdx = newSubs.findIndex(s => s.id === editingSubjectModules);
                        newSubs[sIdx].modules[idx].name = e.target.value;
                        setConfig({...config, subjects: newSubs});
                      }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Start LU</label>
                      <input type="number" value={mod.startLU} onChange={e => {
                        const newSubs = [...config.subjects];
                        const sIdx = newSubs.findIndex(s => s.id === editingSubjectModules);
                        newSubs[sIdx].modules[idx].startLU = parseInt(e.target.value) || 1;
                        setConfig({...config, subjects: newSubs});
                      }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">End LU</label>
                      <input type="number" value={mod.endLU} onChange={e => {
                        const newSubs = [...config.subjects];
                        const sIdx = newSubs.findIndex(s => s.id === editingSubjectModules);
                        newSubs[sIdx].modules[idx].endLU = parseInt(e.target.value) || 1;
                        setConfig({...config, subjects: newSubs});
                      }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Color</label>
                      <div className="flex gap-2">
                        <input type="color" value={mod.color} onChange={e => {
                          const newSubs = [...config.subjects];
                          const sIdx = newSubs.findIndex(s => s.id === editingSubjectModules);
                          newSubs[sIdx].modules[idx].color = e.target.value;
                          setConfig({...config, subjects: newSubs});
                        }} className="w-10 h-10 rounded-xl border-none p-0 overflow-hidden cursor-pointer" />
                        <button onClick={() => {
                          const newSubs = [...config.subjects];
                          const sIdx = newSubs.findIndex(s => s.id === editingSubjectModules);
                          newSubs[sIdx].modules = newSubs[sIdx].modules.filter(m => m.id !== mod.id);
                          setConfig({...config, subjects: newSubs});
                        }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18}/></button>
                      </div>
                    </div>
                 </div>
               ))}
               <button onClick={() => addModule(editingSubjectModules!)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-xs hover:bg-slate-50 transition">+ Add Module Range</button>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-end">
               <button onClick={() => setEditingSubjectModules(null)} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl transition active:scale-95">Complete Setup</button>
            </div>
          </div>
        </div>
      )}

      <nav className="no-print bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl">
            <CalendarDays size={24} />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter leading-none">SemesterFlow</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Academic Data Engine</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          {stepsInfo.map((s, i) => (
            <React.Fragment key={i}>
              <button onClick={() => setStep((i + 1) as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${step === i + 1 ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}>
                {s.icon} {s.label}
              </button>
              {i < stepsInfo.length - 1 && <ChevronRight size={14} className="text-slate-200" />}
            </React.Fragment>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
                <h2 className="text-3xl font-black mb-10 flex items-center gap-4 tracking-tighter"><Settings className="text-indigo-500" /> General Configuration</h2>
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Plan Designation</label>
                      <input value={config.name} onChange={e => setConfig({...config, name: e.target.value})} className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-xl outline-none focus:ring-4 focus:ring-indigo-50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> Squad Identifier</label>
                      <input placeholder="e.g. S42" value={config.squadNumber} onChange={e => setConfig({...config, squadNumber: e.target.value})} className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-xl outline-none focus:ring-4 focus:ring-indigo-50 transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Semester Start</label>
                      <input type="date" value={config.startDate} onChange={e => setConfig({...config, startDate: e.target.value})} className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-lg" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Semester End</label>
                      <input type="date" value={config.endDate} onChange={e => setConfig({...config, endDate: e.target.value})} className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-5 uppercase tracking-widest">Working Cycle Days</label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS_OF_WEEK.map(day => (
                        <button key={day} onClick={() => setConfig({ ...config, workingDays: config.workingDays.includes(day as any) ? config.workingDays.filter(d => d !== day) : [...config.workingDays, day as any] })} className={`px-6 py-4 rounded-[1.5rem] text-xs font-black border transition-all ${config.workingDays.includes(day as any) ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}>{day}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-4 tracking-tighter"><Umbrella className="text-rose-500" /> Holiday & Break Registry</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Date</label>
                    <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-50" />
                  </div>
                  <div className="md:col-span-6">
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Reason / Label</label>
                    <input placeholder="e.g. New Year's Day" value={newHolidayReason} onChange={e => setNewHolidayReason(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-50" />
                  </div>
                  <div className="md:col-span-2">
                    <button onClick={addManualHoliday} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs hover:bg-rose-700 transition active:scale-95 shadow-lg shadow-rose-100 flex items-center justify-center gap-2"><Plus size={16}/> Add</button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {config.holidays.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No holidays registered yet</p>
                    </div>
                  ) : (
                    config.holidays.map(holiday => {
                      const dateObj = parseISO(holiday.date);
                      const dayName = isValid(dateObj) ? getDayName(dateObj) : "Invalid Day";
                      return (
                        <div key={holiday.id} className="flex items-center justify-between p-5 bg-rose-50/50 border border-rose-100 rounded-2xl group hover:bg-rose-50 transition-all">
                          <div className="flex items-center gap-6">
                             <div className="flex flex-col">
                               <span className="text-xs font-black text-rose-700 font-mono">{holiday.date}</span>
                               <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{dayName}</span>
                             </div>
                             <span className="text-sm font-black text-slate-700 tracking-tight">{holiday.reason}</span>
                          </div>
                          <button onClick={() => deleteHoliday(holiday.id)} className="p-3 text-rose-300 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-sm"><Trash2 size={18}/></button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button onClick={() => setStep(2)} className="w-full py-7 bg-slate-900 text-white rounded-[3rem] font-black flex items-center justify-center gap-4 hover:bg-indigo-600 transition-all shadow-2xl text-lg tracking-tight">Set Phase Timelines <ArrowRight size={24} /></button>
            </div>
            
            <div className="space-y-8">
              <div className="bg-indigo-900 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><Layers size={120} /></div>
                <h3 className="text-2xl font-black mb-4 flex items-center gap-3 relative z-10"><Layers className="text-emerald-400" /> Data Ingestion</h3>
                <p className="text-indigo-200 text-sm mb-10 leading-relaxed font-bold relative z-10">Synchronize your entire academic structure, including Course IDs, Mentors, and LU Mappings from a single file.</p>
                <div className="space-y-4 relative z-10">
                  <button onClick={downloadExcelTemplate} className="w-full py-5 bg-indigo-800 hover:bg-indigo-700 rounded-3xl text-xs font-black flex items-center justify-center gap-2 transition-all border border-indigo-700/50 shadow-inner"><Download size={18} /> Download Master Template</button>
                  <label className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 rounded-3xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:scale-95"><Upload size={18} /> Import Excel Data<input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} /></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-8 mb-12 pb-10 border-b border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Academic Cycles</h2>
                <p className="text-slate-400 text-sm mt-2 font-bold uppercase tracking-wider">Define Assessment & Event Blocks for each Phase</p>
              </div>
              <button onClick={addCA} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2.5rem] text-sm font-black flex items-center gap-3 shadow-2xl shadow-indigo-100 transition-all active:scale-95"><Plus size={22} /> Add Cycle Phase</button>
            </div>
            <div className="space-y-10">
              {config.cas.map((ca, idx) => (
                <div key={ca.id} className="p-10 bg-slate-50/50 rounded-[3.5rem] border border-slate-100 relative group hover:bg-white hover:shadow-2xl transition-all duration-500">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-sm shadow-2xl ring-4 ring-white">{idx + 1}</div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end ml-8">
                    <div className="md:col-span-4"><label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Cycle Title</label><input value={ca.label} onChange={e => { const newCas = [...config.cas]; newCas[idx].label = e.target.value; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black shadow-sm outline-none focus:ring-4 focus:ring-indigo-50" /></div>
                    <div className="md:col-span-2"><label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Relative Week Offset</label><input type="number" min="1" value={ca.weekOrder} onChange={e => { const newCas = [...config.cas]; newCas[idx].weekOrder = parseInt(e.target.value) || 1; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2"><label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">CA Days</label><input type="number" min="1" max="7" value={ca.duration} onChange={e => { const newCas = [...config.cas]; newCas[idx].duration = parseInt(e.target.value) || 1; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2"><label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Event Days</label><input type="number" min="0" max="7" value={ca.eventDays} onChange={e => { const newCas = [...config.cas]; newCas[idx].eventDays = parseInt(e.target.value) || 0; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2 flex justify-end"><button onClick={() => setConfig({...config, cas: config.cas.filter(c => c.id !== ca.id)})} className="p-5 text-rose-400 hover:bg-rose-50 rounded-[2rem] transition-all"><Trash2 size={28} /></button></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 pt-12 border-t flex justify-between items-center"><button onClick={() => setStep(1)} className="px-10 py-5 rounded-2xl font-black flex items-center gap-3 text-slate-400 hover:bg-slate-50 transition uppercase tracking-widest text-xs"><ChevronLeft size={22} /> Settings</button><button onClick={() => setStep(3)} className="px-16 py-6 bg-indigo-600 text-white rounded-[3rem] font-black flex items-center gap-4 hover:bg-indigo-700 transition shadow-2xl text-lg">Define Subjects <ChevronRight size={24} /></button></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-10">
                 <h2 className="text-2xl font-black flex items-center gap-4 tracking-tighter"><BookOpen className="text-indigo-500" /> Subject Integrity</h2>
                 <div className="flex items-center gap-2">
                   <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 ${validationSummary.invalid > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                     {validationSummary.invalid > 0 ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
                     {validationSummary.invalid} Errors / {validationSummary.valid} Sync'd
                   </div>
                 </div>
               </div>
               
               <div className="flex gap-4 mb-10">
                 <input id="sub-input" placeholder="Enter New Subject Name..." className="flex-1 px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-50" onKeyDown={e => { if (e.key === 'Enter') { addSubject(e.currentTarget.value); e.currentTarget.value = ''; } }} />
                 <button onClick={() => { const el = document.getElementById('sub-input') as HTMLInputElement; addSubject(el.value); el.value = ''; }} className="bg-indigo-600 text-white px-8 py-5 rounded-[2rem] shadow-xl shadow-indigo-100 active:scale-95 transition-all"><Plus size={24}/></button>
               </div>

               <div className="space-y-6">
                 {config.subjects.map(s => {
                   const { valid, reason } = validateSubjectLUs(s);
                   return (
                     <div key={s.id} className={`flex flex-col p-8 rounded-[3rem] border transition-all relative group ${!valid ? 'bg-rose-50/50 border-rose-200 shadow-xl ring-2 ring-rose-100' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-2xl'}`}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-5">
                            <div className="w-6 h-6 rounded-full shadow-inner" style={{backgroundColor: s.color}}></div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-800 text-xl tracking-tighter">{s.name}</span>
                                
                                <div className="relative">
                                  {valid ? (
                                    <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg scale-90">
                                      <CheckCircle2 size={16} />
                                    </div>
                                  ) : (
                                    <div className="bg-rose-500 text-white p-1 rounded-full shadow-xl animate-pulse cursor-help group/tooltip">
                                      <XCircle size={16} />
                                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-[70]">
                                        <div className="bg-slate-900 text-white text-[11px] font-black px-5 py-3 rounded-2xl shadow-2xl min-w-[220px] text-center border border-slate-700 leading-snug">
                                          {reason}
                                        </div>
                                        <div className="w-3 h-3 bg-slate-900 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b border-slate-700"></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {s.courseId && <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">ID: {s.courseId} • Mentor: {s.mentorId || 'TBD'}</span>}
                            </div>
                          </div>
                          <button onClick={() => setConfig({...config, subjects: config.subjects.filter(sub => sub.id !== s.id)})} className="text-slate-300 hover:text-rose-500 p-3 transition-colors"><Trash2 size={22} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Total Target LUs</label>
                            <input type="number" min="0" value={s.totalLUs} onChange={e => updateSubjectLUs(s.id, parseInt(e.target.value) || 0)} className={`w-full bg-white border rounded-2xl px-5 py-3 text-sm font-black transition-all ${!valid ? 'border-rose-300 ring-4 ring-rose-50 text-rose-700' : 'border-slate-200 focus:ring-4 focus:ring-indigo-50'}`} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Module Sync</label>
                            <button 
                              onClick={() => setEditingSubjectModules(s.id)} 
                              disabled={s.totalLUs <= 0}
                              className={`w-full py-3 text-[10px] font-black uppercase rounded-2xl border transition-all flex items-center justify-center gap-2 ${s.totalLUs <= 0 ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed opacity-50' : !valid ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 shadow-sm'}`}
                            >
                              <Layers size={14}/> Setup Modules ({s.modules.length})
                            </button>
                          </div>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>
            <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
               <h2 className="text-2xl font-black mb-10 flex items-center gap-4 tracking-tighter"><Clock className="text-indigo-500" /> Daily Periods</h2>
               <div className="space-y-6">
                 {config.slots.map((slot, idx) => (
                   <div key={slot.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 p-7 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                     <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Label</label>
                       <input value={slot.label} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].label = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs font-black shadow-inner" />
                     </div>
                     <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Start Time</label>
                       <input type="time" value={slot.startTime} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].startTime = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold shadow-inner" />
                     </div>
                     <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">End Time</label>
                       <input type="time" value={slot.endTime} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].endTime = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold shadow-inner" />
                     </div>
                   </div>
                 ))}
                 <button onClick={() => setConfig({...config, slots: [...config.slots, { id: `s${Date.now()}`, label: `Slot ${config.slots.length+1}`, startTime: '09:00', endTime: '10:30' }]})} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 text-xs font-black hover:bg-slate-50 transition-all uppercase tracking-widest">+ Add New Period</button>
               </div>
               <div className="mt-12 pt-12 border-t"><button onClick={() => setStep(4)} className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-2xl text-lg hover:bg-indigo-700 transition active:scale-95">Set Blueprint Mapping</button></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-10">
            <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200 overflow-x-auto">
              <h2 className="text-3xl font-black mb-10 flex items-center gap-4 tracking-tighter"><Calendar className="text-indigo-500" /> Instructional Blueprint</h2>
              <table className="w-full border-separate border-spacing-2">
                <thead><tr><th className="p-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-3xl">Time / Period</th>{DAYS_OF_WEEK.map((day) => <th key={day} className="p-6 text-center text-[11px] font-black uppercase tracking-widest bg-slate-50/50 rounded-3xl">{day}</th>)}</tr></thead>
                <tbody>{config.slots.map(slot => (
                  <tr key={slot.id}>
                    <td className="p-7 font-black text-slate-800 bg-slate-50/20 rounded-3xl border border-slate-100 shadow-sm"><div className="text-base leading-none mb-2">{slot.label}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{slot.startTime} - {slot.endTime}</div></td>
                    {DAYS_OF_WEEK.map(day => (
                      <td key={`${day}-${slot.id}`} className="p-2">
                        <select value={config.weeklyPattern[day]?.[slot.id] || ""} onChange={e => setConfig({ ...config, weeklyPattern: { ...config.weeklyPattern, [day]: { ...(config.weeklyPattern[day] || {}), [slot.id]: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-[1.5rem] p-5 text-[11px] font-black focus:ring-4 focus:ring-indigo-50 shadow-sm appearance-none text-center cursor-pointer hover:border-indigo-300 transition-all">
                          <option value="">- FREE -</option>{config.subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex justify-center"><button onClick={() => setStep(5)} className="px-24 py-7 bg-slate-900 text-white rounded-[3rem] font-black shadow-2xl hover:bg-indigo-600 transition-all text-xl tracking-tight">Generate Final Master Plan <CheckCircle2 size={28} className="ml-3"/></button></div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
             <div className="no-print flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200 gap-10">
                <div className="flex-1">
                   <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{config.name}</h2>
                   <div className="flex flex-wrap items-center gap-8 text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] mt-6">
                     <span className="flex items-center gap-3 px-6 py-3 bg-indigo-50 rounded-full text-indigo-700 border border-indigo-100 shadow-sm font-bold"><RefreshCw size={16}/> DB SYNC READY</span>
                     <span className="flex items-center gap-3 px-6 py-3 bg-slate-100 rounded-full text-slate-600"><Users size={16}/> Squad: {config.squadNumber || 'GEN'}</span>
                     <span className="flex items-center gap-3 px-6 py-3 bg-slate-100 rounded-full text-slate-600"><Calendar size={16}/> {config.startDate} / {config.endDate}</span>
                   </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-100 p-2.5 rounded-[2.5rem] border border-slate-200 shadow-inner">
                  <button onClick={() => setViewMode('detailed')} className={`px-7 py-4 rounded-[1.8rem] text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'detailed' ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}><List size={18}/> Plan View</button>
                  <button onClick={() => setViewMode('structured')} className={`px-7 py-4 rounded-[1.8rem] text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'structured' ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}><Database size={18}/> Export Matrix</button>
                  <button onClick={() => setViewMode('stats')} className={`px-7 py-4 rounded-[1.8rem] text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'stats' ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 size={18}/> Reports</button>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={() => exportToExcel(masterSchedule, config.slots, config)} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black flex items-center gap-3 shadow-2xl hover:bg-indigo-600 transition-all whitespace-nowrap"><Download size={22} /> Detailed Report</button>
                  <button onClick={() => exportStructuredScheduleToExcel(masterSchedule, config.slots, config)} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all whitespace-nowrap"><Table size={22} /> Structured Matrix</button>
                </div>
             </div>

             {viewMode === 'detailed' && (
               <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[80vh] overflow-y-auto print:max-h-none">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-2xl">
                        <tr className="border-b border-slate-200">
                          <th className="p-8 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[140px]">Phase Wk/D</th>
                          <th className="p-8 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[180px]">Date/Day</th>
                          <th className="p-8 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[200px]">Status</th>
                          {config.slots.map(slot => (<th key={slot.id} className="p-8 text-center text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] border-l border-slate-200/50">{slot.label}<div className="font-bold opacity-30 mt-1">{slot.startTime}</div></th>))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {masterSchedule.map((row, idx) => {
                          const previousRow = idx > 0 ? masterSchedule[idx - 1] : null;
                          const isNewPhase = previousRow && row.phaseId !== previousRow.phaseId;
                          
                          // Phase labeling logic
                          const currentPhaseId = row.phaseId;
                          const phaseCycles = config.cas.find(c => c.id === currentPhaseId);

                          return (
                            <React.Fragment key={row.date}>
                              {isNewPhase && (
                                <tr className="bg-slate-900 group">
                                  <td colSpan={3 + config.slots.length} className="p-4 text-center text-[10px] font-black text-indigo-300 uppercase tracking-[0.8em] animate-pulse">
                                    {currentPhaseId === 'post-ca-phase' 
                                      ? `Final Instructional Block (End of Cycles)`
                                      : `Sequential Transition: Entering Phase of ${row.reason || 'Instruction'}`}
                                  </td>
                                </tr>
                              )}
                              <tr className={`group transition-all ${row.status === 'ca' ? 'bg-indigo-50/50' : row.status === 'event' ? 'bg-amber-50/50' : row.status === 'holiday' ? 'bg-rose-50/40' : 'hover:bg-slate-50/50'}`}>
                                <td className="p-8 align-top"><div className={`text-[11px] font-black text-center py-3 px-5 rounded-[1.5rem] border ${row.dayInWeek === 1 ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl' : 'text-slate-400 bg-white border-slate-100'}`}>W{row.weekNumber} D{row.dayInWeek}</div></td>
                                <td className="p-8 align-top"><div className="text-[11px] font-mono font-bold text-slate-400 mb-1">{row.date}</div><div className="text-sm font-black text-slate-800 tracking-tighter uppercase">{row.dayName}</div></td>
                                <td className="p-8 align-top">
                                  {row.status === 'ca' ? (<div className="flex items-center gap-3 text-indigo-700 font-black text-[10px] uppercase bg-indigo-100/80 px-5 py-3 rounded-2xl border border-indigo-200"><FileText size={18} /> {row.reason}</div>) 
                                  : row.status === 'event' ? (<div className="flex items-center gap-3 text-amber-700 font-black text-[10px] uppercase bg-amber-100/80 px-5 py-3 rounded-2xl border border-amber-200"><Sparkles size={18} /> {row.reason}</div>) 
                                  : row.status === 'holiday' ? (<div className="flex items-center gap-3 text-rose-600 font-black text-[10px] uppercase bg-rose-100/80 px-5 py-3 rounded-2xl border border-rose-200"><AlertCircle size={18} /> {row.reason}</div>) 
                                  : row.status === 'weekend' ? (<div className="flex items-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] bg-slate-100/50 px-4 py-2 rounded-xl">Rest Day</div>) 
                                  : (<div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] px-4 py-2">Standard</div>)}
                                </td>
                                {config.slots.map(slot => {
                                  const mapping = row.slotMappings[slot.id];
                                  return (
                                    <td key={slot.id} className="p-5 border-l border-slate-100/50 align-top">
                                      {mapping.type === 'subject' ? (
                                        <div className="p-6 rounded-[2.5rem] text-[10px] font-black shadow-sm border text-center transition-all group-hover:scale-[1.05] group-hover:shadow-lg" style={{ backgroundColor: `${mapping.color}15`, borderColor: `${mapping.color}40`, color: mapping.color }}>
                                          {mapping.label}
                                        </div>
                                      ) : mapping.type === 'ca' ? (<div className="p-6 rounded-[2.5rem] bg-indigo-600 text-white text-[11px] font-black text-center shadow-xl animate-pulse">ASSESSMENT</div>) 
                                      : mapping.type === 'event' ? (<div className="p-6 rounded-[2.5rem] bg-amber-500 text-white text-[11px] font-black text-center shadow-xl">EVENT</div>) 
                                      : (<div className="h-16 rounded-[2.5rem] bg-slate-50/50 border border-dashed border-slate-200/40"></div>)}
                                    </td>
                                  );
                                })}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}

             {viewMode === 'structured' && (
               <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                  <div className="p-12 border-b bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Database className="text-indigo-600"/> Data Matrix View</h3>
                      <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">Compatible with External ID Mapping Systems</p>
                    </div>
                    <button onClick={() => exportStructuredScheduleToExcel(masterSchedule, config.slots, config)} className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] text-sm font-black flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all"><Download size={18}/> Export Matrix.xlsx</button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white sticky top-0 z-10">
                          {["slot_number", "date", "from", "to", "course_id", "lu_id", "mentor_id"].map(h => (
                            <th key={h} className="p-5 text-[11px] font-black uppercase tracking-widest text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {masterSchedule.flatMap(row => 
                          config.slots.map((slot, sIdx) => {
                            const mapping = row.slotMappings[slot.id];
                            if (mapping.type !== 'subject') return null;
                            const subject = config.subjects.find(s => s.id === mapping.subjectId);
                            if (!subject) return null;
                            
                            let luId = "";
                            if (mapping.luNumber && subject.luIdMap && subject.luIdMap[mapping.luNumber]) {
                              luId = subject.luIdMap[mapping.luNumber];
                            } else {
                              luId = subject.defaultLuId || (mapping.luNumber ? `LU_${mapping.luNumber}` : "");
                            }

                            return (
                              <tr key={`${row.date}-${slot.id}`} className="hover:bg-slate-50/80 transition-all font-mono text-xs">
                                <td className="p-5">{sIdx + 1}</td>
                                <td className="p-5 font-black">{row.date}</td>
                                <td className="p-5">{slot.startTime.replace(':','')}</td>
                                <td className="p-5">{slot.endTime.replace(':','')}</td>
                                <td className="p-5 font-black text-indigo-600">{mapping.courseId || subject.courseId || subject.id}</td>
                                <td className="p-5 text-emerald-600">{luId}</td>
                                <td className="p-5 text-slate-500 font-bold">{subject.mentorId || '—'}</td>
                              </tr>
                            );
                          }).filter(Boolean)
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}

             {viewMode === 'stats' && (
               <div className="space-y-12 animate-in fade-in duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    {[
                      { label: "Total Plan", val: programStats.totalDays, icon: <Calendar size={20}/>, color: "slate" },
                      { 
                        label: "Rest Days", 
                        val: programStats.restDaysTotal, 
                        icon: <CalendarCheck size={20}/>, 
                        color: "rose", 
                        subNote: `Sat: ${programStats.restSaturdays}, Sun: ${programStats.restSundays}`
                      },
                      { label: "Holidays", val: programStats.holidays, icon: <AlertCircle size={20}/>, color: "rose" },
                      { label: "Assessments", val: programStats.assessmentDays, icon: <FileText size={20}/>, color: "indigo" },
                      { label: "Events", val: programStats.eventDays, icon: <Sparkles size={20}/>, color: "amber" },
                      { 
                        label: "Learning Days", 
                        val: programStats.learningDays, 
                        icon: <Target size={20}/>, 
                        color: "indigo",
                        subNote: "Days with Instructional Units"
                      },
                    ].map((st, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                        <div className={`p-4 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${st.color === 'slate' ? 'text-slate-600 bg-slate-50' : st.color === 'rose' ? 'text-rose-600 bg-rose-50' : st.color === 'indigo' ? 'text-indigo-600 bg-indigo-50' : st.color === 'amber' ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>{st.icon}</div>
                        <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{st.val}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">{st.label}</div>
                        {st.subNote && <div className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{st.subNote}</div>}
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm text-center">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                      Derivation Logic: Learning Days ({programStats.learningDays}) = Total Days ({programStats.totalDays}) - Rest Days ({programStats.restDaysTotal}) - Holidays ({programStats.holidays}) - Assessments ({programStats.assessmentDays}) - Events ({programStats.eventDays}) - Non-Teaching Work Days ({programStats.workingDays - programStats.learningDays})
                    </p>
                  </div>

                  <div className="bg-white rounded-[4rem] shadow-xl border border-slate-200 overflow-hidden">
                    <div className="p-12">
                      <h3 className="text-2xl font-black mb-8 flex items-center gap-4"><Activity className="text-emerald-500"/> Capacity Utilization</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-8 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tl-3xl">Subject Entity</th>
                            <th className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Learning Units</th>
                            <th className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Gross Capacity</th>
                            <th className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Utilized Units</th>
                            <th className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tr-3xl">Surplus Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {utilizationStats.map(u => (
                            <tr key={u.subjectName} className="hover:bg-slate-50 transition-all">
                              <td className="p-8 font-black text-slate-900 text-lg tracking-tight">{u.subjectName}</td>
                              <td className="p-8 text-center text-base font-bold text-slate-500">{u.totalTargetLUs}</td>
                              <td className="p-8 text-center text-base font-bold text-slate-500">{u.availableSlots}</td>
                              <td className="p-8 text-center">
                                <span className={`px-6 py-3 rounded-[1.5rem] text-xs font-black shadow-sm ${u.unutilizedSlots === 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                  {u.utilizedSlots}
                                </span>
                              </td>
                              <td className="p-8 text-center">
                                <span className={`px-6 py-3 rounded-[1.5rem] text-xs font-black shadow-sm ${u.unutilizedSlots > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400'}`}>
                                  {u.unutilizedSlots}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-black">
                            <td className="p-8 text-lg uppercase tracking-widest rounded-bl-3xl">TOTAL</td>
                            <td className="p-8 text-center text-lg">{utilizationTotals.totalTargetLUs}</td>
                            <td className="p-8 text-center text-lg">{utilizationTotals.availableSlots}</td>
                            <td className="p-8 text-center">
                                <span className="px-6 py-3 rounded-[1.5rem] text-xs font-black bg-white/20 border border-white/30 text-white">
                                  {utilizationTotals.utilizedSlots}
                                </span>
                            </td>
                            <td className="p-8 text-center rounded-br-3xl">
                                <span className="px-6 py-3 rounded-[1.5rem] text-xs font-black bg-white/20 border border-white/30 text-white">
                                  {utilizationTotals.unutilizedSlots}
                                </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {phasingStats.length > 0 && (
                    <div className="bg-white rounded-[4rem] shadow-xl border border-slate-200 overflow-hidden">
                      <div className="p-12">
                        <h3 className="text-2xl font-black mb-8 flex items-center gap-4"><Target className="text-indigo-600"/> Phase Milestone Tracking</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-8 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tl-3xl">Subject Entity</th>
                                {config.cas.map((ca, i) => (
                                  <React.Fragment key={ca.id}>
                                    <th className="p-8 text-center text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-l border-slate-200/50">Target till Mod {i+1}</th>
                                    <th className={`p-8 text-center text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] border-l border-slate-200/50 ${i === config.cas.length - 1 ? 'rounded-tr-3xl' : ''}`}>Actual before {ca.label}</th>
                                  </React.Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {phasingStats.map(subjectStat => (
                                <tr key={subjectStat.subjectName} className="hover:bg-slate-50 transition-all">
                                  <td className="p-8"><span className="font-black text-slate-900 text-lg tracking-tight">{subjectStat.subjectName}</span></td>
                                  {subjectStat.phases.map((phase, i) => (
                                    <React.Fragment key={i}>
                                      <td className="p-8 text-center border-l border-slate-100/50"><div className="bg-indigo-50 text-indigo-700 font-black px-4 py-2.5 rounded-2xl text-[11px] shadow-inner">{phase.modulePlanned} LUs</div></td>
                                      <td className="p-8 text-center border-l border-slate-100/50">
                                        <div className={`font-black px-4 py-2.5 rounded-2xl text-[11px] shadow-md border ${Number(phase.modulePlanned) > 0 && phase.completedBeforeCA >= Number(phase.modulePlanned) ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                          {phase.completedBeforeCA} LUs
                                        </div>
                                      </td>
                                    </React.Fragment>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        )}
      </main>
      <footer className="no-print mt-20 py-20 border-t border-slate-200 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.8em] bg-white">SemesterFlow Engine &bull; Academic Architecture &bull; 2025</footer>
    </div>
  );
};

export default App;