import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

type Study = {
  id: string
  subject: string
  content: string
  studyDate: string
  rev24h: boolean
  rev7d: boolean
  rev30d: boolean
  hasNotes: boolean
  hasExercises: boolean
  completed: boolean
}

type StudyField = 'rev24h' | 'rev7d' | 'rev30d' | 'hasNotes' | 'hasExercises'
type TabKey = 'home' | 'studies' | 'calendar' | 'history'
type ToastKind = 'success' | 'error' | 'info'
type Toast = { message: string; kind: ToastKind }
type StudyForm = Pick<Study, 'subject' | 'content' | 'studyDate' | 'hasNotes' | 'hasExercises'>

const STORAGE_KEY = 'nourish_studies_v1'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const localDateString = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const makeSampleStudy = (id: string, subject: string, content: string, offset: number, values: Partial<Study> = {}): Study => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return {
    id,
    subject,
    content,
    studyDate: localDateString(date),
    rev24h: false,
    rev7d: false,
    rev30d: false,
    hasNotes: false,
    hasExercises: false,
    completed: false,
    ...values,
  }
}

const INITIAL_STUDIES: Study[] = [
  makeSampleStudy(
    '1',
    'Nutrição esportiva',
    'Suplementação de creatina e beta-alanina no alto rendimento',
    -2,
    { rev24h: true, hasNotes: true, hasExercises: true },
  ),
  makeSampleStudy(
    '2',
    'Bioquímica humana',
    'Metabolismo dos lipídios, beta-oxidação e lipogênese',
    0,
    { hasNotes: true },
  ),
  makeSampleStudy(
    '3',
    'Nutrição clínica',
    'Terapia nutricional para diabetes mellitus tipo 2',
    -35,
    { rev24h: true, rev7d: true, rev30d: true, hasNotes: true, hasExercises: true, completed: true },
  ),
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidDateString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

const isStudy = (value: unknown): value is Study => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.subject === 'string' &&
    value.subject.trim().length > 0 &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    isValidDateString(value.studyDate) &&
    typeof value.rev24h === 'boolean' &&
    typeof value.rev7d === 'boolean' &&
    typeof value.rev30d === 'boolean' &&
    typeof value.hasNotes === 'boolean' &&
    typeof value.hasExercises === 'boolean' &&
    typeof value.completed === 'boolean'
  )
}

const validateStudies = (value: unknown): Study[] => {
  if (!Array.isArray(value)) {
    throw new Error('O backup deve conter uma lista de estudos.')
  }

  const seenIds = new Set<string>()
  const validated: Study[] = []

  value.forEach((entry: unknown, index: number) => {
    if (!isStudy(entry)) {
      throw new Error(
        `O estudo ${index + 1} está incompleto ou contém dados inválidos. Verifique id, matéria, conteúdo, data e estados das revisões.`,
      )
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`O identificador "${entry.id}" aparece mais de uma vez no backup.`)
    }

    seenIds.add(entry.id)
    validated.push({
      ...entry,
      subject: entry.subject.trim(),
      content: entry.content.trim(),
      completed: entry.rev24h && entry.rev7d && entry.rev30d,
    })
  })

  return validated
}

const getInitialStudies = (): Study[] => {
  if (typeof window === 'undefined') return INITIAL_STUDIES

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? validateStudies(JSON.parse(saved) as unknown) : INITIAL_STUDIES
  } catch (error) {
    console.error('Não foi possível carregar os estudos salvos.', error)
    return INITIAL_STUDIES
  }
}

