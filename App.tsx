
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
  CalendarCheck
} from 'lucide-react';
import { SemesterConfig, Subject, SlotDefinition, Holiday, CAConfig, ScheduleRow, ModuleConfig } from './types';
import { DAYS_OF_WEEK, COURSE_COLORS } from './constants';
import { generateMasterSchedule, downloadExcelTemplate, parseExcelImport, exportToExcel, calculateSemesterStats, calculateProgramStats, calculateUtilizationStats } from './utils/dateUtils';

const App: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); 
  const [loading, setLoading] = useState(false);
  const [editingSubjectModules, setEditingSubjectModules] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'detailed' | 'stats'>('detailed');

  const [config, setConfig] = useState<SemesterConfig>({
    name: 'Academic Phased Plan',
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
        alert("Success: Integrated Phased Plan and Learning Units.");
      } catch (err) {
        console.error(err);
        alert("Error: Invalid file format.");
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    }, 100);
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
        modules: []
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
    { label: "Basics", icon: <Settings size={14}/> },
    { label: "Cycle Layout", icon: <RefreshCw size={14}/> },
    { label: "Resources", icon: <Layers size={14}/> },
    { label: "Structure", icon: <FileText size={14}/> },
    { label: "Master Table", icon: <CalendarDays size={14}/> },
  ];

  const currentEditingSubject = config.subjects.find(s => s.id === editingSubjectModules);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="font-black text-slate-800 tracking-tight">Syncing Educational Modules...</p>
          </div>
        </div>
      )}

      {/* Module Editor Modal */}
      {editingSubjectModules && currentEditingSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
               <div>
                 <h3 className="text-xl font-black">Modules: {currentEditingSubject.name}</h3>
                 <p className="text-slate-400 text-xs mt-1">Define learning unit ranges for color highlighting</p>
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
               <button onClick={() => setEditingSubjectModules(null)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl transition active:scale-95">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <nav className="no-print bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
            <CalendarDays size={22} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter leading-none">SemesterFlow</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Learning-Unit Phased Engine</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          {stepsInfo.map((s, i) => (
            <React.Fragment key={i}>
              <button onClick={() => setStep((i + 1) as any)} className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold transition-all ${step === i + 1 ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}>
                {s.icon} {s.label}
              </button>
              {i < stepsInfo.length - 1 && <ChevronRight size={12} className="text-slate-200" />}
            </React.Fragment>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><Settings className="text-indigo-500" /> General Config</h2>
                <div className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Semester Name</label>
                    <input value={config.name} onChange={e => setConfig({...config, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl font-black text-xl outline-none" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Global Start Date</label>
                      <input type="date" value={config.startDate} onChange={e => setConfig({...config, startDate: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">End Date</label>
                      <input type="date" value={config.endDate} onChange={e => setConfig({...config, endDate: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Active Working Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button key={day} onClick={() => setConfig({ ...config, workingDays: config.workingDays.includes(day as any) ? config.workingDays.filter(d => d !== day) : [...config.workingDays, day as any] })} className={`px-5 py-3 rounded-2xl text-xs font-bold border transition-all ${config.workingDays.includes(day as any) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500'}`}>{day}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl">Plan Phase Cycles <ArrowRight size={20} /></button>
            </div>
            <div className="space-y-6">
              <div className="bg-indigo-900 rounded-[3rem] p-10 text-white shadow-2xl">
                <h3 className="text-xl font-black mb-4 flex items-center gap-3"><Layers className="text-emerald-400" /> Smart Phase Import</h3>
                <p className="text-indigo-200 text-sm mb-8 leading-relaxed">System now supports Learning Unit (LU) sequential tracking and Module color highlighting from Excel.</p>
                <div className="space-y-4">
                  <button onClick={downloadExcelTemplate} className="w-full py-4 bg-indigo-800 hover:bg-indigo-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all"><Download size={16} /> Download Template</button>
                  <label className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"><Upload size={16} /> Upload Filled File<input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} /></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-10 pb-8 border-b border-slate-100">
              <div><h2 className="text-3xl font-black text-slate-800 tracking-tighter">Phase Cycles</h2><p className="text-slate-400 text-sm mt-1 font-medium">CAs anchor to working day endings automatically.</p></div>
              <button onClick={addCA} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl text-sm font-black flex items-center gap-2 shadow-xl shadow-indigo-100 transition-all active:scale-95"><Plus size={20} /> Add Next Phase</button>
            </div>
            <div className="space-y-8">
              {config.cas.map((ca, idx) => (
                <div key={ca.id} className="p-8 bg-slate-50/50 rounded-[3rem] border border-slate-100 relative group hover:bg-white hover:shadow-2xl transition-all duration-700">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-xl ring-4 ring-white">{idx + 1}</div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end ml-6">
                    <div className="md:col-span-4"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Phase Title</label><input value={ca.label} onChange={e => { const newCas = [...config.cas]; newCas[idx].label = e.target.value; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black shadow-sm" /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Week Order</label><input type="number" min="1" value={ca.weekOrder} onChange={e => { const newCas = [...config.cas]; newCas[idx].weekOrder = parseInt(e.target.value) || 1; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">CA Days</label><input type="number" min="1" max="7" value={ca.duration} onChange={e => { const newCas = [...config.cas]; newCas[idx].duration = parseInt(e.target.value) || 1; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Event Days</label><input type="number" min="0" max="7" value={ca.eventDays} onChange={e => { const newCas = [...config.cas]; newCas[idx].eventDays = parseInt(e.target.value) || 0; setConfig({...config, cas: newCas}); }} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-sm" /></div>
                    <div className="md:col-span-2 flex justify-end"><button onClick={() => setConfig({...config, cas: config.cas.filter(c => c.id !== ca.id)})} className="p-4 text-rose-400 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={24} /></button></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 pt-10 border-t flex justify-between items-center"><button onClick={() => setStep(1)} className="px-8 py-4 rounded-2xl font-bold flex items-center gap-2 text-slate-400 hover:bg-slate-50 transition"><ChevronLeft size={20} /> Back</button><button onClick={() => setStep(3)} className="px-12 py-5 bg-indigo-600 text-white rounded-[2.5rem] font-black flex items-center gap-3 hover:bg-indigo-700 transition shadow-2xl">Resource Setup <ChevronRight size={20} /></button></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
               <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><BookOpen className="text-indigo-500" /> Subject & LU Management</h2>
               <div className="flex gap-4 mb-8">
                 <input id="sub-input" placeholder="Enter Subject..." className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl font-bold outline-none shadow-inner" onKeyDown={e => { if (e.key === 'Enter') { addSubject(e.currentTarget.value); e.currentTarget.value = ''; } }} />
                 <button onClick={() => { const el = document.getElementById('sub-input') as HTMLInputElement; addSubject(el.value); el.value = ''; }} className="bg-indigo-600 text-white px-7 py-4 rounded-3xl shadow-xl shadow-indigo-100"><Plus /></button>
               </div>
               <div className="space-y-4">
                 {config.subjects.map(s => (
                   <div key={s.id} className="flex flex-col p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4"><div className="w-5 h-5 rounded-full shadow-sm" style={{backgroundColor: s.color}}></div><span className="font-black text-slate-700 text-lg tracking-tight">{s.name}</span></div>
                        <button onClick={() => setConfig({...config, subjects: config.subjects.filter(sub => sub.id !== s.id)})} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={18} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total LUs (0 = No Tracking)</label>
                          <input type="number" min="0" value={s.totalLUs} onChange={e => updateSubjectLUs(s.id, parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Module Highlighting</label>
                          <button 
                            onClick={() => setEditingSubjectModules(s.id)} 
                            disabled={s.totalLUs <= 0}
                            className={`w-full py-2 text-[10px] font-black uppercase rounded-xl border transition ${s.totalLUs <= 0 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}`}
                          >
                            Manage Modules ({s.modules.length})
                          </button>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
               <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><Clock className="text-indigo-500" /> Period Definition</h2>
               <div className="space-y-4">
                 {config.slots.map((slot, idx) => (
                   <div key={slot.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-50/50 rounded-3xl">
                     <input value={slot.label} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].label = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black" />
                     <input type="time" value={slot.startTime} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].startTime = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold" />
                     <input type="time" value={slot.endTime} onChange={e => { const newSlots = [...config.slots]; newSlots[idx].endTime = e.target.value; setConfig({...config, slots: newSlots}); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold" />
                   </div>
                 ))}
                 <button onClick={() => setConfig({...config, slots: [...config.slots, { id: `s${Date.now()}`, label: `Slot ${config.slots.length+1}`, startTime: '09:00', endTime: '10:30' }]})} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 text-xs font-black hover:bg-slate-50 transition">+ Add Period</button>
               </div>
               <div className="mt-10 pt-10 border-t"><button onClick={() => setStep(4)} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl">Establish Daily Mapping</button></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-200 overflow-x-auto">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3 tracking-tighter"><Calendar className="text-indigo-500" /> Instructional Blueprint</h2>
              <table className="w-full border-collapse">
                <thead><tr><th className="p-5 border-b text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-tl-[2rem]">Time Period</th>{DAYS_OF_WEEK.map((day, i) => <th key={day} className={`p-5 border-b text-center text-[10px] font-black uppercase tracking-widest bg-slate-50/50 ${i === 6 ? 'rounded-tr-[2rem]' : ''}`}>{day}</th>)}</tr></thead>
                <tbody>{config.slots.map(slot => (
                  <tr key={slot.id}>
                    <td className="p-5 border-b font-black text-slate-800 bg-slate-50/20"><div className="text-sm">{slot.label}</div><div className="text-[9px] text-slate-400 font-bold">{slot.startTime} - {slot.endTime}</div></td>
                    {DAYS_OF_WEEK.map(day => (
                      <td key={`${day}-${slot.id}`} className="p-3 border-b">
                        <select value={config.weeklyPattern[day]?.[slot.id] || ""} onChange={e => setConfig({ ...config, weeklyPattern: { ...config.weeklyPattern, [day]: { ...(config.weeklyPattern[day] || {}), [slot.id]: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 text-[10px] font-black focus:ring-4 focus:ring-indigo-50">
                          <option value="">- Empty -</option>{config.subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex justify-center"><button onClick={() => setStep(5)} className="px-20 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black shadow-2xl hover:bg-indigo-600 transition-all">Generate Master Plan <CheckCircle2 size={24} className="ml-2"/></button></div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-1000">
             <div className="no-print flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200 gap-10">
                <div className="flex-1">
                   <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{config.name}</h2>
                   <div className="flex flex-wrap items-center gap-10 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-5">
                     <span className="flex items-center gap-3 px-5 py-2.5 bg-indigo-50 rounded-full text-indigo-700 border border-indigo-100 shadow-sm font-bold"><RefreshCw size={14}/> HYBRID LU TRACKER ACTIVE</span>
                     <span className="flex items-center gap-3 px-5 py-2.5 bg-slate-100 rounded-full text-slate-600"><Calendar size={14}/> {config.startDate} / {config.endDate}</span>
                   </div>
                </div>
                <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-3xl border border-slate-200">
                  <button onClick={() => setViewMode('detailed')} className={`px-6 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'detailed' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><List size={16}/> Detailed Plan</button>
                  <button onClick={() => setViewMode('stats')} className={`px-6 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'stats' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 size={16}/> Statistics</button>
                </div>
                <button onClick={() => exportToExcel(masterSchedule, config.slots, config)} className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black flex items-center gap-3 shadow-2xl hover:bg-indigo-600 transition-all"><Download size={20} /> Download Excel Report</button>
             </div>

             {viewMode === 'detailed' ? (
               <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[80vh] overflow-y-auto print:max-h-none">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-2xl">
                        <tr className="border-b border-slate-200">
                          <th className="p-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[120px]">Phase Wk/D</th>
                          <th className="p-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[150px]">Date/Day</th>
                          <th className="p-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] min-w-[180px]">Status</th>
                          {config.slots.map(slot => (<th key={slot.id} className="p-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-l border-slate-200/50">{slot.label}<div className="font-bold opacity-30 mt-1">{slot.startTime}</div></th>))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {masterSchedule.map((row, idx) => {
                          const isNewPhase = row.weekNumber === 1 && row.dayInWeek === 1 && idx > 0;
                          return (
                            <React.Fragment key={row.date}>
                              {isNewPhase && (<tr className="bg-slate-900 group"><td colSpan={3 + config.slots.length} className="p-3 text-center text-[9px] font-black text-indigo-300 uppercase tracking-[0.8em] animate-pulse">New Phase Anchor Reset</td></tr>)}
                              <tr className={`group transition-all ${row.status === 'ca' ? 'bg-indigo-50/50' : row.status === 'event' ? 'bg-amber-50/50' : row.status === 'holiday' ? 'bg-rose-50/40' : 'hover:bg-slate-50/50'}`}>
                                <td className="p-6 align-top"><div className={`text-[10px] font-black text-center py-2.5 px-4 rounded-[1.2rem] border ${row.dayInWeek === 1 ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl' : 'text-slate-400 bg-white border-slate-100'}`}>W{row.weekNumber} D{row.dayInWeek}</div></td>
                                <td className="p-6 align-top"><div className="text-[10px] font-mono font-bold text-slate-400 mb-0.5">{row.date}</div><div className="text-xs font-black text-slate-800 tracking-tighter uppercase">{row.dayName}</div></td>
                                <td className="p-6 align-top">
                                  {row.status === 'ca' ? (<div className="flex items-center gap-2 text-indigo-700 font-black text-[9px] uppercase bg-indigo-100/80 px-4 py-2 rounded-2xl border border-indigo-200"><FileText size={16} /> {row.reason}</div>) 
                                  : row.status === 'event' ? (<div className="flex items-center gap-2 text-amber-700 font-black text-[9px] uppercase bg-amber-100/80 px-4 py-2 rounded-2xl border border-amber-200"><Sparkles size={16} /> {row.reason}</div>) 
                                  : row.status === 'holiday' ? (<div className="flex items-center gap-2 text-rose-600 font-black text-[9px] uppercase bg-rose-100/80 px-4 py-2 rounded-2xl border border-rose-200"><AlertCircle size={16} /> {row.reason}</div>) 
                                  : row.status === 'weekend' ? (<div className="flex items-center gap-2 text-slate-300 font-black text-[9px] uppercase tracking-[0.2em] bg-slate-100/50 px-3 py-1 rounded-xl">Weekend</div>) 
                                  : (<div className="flex items-center gap-2 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Working</div>)}
                                </td>
                                {config.slots.map(slot => {
                                  const mapping = row.slotMappings[slot.id];
                                  return (
                                    <td key={slot.id} className="p-4 border-l border-slate-100/50 align-top">
                                      {mapping.type === 'subject' ? (
                                        <div className="p-5 rounded-[2rem] text-[9px] font-black shadow-sm border text-center transition-all group-hover:scale-[1.05]" style={{ backgroundColor: `${mapping.color}15`, borderColor: `${mapping.color}40`, color: mapping.color }}>
                                          {mapping.label}
                                        </div>
                                      ) : mapping.type === 'ca' ? (<div className="p-5 rounded-[2rem] bg-indigo-600 text-white text-[10px] font-black text-center shadow-xl animate-pulse">ASSESSMENT</div>) 
                                      : mapping.type === 'event' ? (<div className="p-5 rounded-[2rem] bg-amber-500 text-white text-[10px] font-black text-center shadow-xl">EVENT</div>) 
                                      : (<div className="h-14 rounded-[2rem] bg-slate-50/50 border border-dashed border-slate-200/40"></div>)}
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
             ) : (
               <div className="space-y-12 animate-in fade-in duration-500">
                  {/* Program Level Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                      { label: "Total Days", val: programStats.totalDays, icon: <Calendar size={18}/>, color: "slate" },
                      { label: "Sundays", val: programStats.sundays, icon: <CalendarCheck size={18}/>, color: "rose" },
                      { label: "Holidays", val: programStats.holidays, icon: <AlertCircle size={18}/>, color: "rose" },
                      { label: "Assessments", val: programStats.assessmentDays, icon: <FileText size={18}/>, color: "indigo" },
                      { label: "Events", val: programStats.eventDays, icon: <Sparkles size={18}/>, color: "amber" },
                      { label: "Working Days", val: programStats.workingDays, icon: <Activity size={18}/>, color: "emerald" },
                      { label: "Learning Days", val: programStats.learningDays, icon: <Target size={18}/>, color: "indigo" },
                    ].map((st, i) => (
                      <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                        <div className={`p-3 rounded-2xl mb-3 text-${st.color}-600 bg-${st.color}-50`}>{st.icon}</div>
                        <div className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{st.val}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{st.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Slot Utilization Table (All Subjects) */}
                  <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
                    <div className="p-10">
                      <h3 className="text-xl font-black mb-6 flex items-center gap-3"><Activity className="text-emerald-500"/> Subject Slot Utilization</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tl-2xl">Subject Name</th>
                            <th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Available Slots</th>
                            <th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Utilized Slots</th>
                            <th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tr-2xl">Unutilized Slots</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {utilizationStats.map(u => (
                            <tr key={u.subjectName} className="hover:bg-slate-50 transition-all">
                              <td className="p-6 font-black text-slate-800">{u.subjectName}</td>
                              <td className="p-6 text-center text-sm font-bold text-slate-500">{u.availableSlots}</td>
                              <td className="p-6 text-center">
                                <span className={`px-4 py-2 rounded-xl text-xs font-black ${u.unutilizedSlots === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                  {u.utilizedSlots}
                                </span>
                              </td>
                              <td className="p-6 text-center">
                                <span className={`px-4 py-2 rounded-xl text-xs font-black ${u.unutilizedSlots > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                                  {u.unutilizedSlots}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Subject Phasing Table (Only Tracked Subjects) */}
                  {phasingStats.length > 0 && (
                    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
                      <div className="p-10">
                        <h3 className="text-xl font-black mb-6 flex items-center gap-3"><Target className="text-indigo-600"/> Subject Phasing Timeline</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest rounded-tl-2xl">Subject Name</th>
                                {config.cas.map((ca, i) => (
                                  <React.Fragment key={ca.id}>
                                    <th className="p-6 text-center text-[10px] font-black text-indigo-600 uppercase tracking-widest border-l border-slate-200/50">Planned till Mod {i+1}</th>
                                    <th className={`p-6 text-center text-[10px] font-black text-emerald-600 uppercase tracking-widest border-l border-slate-200/50 ${i === config.cas.length - 1 ? 'rounded-tr-2xl' : ''}`}>Completed before {ca.label}</th>
                                  </React.Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {phasingStats.map(subjectStat => (
                                <tr key={subjectStat.subjectName} className="hover:bg-slate-50 transition-all">
                                  <td className="p-6"><span className="font-black text-slate-800">{subjectStat.subjectName}</span></td>
                                  {subjectStat.phases.map((phase, i) => (
                                    <React.Fragment key={i}>
                                      <td className="p-6 text-center border-l border-slate-100"><div className="bg-indigo-50 text-indigo-700 font-bold px-3 py-2 rounded-xl text-xs">{phase.modulePlanned} LUs</div></td>
                                      <td className="p-6 text-center border-l border-slate-100">
                                        <div className={`font-bold px-3 py-2 rounded-xl text-xs ${Number(phase.modulePlanned) > 0 && phase.completedBeforeCA >= Number(phase.modulePlanned) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
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
      <footer className="no-print mt-20 py-20 border-t border-slate-200 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] bg-white">Academic Architecture &bull; SemesterFlow Engine &bull; 2025</footer>
    </div>
  );
};

export default App;
