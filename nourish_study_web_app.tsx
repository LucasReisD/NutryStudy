import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  BookOpen,
  Calendar as CalendarIcon,
  History,
  Plus,
  Leaf,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2,
  FileText,
  PenTool,
  Search,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
} from 'lucide-react';

type Study = {
  id: string;
  subject: string;
  content: string;
  studyDate: string;
  rev24h: boolean;
  rev7d: boolean;
  rev30d: boolean;
  hasNotes: boolean;
  hasExercises: boolean;
  completed: boolean;
};

type StudyField = 'rev24h' | 'rev7d' | 'rev30d' | 'hasNotes' | 'hasExercises';
type TabKey = 'home' | 'studies' | 'calendar' | 'history';

type NewStudyForm = {
  subject: string;
  content: string;
  studyDate: string;
  hasNotes: boolean;
  hasExercises: boolean;
};

const STORAGE_KEY = 'nourish_studies_v1';

const INITIAL_STUDIES: Study[] = [
  {
    id: '1',
    subject: 'Nutrição Esportiva',
    content: 'Suplementação de Creatina e Beta-Alanina no Alto Rendimento',
    studyDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    rev24h: true,
    rev7d: false,
    rev30d: false,
    hasNotes: true,
    hasExercises: true,
    completed: false,
  },
  {
    id: '2',
    subject: 'Bioquímica Humana',
    content: 'Metabolismo dos Lipídios, Beta-Oxidação e Lipogênese',
    studyDate: new Date().toISOString().split('T')[0],
    rev24h: false,
    rev7d: false,
    rev30d: false,
    hasNotes: true,
    hasExercises: false,
    completed: false,
  },
  {
    id: '3',
    subject: 'Nutrição Clínica',
    content: 'Terapia Nutricional para Diabetes Mellitus Tipo 2',
    studyDate: new Date(Date.now() - 86400000 * 35).toISOString().split('T')[0],
    rev24h: true,
    rev7d: true,
    rev30d: true,
    hasNotes: true,
    hasExercises: true,
    completed: true,
  },
];