const addDays = (dateValue: unknown, days: number): string => {
  if (!isValidDateString(dateValue) || !Number.isInteger(days)) return ''
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

const formatDateBR = (dateValue: unknown): string => {
  if (!isValidDateString(dateValue)) return 'Data inválida'
  const [year, month, day] = dateValue.split('-')
  return `${day}/${month}/${year}`
}

const isPast = (dateValue: unknown): boolean =>
  isValidDateString(dateValue) && dateValue < localDateString()

const isToday = (dateValue: unknown): boolean =>
  isValidDateString(dateValue) && dateValue === localDateString()

const revisionDates = (studyDate: string) => ({
  d24h: addDays(studyDate, 1),
  d7d: addDays(studyDate, 7),
  d30d: addDays(studyDate, 30),
})

const freshForm = (): StudyForm => ({
  subject: '',
  content: '',
  studyDate: localDateString(),
  hasNotes: false,
  hasExercises: false,
})

const styles = `
  /* System fonts avoid a render-blocking external font request. */
  #root:has(.nourish-app) { width: 100%; max-width: none; min-height: 100vh; border: 0; text-align: left; }
  .nourish-app, .nourish-app * { box-sizing: border-box; }
  .nourish-app { --ink:#24332d; --muted:#78857d; --green:#52765e; --green-dark:#355b43; --green-soft:#eaf1e9; --paper:#f7f8f4; --line:#e5eae2; --rose:#a9504c; --rose-soft:#fbefed; min-height:100vh; background:var(--paper); color:var(--ink); font-family:'DM Sans',sans-serif; padding:32px 20px 112px; }
  .ns-shell { width:min(100%, 980px); margin:0 auto; }
  .ns-header { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:30px; }
  .ns-brand { display:flex; align-items:center; gap:13px; }
  .ns-mark { width:46px; height:46px; display:grid; place-items:center; border-radius:16px; color:var(--green-dark); background:#e4eee2; font-size:23px; }
  .ns-kicker { color:var(--green); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.16em; }
  .ns-title { color:var(--ink); font:600 24px/1.2 Georgia,serif; margin:2px 0 0; }
  .ns-actions { display:flex; gap:9px; align-items:center; }
  .ns-icon-button, .ns-button { border:1px solid var(--line); background:white; color:var(--ink); border-radius:12px; min-height:42px; padding:0 14px; font:600 13px 'DM Sans',sans-serif; cursor:pointer; transition:background .18s,border-color .18s,transform .18s; }
  .ns-icon-button:hover, .ns-button:hover { background:#f2f6f0; border-color:#cddbcc; }
  .ns-button:active, .ns-icon-button:active { transform:translateY(1px); }
  .ns-button-primary { background:var(--green); color:white; border-color:var(--green); }
  .ns-button-primary:hover { background:var(--green-dark); color:white; }
  .ns-button-danger { color:var(--rose); border-color:#efd5d1; }
  .ns-button-danger:hover { background:var(--rose-soft); }
  .ns-icon-button { width:42px; padding:0; font-size:18px; }
  .ns-file-label { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:7px; }
  .ns-file-label input { position:absolute; inset:0; opacity:0; cursor:pointer; }
  .ns-file-label:has(input:disabled) { opacity:.55; pointer-events:none; }
  .ns-intro { background:linear-gradient(125deg,#e7efe5,#f3f5ed); border:1px solid #dce7d9; border-radius:23px; padding:25px 28px; margin-bottom:20px; }
  .ns-date { color:var(--green); font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:capitalize; }
  .ns-greeting { margin:9px 0 5px; font:600 clamp(24px,4vw,32px)/1.18 Georgia,serif; color:var(--ink); }
  .ns-subtitle { color:var(--muted); margin:0; font-size:14px; }
  .ns-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:24px; }
  .ns-metric { padding:17px 18px; background:white; border:1px solid var(--line); border-radius:18px; min-height:112px; }
  .ns-metric-label { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:600; }
  .ns-metric-value { display:block; margin-top:12px; font:600 29px/1 Georgia,serif; color:var(--ink); }
  .ns-section { margin:24px 0; }
  .ns-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .ns-section-heading h2 { margin:0; color:var(--ink); font:600 19px Georgia,serif; }
  .ns-muted { color:var(--muted); font-size:12px; }
  .ns-list { display:grid; gap:12px; }
  .ns-card { background:white; border:1px solid var(--line); border-radius:18px; padding:19px; box-shadow:0 5px 18px rgba(38,59,44,.035); }
  .ns-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
  .ns-subject { display:inline-block; color:var(--green-dark); background:var(--green-soft); border-radius:99px; padding:5px 10px; font-size:11px; font-weight:700; }
  .ns-card-title { margin:10px 0 4px; font:600 17px/1.35 Georgia,serif; }
  .ns-card-date { margin:0; color:var(--muted); font-size:12px; }
  .ns-delete { flex:none; border:0; background:transparent; color:#9da79f; padding:8px; border-radius:10px; cursor:pointer; font-size:17px; }
  .ns-delete:hover { color:var(--rose); background:var(--rose-soft); }
  .ns-checks { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; }
  .ns-check { border:1px solid var(--line); color:var(--muted); background:white; border-radius:9px; padding:7px 10px; font:600 11px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-check.is-done { border-color:#cfdfcd; background:var(--green-soft); color:var(--green-dark); }
  .ns-revisions { border-top:1px solid var(--line); margin-top:16px; padding-top:14px; }
  .ns-revisions-label { display:block; margin-bottom:9px; color:var(--muted); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; }
  .ns-revision-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
  .ns-revision { display:flex; flex-direction:column; align-items:center; gap:4px; border:1px solid var(--line); border-radius:11px; padding:9px 5px; background:#fafbf8; color:var(--muted); font:600 11px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-revision small { font-size:10px; font-weight:400; }
  .ns-revision.is-done { background:var(--green); color:white; border-color:var(--green); }
  .ns-revision.is-late { color:var(--rose); background:var(--rose-soft); border-color:#f0d7d3; }
  .ns-toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:15px; }
  .ns-search { min-width:220px; flex:1; border:1px solid var(--line); background:white; color:var(--ink); border-radius:12px; padding:12px 14px; font:13px 'DM Sans',sans-serif; outline:none; }
  .ns-search:focus, .ns-select:focus, .ns-input:focus, .ns-textarea:focus { border-color:#84a18a; box-shadow:0 0 0 3px rgba(82,118,94,.12); }
  .ns-filters { display:flex; gap:7px; overflow:auto; padding:3px 1px 8px; }
  .ns-filter { flex:none; border:1px solid var(--line); background:white; border-radius:99px; padding:7px 11px; color:var(--muted); font:600 11px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-filter.is-active { background:var(--green); border-color:var(--green); color:white; }
  .ns-empty { padding:34px 20px; border:1px dashed #d5ded3; border-radius:17px; background:rgba(255,255,255,.65); text-align:center; }
  .ns-empty-icon { font-size:28px; }
  .ns-empty h3 { margin:9px 0 4px; color:var(--ink); font:600 17px 'Playfair Display',serif; }
  .ns-empty p { margin:0; color:var(--muted); font-size:13px; }
  .ns-timeline { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:13px; }
  .ns-timeline-item { border:1px solid var(--line); border-radius:12px; padding:10px; text-align:center; background:#fafbf8; font-size:11px; }
  .ns-timeline-item strong, .ns-timeline-item span { display:block; }
  .ns-timeline-item span { margin-top:4px; color:var(--muted); font-size:10px; }
  .ns-history-card { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .ns-history-title { margin:8px 0 4px; font:600 16px Georgia,serif; }
  .ns-history-actions { display:flex; gap:5px; }
  .ns-nav { position:fixed; z-index:5; bottom:0; left:0; right:0; background:rgba(255,255,255,.94); border-top:1px solid var(--line); backdrop-filter:blur(14px); padding:8px 16px max(8px,env(safe-area-inset-bottom)); }
  .ns-nav-inner { width:min(100%,600px); margin:auto; display:flex; justify-content:space-around; gap:8px; }
  .ns-nav-button { display:flex; min-width:70px; flex-direction:column; align-items:center; gap:4px; padding:6px 10px; border:0; border-radius:11px; background:transparent; color:var(--muted); font:600 10px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-nav-button span:first-child { font-size:18px; }
  .ns-nav-button.is-active { color:var(--green-dark); background:var(--green-soft); }
  .ns-fab { position:fixed; z-index:6; right:max(22px,calc((100vw - 980px)/2)); bottom:88px; width:54px; height:54px; border:0; border-radius:50%; background:var(--green); color:white; box-shadow:0 8px 22px rgba(53,91,67,.26); font-size:27px; cursor:pointer; }
  .ns-fab:hover { background:var(--green-dark); transform:translateY(-2px); }
  .ns-overlay { position:fixed; z-index:10; inset:0; display:grid; place-items:center; padding:18px; background:rgba(22,35,27,.42); backdrop-filter:blur(5px); }
  .ns-dialog { width:min(100%,490px); max-height:min(90vh,760px); overflow:auto; padding:23px; border-radius:20px; background:white; box-shadow:0 24px 80px rgba(23,38,28,.22); }
  .ns-dialog-header { display:flex; align-items:center; justify-content:space-between; gap:15px; padding-bottom:14px; border-bottom:1px solid var(--line); margin-bottom:17px; }
  .ns-dialog-header h2 { margin:0; color:var(--ink); font:600 21px 'Playfair Display',serif; }
  .ns-form { display:grid; gap:13px; }
  .ns-label { display:grid; gap:6px; color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
  .ns-input, .ns-textarea, .ns-select { width:100%; border:1px solid var(--line); background:#fafbf8; border-radius:10px; padding:11px 12px; color:var(--ink); font:13px 'DM Sans',sans-serif; outline:none; }
  .ns-textarea { min-height:82px; resize:vertical; }
  .ns-form-checks { display:flex; flex-wrap:wrap; gap:14px; color:var(--muted); font-size:12px; }
  .ns-form-checks label { display:flex; align-items:center; gap:7px; }
  .ns-dialog-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:18px; }
  .ns-toast { position:fixed; z-index:20; top:18px; left:50%; transform:translateX(-50%); width:max-content; max-width:calc(100% - 32px); border-radius:13px; padding:12px 16px; background:#2b3c31; color:white; box-shadow:0 10px 30px rgba(30,50,36,.2); font-size:13px; }
  .ns-toast.error { background:#9d403c; }
  .ns-toast.info { background:#465b72; }
  .ns-loading { display:inline-flex; align-items:center; gap:8px; }
  .ns-spinner { width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:ns-spin .7s linear infinite; }
  .ns-status { margin:9px 0 0; color:var(--muted); font-size:12px; }
  .ns-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
  @keyframes ns-spin { to { transform:rotate(360deg); } }
  @media (max-width:700px) {
    .nourish-app { padding:22px 16px 110px; }
    .ns-header { align-items:flex-start; margin-bottom:22px; }
    .ns-title { font-size:21px; }
    .ns-brand { gap:9px; }
    .ns-mark { width:40px; height:40px; border-radius:13px; }
    .ns-actions { gap:6px; }
    .ns-file-label { width:42px; padding:0; justify-content:center; font-size:0; }
    .ns-icon-button, .ns-file-label { min-height:40px; }
    .ns-intro { padding:21px; }
    .ns-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
    .ns-metric { min-height:100px; padding:14px; }
    .ns-metric-value { font-size:25px; margin-top:10px; }
    .ns-history-card { align-items:flex-start; }
    .ns-dialog { padding:19px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .nourish-app *, .nourish-app *::before, .nourish-app *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
  }
`

const StudyCard = memo(function StudyCard({
  study,
  onToggle,
  onDelete,
}: {
  study: Study
  onToggle: (id: string, field: StudyField) => void
  onDelete: (study: Study) => void
}) {
  const dates = revisionDates(study.studyDate)
  const revisions: { field: StudyField; label: string; date: string }[] = [
    { field: 'rev24h', label: '24 horas', date: dates.d24h },
    { field: 'rev7d', label: '7 dias', date: dates.d7d },
    { field: 'rev30d', label: '30 dias', date: dates.d30d },
  ]

  return (
    <article className="ns-card">
      <div className="ns-card-top">
        <div>
          <span className="ns-subject">{study.subject}</span>
          <h3 className="ns-card-title">{study.content}</h3>
          <p className="ns-card-date">Estudado em {formatDateBR(study.studyDate)}</p>
        </div>
        <button
          type="button"
          className="ns-delete"
          aria-label={`Solicitar exclusão de ${study.content}`}
          title="Excluir estudo"
          onClick={() => onDelete(study)}
        >
          ×
        </button>
      </div>

      <div className="ns-checks" aria-label="Materiais de estudo">
        <button
          type="button"
          className={`ns-check${study.hasNotes ? ' is-done' : ''}`}
          aria-pressed={study.hasNotes}
          onClick={() => onToggle(study.id, 'hasNotes')}
        >
          ▤ {study.hasNotes ? 'Anotações feitas' : 'Anotações'}
        </button>
        <button
          type="button"
          className={`ns-check${study.hasExercises ? ' is-done' : ''}`}
          aria-pressed={study.hasExercises}
          onClick={() => onToggle(study.id, 'hasExercises')}
        >
          ✓ {study.hasExercises ? 'Questões resolvidas' : 'Questões'}
        </button>
      </div>

      <div className="ns-revisions">
        <span className="ns-revisions-label">Ciclo de revisões</span>
        <div className="ns-revision-grid">
          {revisions.map(({ field, label, date }) => {
            const done = study[field]
            const overdue =
              !done &&
              (field === 'rev24h' ||
                (field === 'rev7d' && study.rev24h) ||
                (field === 'rev30d' && study.rev7d)) &&
              isPast(date)

            return (
              <button
                key={field}
                type="button"
                className={`ns-revision${done ? ' is-done' : overdue ? ' is-late' : ''}`}
                aria-pressed={done}
                aria-label={`${label}, ${done ? 'concluída' : overdue ? 'atrasada' : 'pendente'}, ${formatDateBR(date)}`}
                onClick={() => onToggle(study.id, field)}
              >
                <span>{label}</span>
                <small>{formatDateBR(date)}</small>
              </button>
            )
          })}
        </div>
      </div>
    </article>
  )
})

export default function App() {
  const [studies, setStudies] = useState<Study[]>(getInitialStudies)
  const [todayLabel] = useState(() =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  )
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('ALL')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<StudyForm>(freshForm)
  const [toast, setToast] = useState<Toast | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Study | null>(null)
  const studiesRef = useRef(studies)
  const toastTimer = useRef<number | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    studiesRef.current = studies
  }, [studies])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studies))
    } catch (error) {
      console.error('Não foi possível salvar os estudos.', error)
    }
  }, [studies])

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind })
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }, [])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!pendingDelete) return
    cancelDeleteButton.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDelete(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingDelete])

  const activeStudies = useMemo(() => studies.filter((study) => !study.completed), [studies])
  const completedStudies = useMemo(() => studies.filter((study) => study.completed), [studies])
  const subjects = useMemo(
    () => Array.from(new Set(activeStudies.map((study) => study.subject))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [activeStudies],
  )

  const { dueToday, overdue, totalReviews, completionRate } = useMemo(() => {
    const due: Study[] = []
    const late: Study[] = []

    activeStudies.forEach((study) => {
      const dates = revisionDates(study.studyDate)
      const pending =
        (!study.rev24h && dates.d24h) ||
        (study.rev24h && !study.rev7d && dates.d7d) ||
        (study.rev24h && study.rev7d && !study.rev30d && dates.d30d)

      if (!pending) return
      if (isToday(pending)) due.push(study)
      else if (isPast(pending)) late.push(study)
    })

    const reviewCount = studies.reduce(
      (total, study) => total + Number(study.rev24h) + Number(study.rev7d) + Number(study.rev30d),
      0,
    )
    const possibleReviews = studies.length * 3

    return {
      dueToday: due,
      overdue: late,
      totalReviews: reviewCount,
      completionRate: possibleReviews ? Math.round((reviewCount / possibleReviews) * 100) : 0,
    }
  }, [activeStudies, studies])

  const filteredStudies = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR')
    return activeStudies.filter((study) => {
      const matchesSubject = subjectFilter === 'ALL' || study.subject === subjectFilter
      const matchesQuery =
        !query ||
        study.subject.toLocaleLowerCase('pt-BR').includes(query) ||
        study.content.toLocaleLowerCase('pt-BR').includes(query)
      return matchesSubject && matchesQuery
    })
  }, [activeStudies, searchQuery, subjectFilter])

  const toggleStudyField = useCallback(
    (id: string, field: StudyField) => {
      const current = studiesRef.current.find((study) => study.id === id)
      if (!current) return

      const updated = { ...current, [field]: !current[field] }
      const isRevision = field === 'rev24h' || field === 'rev7d' || field === 'rev30d'
      if (isRevision) {
        updated.completed = updated.rev24h && updated.rev7d && updated.rev30d
        if (updated.completed && !current.completed) {
          showToast('Parabéns! Estudo concluído e enviado para o histórico.')
        } else if (current.completed && !updated.completed) {
          showToast('Revisão desfeita. O estudo voltou para a lista ativa.', 'info')
        }
      }

      setStudies((previous) => previous.map((study) => (study.id === id ? updated : study)))
    },
    [showToast],
  )

  const addStudy = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const subject = form.subject.trim()
      const content = form.content.trim()

      if (!subject || !content || !isValidDateString(form.studyDate)) {
        showToast('Preencha a matéria, o conteúdo e uma data válida.', 'error')
        return
      }

      const study: Study = {
        ...form,
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subject,
        content,
        rev24h: false,
        rev7d: false,
        rev30d: false,
        completed: false,
      }
      setStudies((previous) => [study, ...previous])
      setForm(freshForm())
      setIsFormOpen(false)
      showToast('Estudo adicionado e revisões agendadas.')
    },
    [form, showToast],
  )

  const exportData = useCallback(() => {
    setIsExporting(true)
    try {
      const blob = new Blob([JSON.stringify(studies, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `nourish-study-backup-${localDateString()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast('Backup exportado com sucesso.')
    } catch (error) {
      console.error('Falha ao exportar backup.', error)
      showToast('Não foi possível exportar o backup.', 'error')
    } finally {
      setIsExporting(false)
    }
  }, [showToast, studies])

  const importData = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsImporting(true)
      const reader = new FileReader()

      reader.onerror = () => {
        setIsImporting(false)
        showToast('Não foi possível ler o ficheiro selecionado.', 'error')
        if (importInput.current) importInput.current.value = ''
      }

      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(String(reader.result ?? ''))
          const validated = validateStudies(parsed)
          setStudies(validated)
          showToast(`Backup importado: ${validated.length} ${validated.length === 1 ? 'estudo' : 'estudos'}.`)
        } catch (error) {
          const message =
            error instanceof SyntaxError
              ? 'O ficheiro não contém JSON válido.'
              : error instanceof Error
                ? error.message
                : 'Não foi possível validar este backup.'
          showToast(message, 'error')
        } finally {
          setIsImporting(false)
          if (importInput.current) importInput.current.value = ''
        }
      }

      reader.readAsText(file, 'UTF-8')
    },
    [showToast],
  )

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return
    setStudies((previous) => previous.filter((study) => study.id !== pendingDelete.id))
    showToast('Estudo excluído.')
    setPendingDelete(null)
  }, [pendingDelete, showToast])

  const restoreStudy = useCallback(
    (study: Study) => {
      setStudies((previous) =>
        previous.map((item) =>
          item.id === study.id
            ? { ...item, rev24h: false, rev7d: false, rev30d: false, completed: false }
            : item,
        ),
      )
      showToast('Estudo restaurado. O ciclo de revisões foi reiniciado.', 'info')
    },
    [showToast],
  )

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'home', label: 'Início', icon: '⌂' },
    { key: 'studies', label: 'Estudos', icon: '▤' },
    { key: 'calendar', label: 'Agenda', icon: '▦' },
    { key: 'history', label: 'Histórico', icon: '↺' },
  ]

  return (
    <div className="nourish-app">
      <style>{styles}</style>
      <div className="ns-shell">
        <header className="ns-header">
          <div className="ns-brand">
            <div className="ns-mark" aria-hidden="true">✿</div>
            <div>
              <div className="ns-kicker">Seu espaço de aprendizagem</div>
              <h1 className="ns-title">Nourish Study</h1>
            </div>
          </div>
          <div className="ns-actions">
            <label className="ns-button ns-file-label" title="Importar backup JSON">
              {isImporting ? <span className="ns-loading"><span className="ns-spinner" />Importando</span> : '↑ Importar'}
              <input
                ref={importInput}
                type="file"
                accept=".json,application/json"
                aria-label="Importar backup de estudos"
                disabled={isImporting}
                onChange={importData}
              />
            </label>
            <button
              type="button"
              className="ns-button"
              onClick={exportData}
              disabled={isExporting}
            >
              {isExporting ? <span className="ns-loading"><span className="ns-spinner" />Exportando</span> : '↓ Exportar'}
            </button>
          </div>
        </header>

        {toast && (
          <div className={`ns-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
            {toast.message}
          </div>
        )}

        <main>
          {activeTab === 'home' && (
            <>
              <section className="ns-intro" aria-labelledby="welcome-title">
                <div className="ns-date">
                  {todayLabel}
                </div>
                <h2 className="ns-greeting" id="welcome-title">Um passo de cada vez. 🌱</h2>
                <p className="ns-subtitle">Aprender também é cuidar de si. Vamos revisar?</p>
              </section>

              <section className="ns-metrics" aria-label="Resumo de estudos">
                <div className="ns-metric"><div className="ns-metric-label">◷ Revisões hoje</div><strong className="ns-metric-value">{dueToday.length}</strong></div>
                <div className="ns-metric"><div className="ns-metric-label">! Em atraso</div><strong className="ns-metric-value">{overdue.length}</strong></div>
                <div className="ns-metric"><div className="ns-metric-label">▤ Estudos ativos</div><strong className="ns-metric-value">{activeStudies.length}</strong></div>
                <div className="ns-metric">
                  <div className="ns-metric-label">✓ Revisões feitas</div>
                  <strong className="ns-metric-value">{totalReviews}</strong>
                  <span className="ns-muted">{completionRate}% do ciclo total</span>
                </div>
              </section>

              <section className="ns-section" aria-labelledby="priority-title">
                <div className="ns-section-heading">
                  <h2 id="priority-title">Prioridades</h2>
                  <span className="ns-muted">{dueToday.length + overdue.length} tópicos</span>
                </div>
                {dueToday.length + overdue.length === 0 ? (
                  <EmptyState icon="✧" title="Tudo em dia" description="Nenhuma revisão pendente para hoje. Aproveite para adicionar um novo tema." />
                ) : (
                  <div className="ns-list">
                    {[...overdue, ...dueToday].map((study) => (
                      <StudyCard key={study.id} study={study} onToggle={toggleStudyField} onDelete={setPendingDelete} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'studies' && (
            <section className="ns-section" aria-labelledby="studies-title">
              <div className="ns-section-heading">
                <h2 id="studies-title">Meus estudos</h2>
                <span className="ns-muted">{activeStudies.length} ativos</span>
              </div>
              <div className="ns-toolbar">
                <input
                  className="ns-search"
                  type="search"
                  placeholder="Buscar matéria ou conteúdo..."
                  aria-label="Buscar estudos"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="ns-filters" aria-label="Filtrar por matéria">
                <button type="button" className={`ns-filter${subjectFilter === 'ALL' ? ' is-active' : ''}`} onClick={() => setSubjectFilter('ALL')}>
                  Todas ({activeStudies.length})
                </button>
                {subjects.map((subject) => (
                  <button
                    type="button"
                    className={`ns-filter${subjectFilter === subject ? ' is-active' : ''}`}
                    key={subject}
                    onClick={() => setSubjectFilter(subject)}
                  >
                    {subject}
                  </button>
                ))}
              </div>
              {filteredStudies.length === 0 ? (
                <EmptyState
                  icon={activeStudies.length === 0 ? '▤' : '⌕'}
                  title={activeStudies.length === 0 ? 'Nenhum estudo ativo' : 'Nenhum resultado encontrado'}
                  description={
                    activeStudies.length === 0
                      ? 'Adicione um tema para começar seu ciclo de revisões.'
                      : 'Tente outro termo de busca ou remova o filtro de matéria.'
                  }
                />
              ) : (
                <div className="ns-list">
                  {filteredStudies.map((study) => (
                    <StudyCard key={study.id} study={study} onToggle={toggleStudyField} onDelete={setPendingDelete} />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'calendar' && (
            <section className="ns-section" aria-labelledby="calendar-title">
              <div className="ns-section-heading">
                <h2 id="calendar-title">Agenda de revisões</h2>
                <span className="ns-muted">Ciclo de 24h · 7d · 30d</span>
              </div>
              {activeStudies.length === 0 ? (
                <EmptyState icon="▦" title="Agenda vazia" description="As revisões dos novos estudos aparecerão aqui." />
              ) : (
                <div className="ns-list">
                  {activeStudies.map((study) => {
                    const dates = revisionDates(study.studyDate)
                    return (
                      <article className="ns-card" key={study.id}>
                        <span className="ns-subject">{study.subject}</span>
                        <h3 className="ns-card-title">{study.content}</h3>
                        <p className="ns-card-date">Iniciado em {formatDateBR(study.studyDate)}</p>
                        <div className="ns-timeline">
                          {([
                            ['24 horas', dates.d24h, study.rev24h],
                            ['7 dias', dates.d7d, study.rev7d],
                            ['30 dias', dates.d30d, study.rev30d],
                          ] as const).map(([label, date, done]) => (
                            <div className="ns-timeline-item" key={label}>
                              <strong>{label}</strong>
                              <span>{formatDateBR(date)}</span>
                              <span>{done ? '✓ Concluída' : isPast(date) ? 'Atrasada' : 'Pendente'}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === 'history' && (
            <section className="ns-section" aria-labelledby="history-title">
              <div className="ns-section-heading">
                <h2 id="history-title">Histórico concluído</h2>
                <span className="ns-muted">{completedStudies.length} estudos</span>
              </div>
              {completedStudies.length === 0 ? (
                <EmptyState icon="↺" title="Seu histórico começa aqui" description="Quando completar as três revisões de um estudo, ele aparecerá nesta lista." />
              ) : (
                <div className="ns-list">
                  {completedStudies.map((study) => (
                    <article className="ns-card ns-history-card" key={study.id}>
                      <div>
                        <span className="ns-subject">{study.subject}</span>
                        <h3 className="ns-history-title">{study.content}</h3>
                        <p className="ns-card-date">Estudado em {formatDateBR(study.studyDate)} · ciclo concluído</p>
                      </div>
                      <div className="ns-history-actions">
                        <button type="button" className="ns-icon-button" aria-label={`Restaurar ${study.content}`} title="Restaurar estudo" onClick={() => restoreStudy(study)}>↺</button>
                        <button type="button" className="ns-icon-button" aria-label={`Solicitar exclusão de ${study.content}`} title="Excluir estudo" onClick={() => setPendingDelete(study)}>×</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <button type="button" className="ns-fab" aria-label="Adicionar novo estudo" title="Adicionar novo estudo" onClick={() => setIsFormOpen(true)}>+</button>

      <nav className="ns-nav" aria-label="Navegação principal">
        <div className="ns-nav-inner">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`ns-nav-button${activeTab === tab.key ? ' is-active' : ''}`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {isFormOpen && (
        <div className="ns-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
          <section className="ns-dialog" role="dialog" aria-modal="true" aria-labelledby="new-study-title">
            <div className="ns-dialog-header">
              <h2 id="new-study-title">Adicionar estudo</h2>
              <button type="button" className="ns-icon-button" aria-label="Fechar formulário" onClick={() => setIsFormOpen(false)}>×</button>
            </div>
            <form className="ns-form" onSubmit={addStudy}>
              <label className="ns-label">
                Matéria / disciplina
                <input className="ns-input" value={form.subject} maxLength={80} required placeholder="Ex.: Nutrição clínica" onChange={(event) => setForm({ ...form, subject: event.target.value })} />
              </label>
              <label className="ns-label">
                Conteúdo estudado
                <textarea className="ns-textarea" value={form.content} maxLength={500} required placeholder="Qual tema você estudou?" onChange={(event) => setForm({ ...form, content: event.target.value })} />
              </label>
              <label className="ns-label">
                Data do estudo
                <input className="ns-input" type="date" value={form.studyDate} required onChange={(event) => setForm({ ...form, studyDate: event.target.value })} />
              </label>
              <div className="ns-form-checks">
                <label><input type="checkbox" checked={form.hasNotes} onChange={(event) => setForm({ ...form, hasNotes: event.target.checked })} /> Anotações feitas</label>
                <label><input type="checkbox" checked={form.hasExercises} onChange={(event) => setForm({ ...form, hasExercises: event.target.checked })} /> Questões resolvidas</label>
              </div>
              <button className="ns-button ns-button-primary" type="submit">Salvar e agendar revisões</button>
            </form>
          </section>
        </div>
      )}

      {pendingDelete && (
        <div className="ns-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null) }}>
          <section className="ns-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <div className="ns-dialog-header">
              <h2 id="delete-title">Excluir estudo?</h2>
              <button type="button" className="ns-icon-button" aria-label="Fechar confirmação" onClick={() => setPendingDelete(null)}>×</button>
            </div>
            <p id="delete-description" className="ns-subtitle">
              “{pendingDelete.content}” será removido permanentemente deste dispositivo.
            </p>
            <div className="ns-dialog-actions">
              <button ref={cancelDeleteButton} type="button" className="ns-button" onClick={() => setPendingDelete(null)}>Cancelar</button>
              <button type="button" className="ns-button ns-button-danger" onClick={confirmDelete}>Excluir estudo</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="ns-empty" role="status">
      <div className="ns-empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