const addDays = (dateStr: string, days: number) => {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

const isPast = (dateStr: string) => {
  if (!dateStr) return false;
  return dateStr < getTodayStr();
};

const isToday = (dateStr: string) => {
  if (!dateStr) return false;
  return dateStr === getTodayStr();
};

const getRevisionDates = (studyDate: string) => ({
  d24h: addDays(studyDate, 1),
  d7d: addDays(studyDate, 7),
  d30d: addDays(studyDate, 30),
});

const getCompletionStatus = (study: Study) =>
  study.rev24h && study.rev7d && study.rev30d;

export default function App() {
  const toastTimerRef = useRef<number | null>(null);

  const [studies, setStudies] = useState<Study[]>(() => {
    if (typeof window === 'undefined') return INITIAL_STUDIES;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Study[]) : INITIAL_STUDIES;
    } catch (error) {
      console.error('Failed to load local storage', error);
      return INITIAL_STUDIES;
    }
  });

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newStudy, setNewStudy] = useState<NewStudyForm>({
    subject: '',
    content: '',
    studyDate: getTodayStr(),
    hasNotes: false,
    hasExercises: false,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
    } catch (error) {
      console.error('Failed to save to local storage', error);
    }
  }, [studies]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddStudy = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = newStudy.subject.trim();
    const content = newStudy.content.trim();

    if (!subject || !content) return;

    const item: Study = {
      id: Date.now().toString(),
      subject,
      content,
      studyDate: newStudy.studyDate,
      rev24h: false,
      rev7d: false,
      rev30d: false,
      hasNotes: newStudy.hasNotes,
      hasExercises: newStudy.hasExercises,
      completed: false,
    };

    setStudies((previous) => [item, ...previous]);
    setNewStudy({
      subject: '',
      content: '',
      studyDate: getTodayStr(),
      hasNotes: false,
      hasExercises: false,
    });
    setIsModalOpen(false);
    showToast('Novo estudo adicionado com sucesso! ✨');
  };

  const toggleCheck = (id: string, field: StudyField) => {
    setStudies((previous) => {
      let shouldCelebrate = false;

      const nextStudies = previous.map((study) => {
        if (study.id !== id) return study;

        const nextValue = !study[field];
        const updated: Study = { ...study, [field]: nextValue } as Study;

        if (field === 'rev24h' || field === 'rev7d' || field === 'rev30d') {
          const nextCompleted = getCompletionStatus(updated);
          updated.completed = nextCompleted;
          shouldCelebrate = nextCompleted && !study.completed;
        }

        return updated;
      });

      if (shouldCelebrate) {
        showToast('Parabéns! Tópico concluído e movido para o histórico 🎉');
      }

      return nextStudies;
    });
  };

  const restoreStudy = (id: string) => {
    setStudies((previous) =>
      previous.map((study) =>
        study.id === id
          ? { ...study, completed: false, rev24h: false, rev7d: false, rev30d: false }
          : study,
      ),
    );
    showToast('Estudo restaurado para a lista ativa.');
  };

  const deleteStudy = (id: string) => {
    setStudies((previous) => previous.filter((study) => study.id !== id));
    showToast('Registro excluído.');
  };

  const exportData = () => {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(studies, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nourish_study_backup_${getTodayStr()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.readAsText(file, 'UTF-8');
    fileReader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result ?? '[]'));
        if (Array.isArray(parsed)) {
          setStudies(parsed as Study[]);
          showToast('Backup importado com sucesso!');
        }
      } catch (_error) {
        showToast('Arquivo JSON inválido.');
      }
    };
  };

  const activeStudies = useMemo(() => studies.filter((study) => !study.completed), [studies]);
  const completedStudies = useMemo(() => studies.filter((study) => study.completed), [studies]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set(studies.map((study) => study.subject));
    return Array.from(set);
  }, [studies]);

  const pendingToday = useMemo(
    () =>
      activeStudies.filter((study) => {
        const dates = getRevisionDates(study.studyDate);
        return (
          (!study.rev24h && isToday(dates.d24h)) ||
          (study.rev24h && !study.rev7d && isToday(dates.d7d)) ||
          (study.rev24h && study.rev7d && !study.rev30d && isToday(dates.d30d))
        );
      }),
    [activeStudies],
  );

  const overdue = useMemo(
    () =>
      activeStudies.filter((study) => {
        const dates = getRevisionDates(study.studyDate);
        return (
          (!study.rev24h && isPast(dates.d24h)) ||
          (study.rev24h && !study.rev7d && isPast(dates.d7d)) ||
          (study.rev24h && study.rev7d && !study.rev30d && isPast(dates.d30d))
        );
      }),
    [activeStudies],
  );

  const visibleActiveStudies = useMemo(
    () =>
      activeStudies.filter(
        (study) =>
          (selectedSubjectFilter === 'ALL' || study.subject === selectedSubjectFilter) &&
          (study.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            study.subject.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [activeStudies, searchQuery, selectedSubjectFilter],
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D3436] font-sans pb-28 md:pb-16 flex flex-col justify-between selection:bg-[#EBF0EA] selection:text-[#8A9A86]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#2D3436] text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-[#8A9A86]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="max-w-md w-full mx-auto px-6 pt-8 pb-4 flex justify-between items-center">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-[#8A9A86] font-semibold flex items-center gap-1">
            <Leaf size={13} /> Digital Planner
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#2D3436] mt-0.5 tracking-tight">Nourish Study</h1>
        </div>
        <div className="flex items-center gap-2">
          <label
            className="p-2 rounded-full bg-white border border-[#F0EAE1] text-[#8C9294] hover:text-[#8A9A86] cursor-pointer shadow-sm transition-all"
            title="Importar Backup"
          >
            <Upload size={16} />
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          <button
            onClick={exportData}
            className="p-2 rounded-full bg-white border border-[#F0EAE1] text-[#8C9294] hover:text-[#8A9A86] shadow-sm transition-all"
            title="Exportar Backup"
          >
            <Download size={16} />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#F9ECEC] border border-[#DCAEAE] flex items-center justify-center text-[#DCAEAE] font-serif font-bold text-sm shadow-sm ml-1">
            L
          </div>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto px-6 space-y-6 flex-grow">
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn">
            <section className="bg-white p-5 rounded-3xl border border-[#F0EAE1] shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10 text-[#8A9A86] pointer-events-none">
                <Leaf size={130} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8C9294] mb-2">
                <CalendarIcon size={14} className="text-[#8A9A86]" />
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <h2 className="text-lg font-serif font-semibold text-[#2D3436]">Olá, Lívia! ✨</h2>
              <p className="text-xs text-[#8C9294] mt-1 italic font-serif leading-relaxed">
                "O conhecimento nutre a mente assim como o alimento nutre o corpo."
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="bg-[#EBF0EA]/60 p-4 rounded-2xl border border-[#8A9A86]/20 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[#8A9A86]">
                  <Clock size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Revisões Hoje</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-serif font-bold text-[#2D3436]">{pendingToday.length}</span>
                  <p className="text-[11px] text-[#8C9294]">tarefas para realizar</p>
                </div>
              </div>

              <div className="bg-[#F9ECEC]/60 p-4 rounded-2xl border border-[#DCAEAE]/20 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[#DCAEAE]">
                  <AlertCircle size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Atrasadas</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-serif font-bold text-[#2D3436]">{overdue.length}</span>
                  <p className="text-[11px] text-[#8C9294]">requerem atenção</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold tracking-wide text-[#2D3436] uppercase flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#8A9A86]" /> Revisões Prioritárias
                </h3>
                <span className="text-[11px] text-[#8C9294]">{[...overdue, ...pendingToday].length} pendentes</span>
              </div>

              {pendingToday.length === 0 && overdue.length === 0 ? (
                <div className="bg-white p-7 rounded-2xl border border-[#F0EAE1] text-center space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-[#8A9A86] opacity-80" />
                  <p className="text-xs text-[#8C9294] font-serif italic">
                    Todas as revisões em dia! Aproveite seu descanso ou adicione novos temas.
                  </p>
                </div>
              ) : (
                [...overdue, ...pendingToday].map((item) => (
                  <StudyCard key={item.id} item={item} toggleCheck={toggleCheck} deleteStudy={deleteStudy} />
                ))
              )}
            </section>
          </div>
        )}

        {activeTab === 'studies' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-2">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-[#8C9294]" />
                <input
                  type="text"
                  placeholder="Buscar conteúdo ou matéria..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-white border border-[#F0EAE1] rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-[#8A9A86] transition-all shadow-sm"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedSubjectFilter('ALL')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-all ${
                    selectedSubjectFilter === 'ALL'
                      ? 'bg-[#8A9A86] text-white border-[#8A9A86]'
                      : 'bg-white text-[#8C9294] border-[#F0EAE1]'
                  }`}
                >
                  Todas ({activeStudies.length})
                </button>
                {uniqueSubjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => setSelectedSubjectFilter(subject)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-all ${
                      selectedSubjectFilter === subject
                        ? 'bg-[#8A9A86] text-white border-[#8A9A86]'
                        : 'bg-white text-[#8C9294] border-[#F0EAE1]'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {visibleActiveStudies.map((item) => (
                <StudyCard key={item.id} item={item} toggleCheck={toggleCheck} deleteStudy={deleteStudy} />
              ))}

              {visibleActiveStudies.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-[#F0EAE1] text-center space-y-2">
                  <BookOpen size={36} className="mx-auto text-[#E8D8C8]" />
                  <p className="text-sm font-serif text-[#2D3436]">Nenhum estudo ativo</p>
                  <p className="text-xs text-[#8C9294]">Toque no botão "+" abaixo para cadastrar um estudo.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold tracking-wide text-[#2D3436] uppercase flex items-center gap-1.5">
                <CalendarIcon size={14} className="text-[#8A9A86]" /> Cronograma Futuro
              </h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#F0EAE1] space-y-4 shadow-sm">
              {activeStudies.length === 0 ? (
                <p className="text-xs text-[#8C9294] text-center py-4">Sem revisões ativas programadas no momento.</p>
              ) : (
                activeStudies.map((item) => {
                  const dates = getRevisionDates(item.studyDate);

                  return (
                    <div key={item.id} className="border-b border-[#F0EAE1] pb-3.5 last:border-0 last:pb-0 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-wider font-semibold bg-[#E8D8C8]/30 px-2 py-0.5 rounded-full text-[#2D3436]">
                          {item.subject}
                        </span>
                        <span className="text-[10px] text-[#8C9294]">Início: {formatDateBR(item.studyDate)}</span>
                      </div>
                      <h4 className="text-xs font-serif font-medium text-[#2D3436] leading-snug">{item.content}</h4>

                      <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                        <div className={`p-2 rounded-xl text-center border ${item.rev24h ? 'bg-[#EBF0EA]/60 border-[#8A9A86]/30 text-[#8A9A86]' : 'bg-[#FAF8F5] border-[#F0EAE1]'}`}>
                          <span className="block font-semibold">24 horas</span>
                          <span className="text-[9px] text-[#8C9294]">{formatDateBR(dates.d24h)}</span>
                          <span className="block text-[8px] mt-0.5">
                            {item.rev24h ? '✓ Concluída' : isPast(dates.d24h) ? '⚠️ Atrasada' : 'Pendente'}
                          </span>
                        </div>
                        <div className={`p-2 rounded-xl text-center border ${item.rev7d ? 'bg-[#EBF0EA]/60 border-[#8A9A86]/30 text-[#8A9A86]' : 'bg-[#FAF8F5] border-[#F0EAE1]'}`}>
                          <span className="block font-semibold">7 dias</span>
                          <span className="text-[9px] text-[#8C9294]">{formatDateBR(dates.d7d)}</span>
                          <span className="block text-[8px] mt-0.5">
                            {item.rev7d ? '✓ Concluída' : isPast(dates.d7d) ? '⚠️ Atrasada' : 'Pendente'}
                          </span>
                        </div>
                        <div className={`p-2 rounded-xl text-center border ${item.rev30d ? 'bg-[#EBF0EA]/60 border-[#8A9A86]/30 text-[#8A9A86]' : 'bg-[#FAF8F5] border-[#F0EAE1]'}`}>
                          <span className="block font-semibold">30 dias</span>
                          <span className="text-[9px] text-[#8C9294]">{formatDateBR(dates.d30d)}</span>
                          <span className="block text-[8px] mt-0.5">
                            {item.rev30d ? '✓ Concluída' : isPast(dates.d30d) ? '⚠️ Atrasada' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold tracking-wide text-[#2D3436] uppercase flex items-center gap-1.5">
                <History size={14} className="text-[#8A9A86]" /> Estudos Concluídos
              </h3>
              <span className="text-xs text-[#8C9294]">{completedStudies.length} concluídos</span>
            </div>

            {completedStudies.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-[#F0EAE1] text-center space-y-2">
                <History size={36} className="mx-auto text-[#E8D8C8]" />
                <p className="text-sm font-serif text-[#2D3436]">Nenhum histórico ainda</p>
                <p className="text-xs text-[#8C9294]">Ao concluir todas as 3 revisões (24h, 7d, 30d), os tópicos virão para cá.</p>
              </div>
            ) : (
              completedStudies.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-[#F0EAE1] flex justify-between items-center shadow-sm">
                  <div>
                    <span className="text-[10px] font-semibold text-[#8A9A86] uppercase tracking-wider block">
                      {item.subject}
                    </span>
                    <h4 className="font-serif font-medium text-xs text-[#8C9294] line-through leading-snug">
                      {item.content}
                    </h4>
                    <span className="text-[10px] text-[#8C9294] block mt-0.5">Iniciado em {formatDateBR(item.studyDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => restoreStudy(item.id)}
                      className="p-2 text-[#8C9294] hover:text-[#8A9A86] transition-all rounded-full hover:bg-[#FAF8F5]"
                      title="Restaurar para estudos ativos"
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      onClick={() => deleteStudy(item.id)}
                      className="p-2 text-[#8C9294] hover:text-[#DCAEAE] transition-all rounded-full hover:bg-[#FAF8F5]"
                      title="Excluir do histórico"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-20 right-6 md:right-12 z-30">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-14 h-14 bg-[#8A9A86] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#8A9A86]/90 transition-all border-2 border-white active:scale-95"
          title="Adicionar Novo Estudo"
        >
          <Plus size={24} />
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#F0EAE1] z-40">
        <div className="max-w-md mx-auto flex justify-around py-3 px-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
              activeTab === 'home' ? 'text-[#8A9A86] font-bold scale-105' : 'text-[#8C9294]'
            }`}
          >
            <Home size={20} />
            Início
          </button>

          <button
            onClick={() => setActiveTab('studies')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
              activeTab === 'studies' ? 'text-[#8A9A86] font-bold scale-105' : 'text-[#8C9294]'
            }`}
          >
            <BookOpen size={20} />
            Estudos
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
              activeTab === 'calendar' ? 'text-[#8A9A86] font-bold scale-105' : 'text-[#8C9294]'
            }`}
          >
            <CalendarIcon size={20} />
            Calendário
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
              activeTab === 'history' ? 'text-[#8A9A86] font-bold scale-105' : 'text-[#8C9294]'
            }`}
          >
            <History size={20} />
            Histórico
          </button>
        </div>
      </nav>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5 border border-[#F0EAE1] shadow-xl">
            <div className="flex justify-between items-center border-b border-[#F0EAE1] pb-3">
              <h3 className="font-serif font-bold text-lg text-[#2D3436] flex items-center gap-2">
                <Leaf size={18} className="text-[#8A9A86]" /> Novo Estudo
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C9294] hover:text-[#2D3436] p-1 rounded-full hover:bg-[#FAF8F5]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStudy} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#8C9294] uppercase tracking-wider mb-1">
                  Matéria / Disciplina
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nutrição Clínica, Bioquímica"
                  value={newStudy.subject}
                  onChange={(event) => setNewStudy({ ...newStudy, subject: event.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#F0EAE1] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#8A9A86]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8C9294] uppercase tracking-wider mb-1">
                  Conteúdo Estudado
                </label>
                <textarea
                  placeholder="Ex: Terapia Nutricional para Diabetes Mellitus"
                  value={newStudy.content}
                  onChange={(event) => setNewStudy({ ...newStudy, content: event.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#F0EAE1] rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#8A9A86] min-h-[70px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8C9294] uppercase tracking-wider mb-1">
                  Data do Estudo
                </label>
                <input
                  type="date"
                  value={newStudy.studyDate}
                  onChange={(event) => setNewStudy({ ...newStudy, studyDate: event.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#F0EAE1] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#8A9A86]"
                  required
                />
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#8C9294] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStudy.hasNotes}
                    onChange={(event) => setNewStudy({ ...newStudy, hasNotes: event.target.checked })}
                    className="accent-[#8A9A86] rounded"
                  />
                  Anotações feitas
                </label>
                <label className="flex items-center gap-2 text-xs text-[#8C9294] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStudy.hasExercises}
                    onChange={(event) => setNewStudy({ ...newStudy, hasExercises: event.target.checked })}
                    className="accent-[#8A9A86] rounded"
                  />
                  Questões resolvidas
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-[#8A9A86] text-white font-medium py-3 rounded-xl shadow-sm hover:bg-[#8A9A86]/90 transition-all text-xs tracking-wider uppercase mt-2"
              >
                Salvar e Agendar Revisões
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudyCard({
  item,
  toggleCheck,
  deleteStudy,
}: {
  item: Study;
  toggleCheck: (id: string, field: StudyField) => void;
  deleteStudy: (id: string) => void;
}) {
  const dates = getRevisionDates(item.studyDate);

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#F0EAE1] shadow-sm space-y-4 relative transition-all hover:border-[#8A9A86]/40">
      <div className="flex justify-between items-start">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[#E8D8C8]/30 text-[#2D3436] mb-1.5">
            {item.subject}
          </span>
          <h4 className="font-serif font-medium text-[#2D3436] text-sm leading-snug">{item.content}</h4>
          <p className="text-[11px] text-[#8C9294] mt-1">Estudado em: {formatDateBR(item.studyDate)}</p>
        </div>
        <button
          onClick={() => deleteStudy(item.id)}
          className="text-[#8C9294]/50 hover:text-[#DCAEAE] transition-all p-1 rounded-full hover:bg-[#FAF8F5]"
          title="Excluir registro"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex gap-2 text-[11px]">
        <button
          onClick={() => toggleCheck(item.id, 'hasNotes')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
            item.hasNotes
              ? 'bg-[#EBF0EA] border-[#8A9A86]/40 text-[#8A9A86] font-medium'
              : 'border-[#F0EAE1] text-[#8C9294]'
          }`}
        >
          <FileText size={12} />
          {item.hasNotes ? 'Anotações ✓' : 'Anotações'}
        </button>

        <button
          onClick={() => toggleCheck(item.id, 'hasExercises')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
            item.hasExercises
              ? 'bg-[#EBF0EA] border-[#8A9A86]/40 text-[#8A9A86] font-medium'
              : 'border-[#F0EAE1] text-[#8C9294]'
          }`}
        >
          <PenTool size={12} />
          {item.hasExercises ? 'Questões ✓' : 'Questões'}
        </button>
      </div>

      <div className="pt-3 border-t border-[#F0EAE1]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C9294] block mb-2">
          Ciclo de Revisões
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => toggleCheck(item.id, 'rev24h')}
            className={`py-2 px-1 rounded-xl text-xs font-medium border flex flex-col items-center justify-center transition-all ${
              item.rev24h
                ? 'bg-[#8A9A86] text-white border-[#8A9A86]'
                : isPast(dates.d24h)
                  ? 'bg-[#F9ECEC] border-[#DCAEAE] text-[#DCAEAE]'
                  : 'bg-[#FAF8F5] text-[#8C9294] border-[#F0EAE1]'
            }`}
          >
            <span className="font-semibold">24 horas</span>
            <span className="text-[9px] opacity-80">{formatDateBR(dates.d24h)}</span>
          </button>

          <button
            onClick={() => toggleCheck(item.id, 'rev7d')}
            className={`py-2 px-1 rounded-xl text-xs font-medium border flex flex-col items-center justify-center transition-all ${
              item.rev7d
                ? 'bg-[#8A9A86] text-white border-[#8A9A86]'
                : item.rev24h && isPast(dates.d7d)
                  ? 'bg-[#F9ECEC] border-[#DCAEAE] text-[#DCAEAE]'
                  : 'bg-[#FAF8F5] text-[#8C9294] border-[#F0EAE1]'
            }`}
          >
            <span className="font-semibold">7 dias</span>
            <span className="text-[9px] opacity-80">{formatDateBR(dates.d7d)}</span>
          </button>

          <button
            onClick={() => toggleCheck(item.id, 'rev30d')}
            className={`py-2 px-1 rounded-xl text-xs font-medium border flex flex-col items-center justify-center transition-all ${
              item.rev30d
                ? 'bg-[#8A9A86] text-white border-[#8A9A86]'
                : item.rev7d && isPast(dates.d30d)
                  ? 'bg-[#F9ECEC] border-[#DCAEAE] text-[#DCAEAE]'
                  : 'bg-[#FAF8F5] text-[#8C9294] border-[#F0EAE1]'
            }`}
          >
            <span className="font-semibold">30 dias</span>
            <span className="text-[9px] opacity-80">{formatDateBR(dates.d30d)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}