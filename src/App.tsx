import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, DragEvent, FormEvent, ReactNode } from 'react'

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
type TabKey = 'home' | 'dashboard' | 'studies' | 'calendar' | 'history' | 'themes' | 'profile' | 'settings'
type ActiveTab = TabKey | 'not-found'
type DashboardRange = 7 | 14
type Profile = { name: string; photo: string | null }
type AppSettings = { defaultDashboardRange: DashboardRange; confirmBeforeDelete: boolean; startPage: 'home' | 'dashboard'; motionEnabled: boolean }
type PaletteKey = 'forest' | 'ocean' | 'lavender' | 'terracotta' | 'rose'
type ThemeMode = 'light' | 'dark'
type CalendarRevision = {
  studyId: string
  subject: string
  content: string
  field: StudyField
  label: string
  done: boolean
  available: boolean
  late: boolean
}
type ReviewNotification = {
  study: Study
  field: StudyField
  label: string
  date: string
  status: 'overdue' | 'today'
}
type ToastKind = 'success' | 'error' | 'info'
type Toast = { message: string; kind: ToastKind }
type StudyForm = Pick<Study, 'subject' | 'content' | 'studyDate' | 'hasNotes' | 'hasExercises'>
type WeeklyTask = { id: string; subject: string; content: string; date: string; completed: boolean }
type WeeklyTaskForm = Pick<WeeklyTask, 'subject' | 'content' | 'date'>

const STORAGE_KEY = 'nourish_studies_v1'
const WEEKLY_PLAN_STORAGE_KEY = 'nutrystudy_weekly_plan_v1'
const PROFILE_STORAGE_KEY = 'nutrystudy_profile_v1'
const XP_STORAGE_KEY = 'nutrystudy_xp_v1'
const PALETTE_STORAGE_KEY = 'nutrystudy_palette_v1'
const THEME_MODE_STORAGE_KEY = 'nutrystudy_theme_mode_v1'
const SETTINGS_STORAGE_KEY = 'nutrystudy_settings_v1'
const XP_PER_REVIEW = 10
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const VALID_TABS: TabKey[] = ['home', 'dashboard', 'studies', 'calendar', 'history', 'themes', 'profile', 'settings']
const DEFAULT_SETTINGS: AppSettings = { defaultDashboardRange: 7, confirmBeforeDelete: true, startPage: 'home', motionEnabled: true }
const RANKS = [
  { name: 'Ferro', title: 'Nutri recém-formado', description: 'O início da jornada: consolidando fundamentos e segurança profissional.', minXp: 0 },
  { name: 'Bronze', title: 'Nutri de franquia', description: 'Atendimento intenso, organização e construção de bons retornos.', minXp: 50 },
  { name: 'Prata', title: 'Foco, força e fé', description: 'Consultório próprio e primeiros passos em comunicação e marketing.', minXp: 150 },
  { name: 'Ouro', title: 'Nutri consolidado', description: 'Agenda reconhecida, avaliação criteriosa e planos individualizados.', minXp: 300 },
  { name: 'Platina', title: 'Especialista de nicho', description: 'Conhecimento aprofundado em uma subárea da nutrição.', minXp: 500 },
  { name: 'Esmeralda', title: 'Nutri de alto padrão', description: 'Atendimento de excelência unido a produtos e recursos digitais.', minXp: 800 },
  { name: 'Diamante', title: 'Nutri de atletas de elite', description: 'Alta performance, bioquímica aplicada e periodização nutricional.', minXp: 1200 },
  { name: 'Mestre', title: 'Nutri influenciador', description: 'Referência pública que compartilha conhecimento e inspira tendências.', minXp: 1800 },
  { name: 'Grão-Mestre', title: 'Nutri cientista', description: 'Pesquisa, formação de profissionais e contribuição científica.', minXp: 2600 },
  { name: 'Desafiante', title: 'Criador das diretrizes', description: 'Liderança na criação de recomendações com alcance amplo.', minXp: 3600 },
] as const
const RANK_COLORS = ['#73828a', '#a86d43', '#8793a0', '#c99532', '#72a4ba', '#318567', '#48a7c8', '#7864b7', '#b44f85', '#c84f4b'] as const
const PALETTES: { key: PaletteKey; name: string; green: string; dark: string; soft: string; swatches: string[]; darkSwatches: string[] }[] = [
  { key: 'forest', name: 'Bosque', green: '#52765e', dark: '#355b43', soft: '#eaf1e9', swatches: ['#52765e', '#d8a987', '#78977b'], darkSwatches: ['#91ad83', '#c7a889', '#b5c7aa'] },
  { key: 'ocean', name: 'Oceano', green: '#397b82', dark: '#25565d', soft: '#e5f2f2', swatches: ['#397b82', '#72aeb4', '#d6a870'], darkSwatches: ['#79b5ba', '#a4d1d3', '#dfbd8e'] },
  { key: 'lavender', name: 'Lavanda', green: '#7564a6', dark: '#504378', soft: '#efebf8', swatches: ['#7564a6', '#a795cb', '#d6b26c'], darkSwatches: ['#b2a1dc', '#d0c3ed', '#e2c77f'] },
  { key: 'terracotta', name: 'Terracota', green: '#a65e43', dark: '#713d2e', soft: '#f8ece5', swatches: ['#a65e43', '#d09255', '#74866a'], darkSwatches: ['#d99a79', '#e7bb84', '#afc09a'] },
  { key: 'rose', name: 'Rosa chá', green: '#a65f70', dark: '#713d4b', soft: '#f7eaf0', swatches: ['#a65f70', '#c58a9b', '#87956e'], darkSwatches: ['#d69aaa', '#ecc0ca', '#b7c39f'] },
]
const getInitialPalette = (): PaletteKey => {
  if (typeof window === 'undefined') return 'forest'
  try {
    const saved = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return PALETTES.some((palette) => palette.key === saved) ? (saved as PaletteKey) : 'forest'
  } catch (error) {
    console.error('Não foi possível carregar a paleta salva.', error)
    return 'forest'
  }
}

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  try {
    return window.localStorage.getItem(THEME_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch (error) {
    console.error('Não foi possível carregar o modo de tema salvo.', error)
    return 'light'
  }
}

const getInitialSettings = (): AppSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!saved) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed)) throw new Error('As configurações salvas estão em formato inválido.')
    return {
      defaultDashboardRange: parsed.defaultDashboardRange === 14 ? 14 : 7,
      confirmBeforeDelete: typeof parsed.confirmBeforeDelete === 'boolean' ? parsed.confirmBeforeDelete : true,
      startPage: parsed.startPage === 'dashboard' ? 'dashboard' : 'home',
      motionEnabled: typeof parsed.motionEnabled === 'boolean' ? parsed.motionEnabled : true,
    }
  } catch (error) {
    console.error('Não foi possível carregar as configurações salvas.', error)
    return DEFAULT_SETTINGS
  }
}

const getRankIndex = (xp: number) => {
  let rankIndex = 0
  RANKS.forEach((rank, index) => {
    if (xp >= rank.minXp) rankIndex = index
  })
  return rankIndex
}

function NutryLogo({ className = '' }: { className?: string }) {
  return (
    <img className={className} src="/nutrystudy-logo.svg" alt="" aria-hidden="true" />
  )
}

type IconName = 'home' | 'dashboard' | 'book' | 'calendar' | 'history' | 'palette' | 'clock' | 'alert' | 'bell' | 'check' | 'spark' | 'search' | 'sun' | 'moon' | 'leaf' | 'arrowRight' | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'plus' | 'close' | 'menu' | 'trash' | 'diamond' | 'user' | 'settings' | 'instagram'

function AppIcon({ name, className }: { name: IconName; className?: string }) {
  let content: ReactNode
  switch (name) {
    case 'home': content = <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>; break
    case 'dashboard': content = <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>; break
    case 'book': content = <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h8" /></>; break
    case 'calendar': content = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="M8 14h2m4 0h2m-8 4h2m4 0h2" /></>; break
    case 'history': content = <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>; break
    case 'palette': content = <><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-8.9-9-8.9Z" /><path d="M7.5 10h.01M10 7.5h.01M14 7.5h.01M16.5 10h.01" /></>; break
    case 'clock': content = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>; break
    case 'alert': content = <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>; break
    case 'bell': content = <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>; break
    case 'check': content = <path d="m5 12 4 4L19 6" />; break
    case 'spark': content = <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>; break
    case 'search': content = <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>; break
    case 'sun': content = <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>; break
    case 'moon': content = <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />; break
    case 'leaf': content = <><path d="M20.8 3.2C11 3 5 5.1 4 11.4c-.7 4.5 3.1 7.2 6.5 6.1 5.5-1.8 8.2-7.8 10.3-14.3Z" /><path d="M3 21c3-5 7-8 13-11" /></>; break
    case 'arrowRight': content = <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>; break
    case 'arrowUp': content = <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>; break
    case 'arrowDown': content = <><path d="M12 5v14" /><path d="m18 13-6 6-6-6" /></>; break
    case 'arrowLeft': content = <><path d="M20 12H5" /><path d="m11 18-6-6 6-6" /></>; break
    case 'plus': content = <path d="M12 5v14m-7-7h14" />; break
    case 'close': content = <path d="m6 6 12 12M18 6 6 18" />; break
    case 'menu': content = <path d="M4 6h16M4 12h16M4 18h16" />; break
    case 'trash': content = <><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>; break
    case 'diamond': content = <><path d="m12 2 9 10-9 10L3 12 12 2Z" /><path d="m3 12 18 0M8 7l4 15m4-15-4 15" /></>; break
    case 'user': content = <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>; break
    case 'settings': content = <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4L7.5 15a8 8 0 0 1 0-1.9L6.1 12l1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.9Z" /></>; break
    case 'instagram': content = <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>; break
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content}</svg>
}

function RankBadge({ rankIndex, size = 'normal' }: { rankIndex: number; size?: 'small' | 'normal' | 'large' }) {
  const color = RANK_COLORS[rankIndex] ?? RANK_COLORS[0]
  return (
    <span className={`ns-rank-badge is-${size}`} style={{ '--badge-color': color } as CSSProperties} role="img" aria-label={`${RANKS[rankIndex]?.name ?? 'Ferro'} rank`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <path className="ns-rank-badge-ribbon" d="m17 45-5 19 15-6 9 11 6-18" />
        <path className="ns-rank-badge-ribbon" d="m55 45 5 19-15-6-9 11-6-18" />
        <path className="ns-rank-badge-ground" d="M36 3 43 8l9-1 4 8 9 4v9l5 8-5 8v9l-9 4-4 8-9-1-7 5-7-5-9 1-4-8-9-4v-9l-5-8 5-8v-9l9-4 4-8 9 1 7-5Z" />
        <path className="ns-rank-badge-inner" d="M36 9 42 13l8-.8 3.5 7 7.5 3.5v7.5l4.3 6.8-4.3 6.8v7.5L53.5 55l-3.5 7-8-.8-6 4-6-4-8 .8-3.5-7L11 51.5V44l-4.3-6.8L11 30.4v-7.5l7.5-3.5 3.5-7 8 .8 6-4Z" />
        <circle className="ns-rank-badge-ring" cx="36" cy="36" r="19" />
        <path className="ns-rank-badge-fruit" d="M36 31c-5-5-13-1.5-13 6.4 0 7.1 5.7 13.3 13 13.3s13-6.2 13-13.3C49 29.5 41 26 36 31Z" />
        <path className="ns-rank-badge-leaf" d="M37 29c.2-7 5.7-10.4 12.6-9.7-.8 6-5.2 10.3-12.6 9.7Z" />
        <path className="ns-rank-badge-vein" d="m39 27 7-6" />
        <path className="ns-rank-badge-stem" d="M35 31c0-3.7 1.4-6 3.5-8" />
        <path className="ns-rank-badge-highlight" d="M27 38c0-2.8 1.5-5 4-6" />
        <circle className="ns-rank-badge-dot" cx="36" cy="5" r="1.2" />
      </svg>
    </span>
  )
}

const resolveTabFromHash = (hash: string): ActiveTab => {
  const normalized = hash.replace(/^#\/?/, '').trim().toLowerCase()
  if (!normalized || normalized === 'home') return 'home'
  return VALID_TABS.includes(normalized as TabKey) ? (normalized as TabKey) : 'not-found'
}

const localDateString = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getWeekStart = (date = new Date()) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return localDateString(monday)
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

const isWeeklyTask = (value: unknown): value is WeeklyTask =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.subject === 'string' &&
  typeof value.content === 'string' &&
  isValidDateString(value.date) &&
  typeof value.completed === 'boolean'

const getInitialWeeklyTasks = (): WeeklyTask[] => {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every(isWeeklyTask)) {
      throw new Error('O plano semanal salvo está em formato inválido.')
    }
    return parsed
  } catch (error) {
    console.error('Não foi possível carregar o plano semanal salvo.', error)
    return []
  }
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

const getInitialProfile = (): Profile => {
  if (typeof window === 'undefined') return { name: 'Nutri estudante', photo: null }
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!stored) return { name: 'Nutri estudante', photo: null }
    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed) || typeof parsed.name !== 'string' || (parsed.photo !== null && typeof parsed.photo !== 'string')) {
      throw new Error('Os dados do perfil salvos são inválidos.')
    }
    return { name: parsed.name.trim() || 'Nutri estudante', photo: parsed.photo }
  } catch (error) {
    console.error('Não foi possível carregar o perfil salvo.', error)
    return { name: 'Nutri estudante', photo: null }
  }
}

const getInitialXp = (initialStudies: Study[]): { xp: number; claimed: string[] } => {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(XP_STORAGE_KEY)
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored)
        if (
          !isRecord(parsed) ||
          !Number.isSafeInteger(parsed.xp) ||
          Number(parsed.xp) < 0 ||
          !Array.isArray(parsed.claimed) ||
          !parsed.claimed.every((key) => typeof key === 'string')
        ) {
          throw new Error('Os dados de XP salvos são inválidos.')
        }
        return { xp: Number(parsed.xp), claimed: parsed.claimed }
      }
    } catch (error) {
      console.error('Não foi possível carregar o XP salvo.', error)
    }
  }
  const claimed: string[] = []
  const trackedFields = ['rev24h', 'rev7d', 'rev30d', 'hasNotes', 'hasExercises'] as const
  initialStudies.forEach((study) => {
    trackedFields.forEach((field) => {
      if (study[field]) claimed.push(`${study.id}:${field}`)
    })
  })
  return { xp: claimed.length * XP_PER_REVIEW, claimed }
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
  .nourish-app { --ink:#24332d; --muted:#78857d; --green:#52765e; --green-dark:#355b43; --green-soft:#eaf1e9; --paper:#f7f8f4; --line:#e5eae2; --rose:#a9504c; --rose-soft:#fbefed; --surface:#fff; --surface-soft:#fafbf8; --chart-done:#16a34a; --chart-pending:#f59e0b; --chart-locked:#8b5cf6; min-height:100vh; background:var(--paper); color:var(--ink); font-family:'DM Sans',sans-serif; }
  .nourish-app[data-palette="ocean"] { --green:#397b82; --green-dark:#25565d; --green-soft:#e5f2f2; --paper:#f4f8f8; --line:#dfeaea; }
  .nourish-app[data-palette="lavender"] { --green:#7564a6; --green-dark:#504378; --green-soft:#efebf8; --paper:#f8f6fb; --line:#e9e4f1; }
  .nourish-app[data-palette="terracotta"] { --green:#a65e43; --green-dark:#713d2e; --green-soft:#f8ece5; --paper:#fbf7f3; --line:#eee4dc; }
  .nourish-app[data-palette="rose"] { --green:#a65f70; --green-dark:#713d4b; --green-soft:#f7eaf0; --paper:#fbf6f8; --line:#efe3e9; }
  .nourish-app[data-mode="dark"] { --ink:#f0f1ec; --muted:#a4aaa2; --green:#91ad83; --green-dark:#c5d3bc; --green-soft:#293128; --paper:#101110; --line:#323632; --rose:#d59a95; --rose-soft:#382927; --surface:#1a1c1a; --surface-soft:#232623; --chart-done:#34d399; --chart-pending:#fbbf24; --chart-locked:#a78bfa; color-scheme:dark; }
  .nourish-app[data-mode="dark"][data-palette="ocean"] { --green:#79b5ba; --green-dark:#c3e0e1; --green-soft:#253235; }
  .nourish-app[data-mode="dark"][data-palette="lavender"] { --green:#b2a1dc; --green-dark:#ded5f3; --green-soft:#302c3b; }
  .nourish-app[data-mode="dark"][data-palette="terracotta"] { --green:#d99a79; --green-dark:#edccaf; --green-soft:#392e28; }
  .nourish-app[data-mode="dark"][data-palette="rose"] { --green:#d69aaa; --green-dark:#edcbd4; --green-soft:#392b31; }
  .nourish-app[data-mode="dark"] .ns-sidebar,
  .nourish-app[data-mode="dark"] .ns-dashboard-card,
  .nourish-app[data-mode="dark"] .ns-card,
  .nourish-app[data-mode="dark"] .ns-home-action-card,
  .nourish-app[data-mode="dark"] .ns-calendar-panel,
  .nourish-app[data-mode="dark"] .ns-calendar-detail,
  .nourish-app[data-mode="dark"] .ns-weekly-plan,
  .nourish-app[data-mode="dark"] .ns-weekly-day,
  .nourish-app[data-mode="dark"] .ns-dialog,
  .nourish-app[data-mode="dark"] .ns-button:not(.ns-button-primary),
  .nourish-app[data-mode="dark"] .ns-icon-button,
  .nourish-app[data-mode="dark"] .ns-check,
  .nourish-app[data-mode="dark"] .ns-filter,
  .nourish-app[data-mode="dark"] .ns-timeline-item,
  .nourish-app[data-mode="dark"] .ns-palette-option,
  .nourish-app[data-mode="dark"] .ns-revision,
  .nourish-app[data-mode="dark"] .ns-calendar-task,
  .nourish-app[data-mode="dark"] .ns-chart-detail,
  .nourish-app[data-mode="dark"] .ns-calendar-day { background:var(--surface); color:var(--ink); border-color:var(--line); }
  .nourish-app[data-mode="dark"] .ns-intro,
  .nourish-app[data-mode="dark"] .ns-metric,
  .nourish-app[data-mode="dark"] .ns-sidebar-profile { background:var(--surface); border-color:var(--line); }
  .nourish-app[data-mode="dark"] .ns-subject-progress-button,
  .nourish-app[data-mode="dark"] .ns-chart-column:hover,
  .nourish-app[data-mode="dark"] .ns-chart-column.is-selected,
  .nourish-app[data-mode="dark"] .ns-revision:not(.is-done):not(.is-late),
  .nourish-app[data-mode="dark"] .ns-range-switch,
  .nourish-app[data-mode="dark"] .ns-weekly-day:not(.is-today) { background:var(--surface-soft); border-color:var(--line); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-input,
  .nourish-app[data-mode="dark"] .ns-search,
  .nourish-app[data-mode="dark"] .ns-select,
  .nourish-app[data-mode="dark"] .ns-textarea { background:var(--surface-soft); border-color:var(--line); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-revision:not(.is-done):not(.is-late),
  .nourish-app[data-mode="dark"] .ns-chart-detail,
  .nourish-app[data-mode="dark"] .ns-subject-progress-button { background:var(--surface-soft); border-color:var(--line); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-check.is-done,
  .nourish-app[data-mode="dark"] .ns-filter.is-active { background:#e6e6e6; border-color:#e6e6e6; color:#171717; }
  .nourish-app[data-mode="dark"] .ns-rank-summary,
  .nourish-app[data-mode="dark"] .ns-chart-detail,
  .nourish-app[data-mode="dark"] .ns-calendar-task-badge.is-locked { background:var(--surface-soft); color:var(--muted); }
  .nourish-app[data-mode="dark"] .ns-empty { background:var(--surface-soft); border-color:var(--line); }
  .nourish-app[data-mode="dark"] .ns-calendar-day:hover,
  .nourish-app[data-mode="dark"] .ns-subject-progress-button:hover { background:var(--green-soft); }
  .nourish-app[data-mode="dark"] .ns-progress-ring::before { background:var(--surface); }
  .nourish-app[data-mode="dark"] .ns-progress-track,
  .nourish-app[data-mode="dark"] .ns-chart-bar,
  .nourish-app[data-mode="dark"] .ns-rank-mini-track { background:var(--line); }
  .nourish-app[data-mode="dark"] .ns-rank-badge-ground { fill:var(--surface); }
  .nourish-app[data-mode="dark"] .ns-range-button.is-active { background:var(--surface-soft); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-selected,
  .nourish-app[data-mode="dark"] .ns-nav-button.is-active,
  .nourish-app[data-mode="dark"] .ns-palette-option.is-active { background:var(--green-soft); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-sidebar-collapse { background:var(--surface-soft); color:var(--muted); border-color:var(--line); }
  .nourish-app[data-mode="dark"] .ns-calendar-day-count { background:var(--surface-soft); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-calendar-dot { background:#c8c8c8; }
  .nourish-app[data-mode="dark"] .ns-calendar-dot.is-done { background:#f0f0f0; }
  .nourish-app[data-mode="dark"] .ns-calendar-dot.is-locked { background:var(--muted); }
  .nourish-app[data-mode="dark"] .ns-site-footer { border-color:var(--line); }
  .nourish-app[data-mode="dark"] .ns-avatar { background:var(--green-soft); border-color:var(--surface); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-button-primary { background:#e5e5e5; border-color:#e5e5e5; color:#161616; }
  .nourish-app[data-mode="dark"] .ns-button-primary:hover { background:#fff; border-color:#fff; color:#161616; }
  .nourish-app[data-mode="dark"] .ns-rank-summary { background:var(--surface-soft); }
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-completed { background:#cfcfcf; }
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-pending { background:#777; }
  .nourish-app[data-mode="dark"] .ns-legend-dot { background:#cfcfcf; }
  .nourish-app[data-mode="dark"] .ns-legend-dot.is-pending { background:#777; }
  .nourish-app[data-mode="dark"] .ns-weekly-task-toggle.is-done > span:first-child { background:#e5e5e5; border-color:#e5e5e5; color:#161616; }
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active { color:#fff; }
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active .ns-theme-mode-icon { color:#fff; }
  .nourish-app[data-mode="dark"] .ns-sidebar-collapse:hover,
  .nourish-app[data-mode="dark"] .ns-button:not(.ns-button-primary):hover,
  .nourish-app[data-mode="dark"] .ns-icon-button:hover { background:#383838; border-color:#707070; color:#fff; }
  .nourish-app[data-mode="dark"] .ns-nav-button.is-active { background:#303030; color:#fff; box-shadow:inset 0 0 0 1px #444; }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-selected,
  .nourish-app[data-mode="dark"] .ns-palette-option.is-active,
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active { background:#303030; color:#fff; border-color:#858585; }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-today .ns-calendar-day-number,
  .nourish-app[data-mode="dark"] .ns-subject,
  .nourish-app[data-mode="dark"] .ns-profile-copy small,
  .nourish-app[data-mode="dark"] .ns-metric-label,
  .nourish-app[data-mode="dark"] .ns-metric-icon { color:#ededed; }
  .nourish-app[data-mode="dark"] .ns-metric-icon,
  .nourish-app[data-mode="dark"] .ns-home-action-icon { background:#333; color:#ededed; }
  .nourish-app[data-mode="dark"] .ns-subject { background:#303030; }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-selected { box-shadow:inset 0 0 0 1px #555; }
  .nourish-app[data-mode="dark"] .ns-revision.is-late,
  .nourish-app[data-mode="dark"] .ns-calendar-task-badge.is-late { background:#3a3333; border-color:#5b5050; color:#e0d6d6; }
  .nourish-app[data-mode="dark"] .ns-revision.is-done { background:#e5e5e5; border-color:#e5e5e5; color:#161616; }
  .nourish-app[data-mode="dark"] .ns-button-danger,
  .nourish-app[data-mode="dark"] .ns-delete:hover { background:#383838; border-color:#666; color:#eee; }
  .nourish-app[data-mode="dark"] .ns-toast { background:#333; color:#fff; }
  .nourish-app[data-mode="dark"] .ns-toast.error { background:#4b3333; }
  .nourish-app[data-mode="dark"] .ns-toast.info { background:#353535; }
  .ns-dark-theme-note { margin:0; padding:12px 14px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft,#fafbf8); color:var(--muted); font-size:12px; line-height:1.5; }
  .nourish-app[data-mode="dark"] .ns-input::placeholder,
  .nourish-app[data-mode="dark"] .ns-search::placeholder,
  .nourish-app[data-mode="dark"] .ns-textarea::placeholder { color:var(--muted); opacity:1; }
  .nourish-app[data-mode="dark"] .ns-mark img { filter:saturate(.72) brightness(1.12); }
  .nourish-app[data-mode="dark"] .ns-rank-badge { filter:drop-shadow(0 2px 5px rgba(0,0,0,.38)); }
  .nourish-app[data-mode="dark"] .ns-intro { background:radial-gradient(ellipse at top right,color-mix(in srgb,var(--green) 15%,transparent),transparent 48%),linear-gradient(135deg,#20241f,#151715 72%); border-color:#343a33; }
  .nourish-app[data-mode="dark"] .ns-metric,
  .nourish-app[data-mode="dark"] .ns-weekly-plan { background:linear-gradient(145deg,#1e211e,#181a18); border-color:#343834; }
  .nourish-app[data-mode="dark"] .ns-dashboard-card,
  .nourish-app[data-mode="dark"] .ns-calendar-panel,
  .nourish-app[data-mode="dark"] .ns-calendar-detail,
  .nourish-app[data-mode="dark"] .ns-card,
  .nourish-app[data-mode="dark"] .ns-home-action-card { box-shadow:0 12px 28px rgba(0,0,0,.18); }
  .nourish-app[data-mode="dark"] .ns-progress-ring { background:conic-gradient(var(--green) var(--progress),#343934 0); }
  .nourish-app[data-mode="dark"] .ns-progress-ring::before { background:#1a1c1a; }
  .nourish-app[data-mode="dark"] .ns-progress-track,
  .nourish-app[data-mode="dark"] .ns-chart-bar,
  .nourish-app[data-mode="dark"] .ns-rank-mini-track { background:#303030; }
  .nourish-app[data-mode="dark"] .ns-progress-fill { background:linear-gradient(90deg,color-mix(in srgb,var(--green) 74%,#202020),var(--green)); }
  .nourish-app[data-mode="dark"] .ns-check-indicator { background:#303630; border-color:#465044; }
  .nourish-app[data-mode="dark"] .ns-check.is-done .ns-check-indicator { background:var(--green); border-color:var(--green); color:#171a16; }
  .nourish-app[data-mode="dark"] .ns-weekly-day.is-today,
  .nourish-app[data-mode="dark"] .ns-rank-roadmap-item.is-current { background:var(--green-soft); border-color:color-mix(in srgb,var(--green) 45%,#323632); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-range-switch { background:#171717; }
  .nourish-app[data-mode="dark"] .ns-range-button.is-active { background:#393939; color:#fff; box-shadow:0 1px 4px rgba(0,0,0,.35); }
  .nourish-app[data-mode="dark"] .ns-revision.is-late,
  .nourish-app[data-mode="dark"] .ns-calendar-task-badge.is-late { background:#382927; border-color:#60403c; color:#e5c0bc; }
  .nourish-app[data-mode="dark"] .ns-toast.error { background:#633d39; color:#fff4f2; }
  .nourish-app[data-mode="dark"] .ns-toast.info { background:#303b32; color:#edf3e9; }
  .nourish-app[data-mode="dark"] .ns-button-primary,
  .nourish-app[data-mode="dark"] .ns-filter.is-active,
  .nourish-app[data-mode="dark"] .ns-check.is-done,
  .nourish-app[data-mode="dark"] .ns-revision.is-done,
  .nourish-app[data-mode="dark"] .ns-weekly-task-toggle.is-done > span:first-child { background:var(--green); border-color:var(--green); color:#171a16; }
  .nourish-app[data-mode="dark"] .ns-button-primary:hover { background:color-mix(in srgb,var(--green) 84%,white); border-color:color-mix(in srgb,var(--green) 84%,white); color:#121511; }
  .nourish-app[data-mode="dark"] .ns-nav-button.is-active,
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-selected,
  .nourish-app[data-mode="dark"] .ns-palette-option.is-active,
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active { background:var(--green-soft); border-color:color-mix(in srgb,var(--green) 48%,#323632); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active { box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 56%,transparent); }
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active .ns-theme-mode-icon,
  .nourish-app[data-mode="dark"] .ns-nav-button.is-active span:first-child { color:var(--green); }
  .nourish-app[data-mode="dark"] .ns-subject,
  .nourish-app[data-mode="dark"] .ns-metric-icon,
  .nourish-app[data-mode="dark"] .ns-home-action-icon { background:var(--green-soft); color:var(--green); }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-selected { box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 52%,#323632); }
  .nourish-app[data-mode="dark"] .ns-calendar-day.is-today .ns-calendar-day-number,
  .nourish-app[data-mode="dark"] .ns-profile-copy small { color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-calendar-dot.is-done,
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-completed,
  .nourish-app[data-mode="dark"] .ns-legend-dot { background:var(--green); }
  .nourish-app[data-mode="dark"] .ns-range-button.is-active { background:var(--green-soft); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-calendar-day:hover,
  .nourish-app[data-mode="dark"] .ns-subject-progress-button:hover,
  .nourish-app[data-mode="dark"] .ns-sidebar-collapse:hover,
  .nourish-app[data-mode="dark"] .ns-button:not(.ns-button-primary):hover,
  .nourish-app[data-mode="dark"] .ns-icon-button:hover { background:#2a3229; border-color:#596451; color:#f0f3ec; }
  .nourish-app[data-mode="dark"] .ns-mobile-menu { background:var(--surface); border-color:var(--line); color:var(--ink); font-family:'DM Sans',sans-serif; }
  .nourish-app[data-mode="dark"] .ns-mobile-menu:hover { background:var(--green-soft); border-color:color-mix(in srgb,var(--green) 48%,var(--line)); color:var(--green-dark); }
  .ns-workspace { display:flex; min-height:100vh; }
  .ns-sidebar { position:sticky; top:0; z-index:8; display:flex; flex:none; width:258px; height:100vh; flex-direction:column; padding:22px 15px 16px; background:#fff; border-right:1px solid var(--line); transition:width .22s ease,transform .22s ease; }
  .ns-workspace.is-collapsed .ns-sidebar { width:86px; padding-right:12px; padding-left:12px; }
  .ns-sidebar-brand { display:flex; align-items:center; gap:11px; padding:2px 6px 20px; }
  .ns-sidebar-brand-copy { min-width:0; }
  .ns-sidebar-brand .ns-title { font-size:20px; white-space:nowrap; }
  .ns-sidebar-brand .ns-kicker { font-size:9px; letter-spacing:.12em; white-space:nowrap; }
  .ns-sidebar-profile { display:flex; align-items:center; gap:11px; width:100%; min-width:0; padding:12px 10px; border:1px solid var(--line); border-radius:16px; background:linear-gradient(140deg,#fff,var(--green-soft)); text-align:left; cursor:pointer; }
  .ns-sidebar-profile.is-active { border-color:var(--green); background:var(--green-soft); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 20%,transparent); }
  .ns-avatar { display:grid; width:42px; height:42px; flex:none; place-items:center; overflow:hidden; border:2px solid white; border-radius:50%; background:#dfeadd; color:var(--green-dark); font:600 16px Georgia,serif; box-shadow:0 2px 8px rgba(36,51,45,.12); }
  .ns-avatar img { width:100%; height:100%; object-fit:cover; }
  .ns-profile-copy { display:block; min-width:0; flex:1; }
  .ns-profile-copy strong,.ns-profile-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ns-profile-copy strong { color:var(--ink); font-size:12px; }
  .ns-profile-name-row { display:flex; min-width:0; align-items:center; gap:5px; }
  .ns-profile-name-row strong { min-width:0; }
  .ns-profile-name-row .ns-rank-badge { width:21px; height:21px; }
  .ns-profile-copy small { display:flex; align-items:center; gap:4px; margin-top:3px; color:var(--green-dark); font-size:10px; font-weight:700; }
  .ns-rank-mini-track { height:4px; margin-top:8px; overflow:hidden; border-radius:99px; background:#dce8da; }
  .ns-rank-mini-fill { height:100%; border-radius:inherit; background:var(--green); }
  .ns-sidebar-nav { display:grid; gap:5px; margin-top:20px; }
  .ns-sidebar-nav .ns-nav-button { width:100%; min-width:0; min-height:44px; flex-direction:row; justify-content:flex-start; gap:12px; padding:0 13px; border-radius:12px; text-align:left; font-size:12px; }
  .ns-sidebar-nav .ns-nav-button span:first-child { display:grid; width:22px; place-items:center; }
  .ns-ui-icon { display:block; width:1.15em; height:1.15em; flex:none; }
  .ns-sidebar-nav .ns-nav-button .ns-ui-icon { width:19px; height:19px; }
  .ns-sidebar-nav .ns-nav-button.is-active { background:var(--green-soft); }
  .ns-sidebar-spacer { flex:1; }
  .ns-mobile-dock { display:none; }
  .ns-sidebar-collapse { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; min-height:40px; margin-top:14px; border:1px solid var(--line); border-radius:11px; background:#fafbf9; color:var(--muted); font:600 11px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-main-shell { min-width:0; flex:1; padding:28px clamp(18px,3vw,44px) 48px; }
  .ns-shell { width:min(100%, 1180px); margin:0 auto; }
  .ns-header { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:30px; }
  .ns-header-start { display:flex; align-items:center; gap:13px; min-width:0; }
  .ns-header-start .ns-brand { display:none; }
  .ns-page-nav { display:flex; align-items:center; gap:9px; min-width:0; }
  .ns-page-nav h1 { margin:0; color:var(--ink); font:600 clamp(22px,2.4vw,30px)/1.2 Georgia,serif; }
  .ns-page-nav p { margin:4px 0 0; color:var(--muted); font-size:12px; }
  .ns-header-profile { display:none; }
  .ns-mobile-menu { display:none; }
  .ns-sidebar-backdrop { display:none; }
  .ns-header-nav-arrows { display:flex; gap:6px; }
  .ns-header-nav-arrows .ns-icon-button { width:36px; min-height:36px; font-size:16px; }
  .ns-app-content { width:min(100%,1180px); margin:0 auto; }
  .ns-home-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin:20px 0 26px; }
  .ns-home-action-card { display:flex; align-items:center; gap:13px; min-width:0; padding:17px; border:1px solid var(--line); border-radius:17px; background:white; text-align:left; cursor:pointer; transition:transform .18s,border-color .18s,box-shadow .18s; }
  .ns-home-action-card:hover { transform:translateY(-2px); border-color:#cbd9ca; box-shadow:0 10px 24px rgba(38,59,44,.06); }
  .ns-home-action-icon { display:grid; width:42px; height:42px; flex:none; place-items:center; border-radius:13px; background:var(--green-soft); color:var(--green-dark); font-size:20px; }
  .ns-home-action-card strong,.ns-home-action-card small { display:block; }
  .ns-home-action-card strong { color:var(--ink); font-size:12px; }
  .ns-home-action-card small { margin-top:4px; color:var(--muted); font-size:10px; }
  .ns-home-action-arrow { display:grid; margin-left:auto; color:var(--green); }
  .ns-home-action-arrow .ns-ui-icon { width:19px; height:19px; }
  .ns-brand { display:flex; align-items:center; gap:13px; }
  .ns-mark { width:46px; height:46px; display:grid; place-items:center; border-radius:16px; color:var(--green-dark); background:var(--green-soft); }
  .ns-mark img { display:block; width:36px; height:36px; }
  .ns-kicker { color:var(--green); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.16em; }
  .ns-title { color:var(--ink); font:600 24px/1.2 Georgia,serif; margin:2px 0 0; }
  .ns-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:9px; align-items:center; }
  .ns-icon-button, .ns-button { border:1px solid var(--line); background:white; color:var(--ink); border-radius:12px; min-height:42px; padding:0 14px; font:600 13px 'DM Sans',sans-serif; cursor:pointer; transition:background .18s,border-color .18s,transform .18s, box-shadow .18s; }
  .ns-icon-button:hover, .ns-button:hover { background:var(--green-soft); border-color:var(--green); }
  .ns-button:active, .ns-icon-button:active { transform:translateY(1px); }
  .ns-button:focus-visible, .ns-icon-button:focus-visible, .ns-file-label:focus-within { outline:none; box-shadow:0 0 0 3px rgba(82,118,94,.14); }
  .ns-button-primary { background:var(--green); color:white; border-color:var(--green); }
  .ns-button-primary:hover { background:var(--green-dark); color:white; }
  .ns-button-danger { color:var(--rose); border-color:#efd5d1; }
  .ns-button-danger:hover { background:var(--rose-soft); }
  .ns-icon-button { width:42px; padding:0; font-size:18px; }
  .ns-file-label { position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; min-width:124px; padding:0 14px; }
  .ns-file-label input { position:absolute; inset:0; opacity:0; cursor:pointer; }
  .ns-file-label:has(input:disabled) { opacity:.55; pointer-events:none; }
  .ns-file-label.is-dragover { background:var(--green-soft); border-color:var(--green); color:var(--green-dark); box-shadow:0 0 0 3px rgba(82,118,94,.12); }
  .ns-button[disabled] { opacity:.65; cursor:not-allowed; }
  .ns-intro { background:linear-gradient(125deg,var(--green-soft),var(--paper)); border:1px solid var(--line); border-radius:23px; padding:25px 28px; margin-bottom:20px; }
  .ns-date { color:var(--green); font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:capitalize; }
  .ns-greeting { display:flex; align-items:center; gap:9px; margin:9px 0 5px; font:600 clamp(24px,4vw,32px)/1.18 Georgia,serif; color:var(--ink); }
  .ns-greeting-icon { width:23px; height:23px; flex:none; color:var(--green); stroke-width:1.7; }
  .ns-subtitle { color:var(--muted); margin:0; font-size:14px; }
  .ns-metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr)); gap:12px; margin-bottom:24px; }
  .ns-metric { display:block; width:100%; min-width:0; padding:17px 18px; background:linear-gradient(180deg,#ffffff 0%,var(--paper) 100%); border:1px solid var(--line); border-radius:18px; min-height:112px; box-shadow:0 10px 22px rgba(36,51,45,.04); text-align:left; }
  .ns-metric-action { cursor:pointer; transition:transform .18s,border-color .18s,box-shadow .18s; }
  .ns-metric-action:hover { transform:translateY(-2px); border-color:var(--green); box-shadow:0 14px 26px rgba(36,51,45,.08); }
  .ns-metric-action:focus-visible,.ns-subject-progress-button:focus-visible,.ns-dashboard-action:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 42%,transparent); outline-offset:2px; }
  .ns-metric-label { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
  .ns-metric-icon { width:22px; height:22px; display:grid; place-items:center; border-radius:8px; background:var(--green-soft); color:var(--green-dark); font-size:12px; }
  .ns-metric-icon .ns-ui-icon { width:14px; height:14px; }
  .ns-metric-value { display:block; margin-top:12px; font:600 29px/1 Georgia,serif; color:var(--ink); }
  .ns-dashboard { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:14px; margin:22px 0 28px; }
  .ns-dashboard-card { min-width:0; padding:20px; border:1px solid var(--line); border-radius:19px; background:white; box-shadow:0 10px 24px rgba(38,59,44,.04); }
  .ns-dashboard-card:first-child { grid-column:span 4; }
  .ns-dashboard-card:nth-child(2) { grid-column:span 8; }
  .ns-dashboard-card:nth-child(3) { grid-column:1/-1; }
  .ns-dashboard-action { display:block; width:100%; color:inherit; font:inherit; text-align:left; cursor:pointer; transition:border-color .18s,box-shadow .18s,transform .18s; }
  .ns-dashboard-action:hover { transform:translateY(-2px); border-color:var(--green); box-shadow:0 14px 28px rgba(38,59,44,.08); }
  .ns-dashboard-action:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 42%,transparent); outline-offset:2px; }
  .ns-dashboard-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:17px; }
  .ns-dashboard-heading h2 { margin:0; color:var(--ink); font:600 17px Georgia,serif; }
  .ns-dashboard-heading p { margin:4px 0 0; color:var(--muted); font-size:11px; }
  .ns-progress-overview { display:flex; align-items:center; gap:17px; }
  .ns-progress-ring { width:clamp(78px,9vw,102px); height:clamp(78px,9vw,102px); flex:none; display:grid; place-items:center; border-radius:50%; background:conic-gradient(var(--green) var(--progress),#eaf1e9 0); position:relative; }
  .ns-progress-ring::before { content:""; position:absolute; inset:9px; border-radius:50%; background:white; }
  .ns-progress-ring strong { position:relative; color:var(--ink); font:600 22px Georgia,serif; }
  .ns-progress-copy { min-width:0; flex:1; }
  .ns-progress-copy strong { display:block; color:var(--ink); font:600 14px Georgia,serif; }
  .ns-progress-copy span { display:block; margin-top:5px; color:var(--muted); font-size:11px; line-height:1.5; }
  .ns-progress-track { display:block; height:7px; overflow:hidden; border-radius:99px; background:#eaf1e9; margin-top:11px; }
  .ns-progress-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,#78977b,var(--green-dark)); transition:width .35s ease; }
  .ns-chart-heading { align-items:center; }
  .ns-range-switch { display:inline-flex; padding:3px; gap:2px; border:1px solid var(--line); border-radius:10px; background:#f8faf7; }
  .ns-range-button { min-height:28px; padding:0 9px; border:0; border-radius:7px; background:transparent; color:var(--muted); font:600 10px 'DM Sans',sans-serif; cursor:pointer; }
  .ns-range-button.is-active { background:white; color:var(--green-dark); box-shadow:0 1px 4px rgba(36,51,45,.12); }
  .ns-chart-scroll { overflow-x:auto; padding:4px 0 2px; scrollbar-width:thin; }
  .ns-chart { display:grid; align-items:end; gap:6px; min-width:350px; height:126px; }
  .ns-chart-column { display:flex; height:100%; min-width:0; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; padding:0 1px; border:0; border-radius:8px; background:transparent; color:var(--muted); cursor:pointer; }
  .ns-chart-column:hover, .ns-chart-column.is-selected { background:#f5f8f4; }
  .ns-chart-bar { display:flex; width:min(100%,25px); height:100px; flex-direction:column; justify-content:flex-end; overflow:hidden; border-radius:7px 7px 3px 3px; background:color-mix(in srgb,var(--line) 56%,var(--paper)); box-shadow:inset 0 1px 3px rgba(26,42,31,.1); }
  .ns-chart-segment { display:block; min-height:0; transition:height .3s ease,opacity .2s; }
  .ns-chart-segment.is-completed { background:linear-gradient(180deg,color-mix(in srgb,var(--chart-done) 78%,white),var(--chart-done)); }
  .ns-chart-segment.is-pending { background:linear-gradient(180deg,color-mix(in srgb,var(--chart-pending) 78%,white),var(--chart-pending)); }
  .ns-chart-segment.is-locked { background:linear-gradient(180deg,color-mix(in srgb,var(--chart-locked) 75%,white),var(--chart-locked)); }
  .ns-chart-segment.is-hidden { display:none; }
  .ns-chart-column small { font-size:9px; line-height:1; text-transform:capitalize; white-space:nowrap; }
  .ns-chart-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:0 0 12px; }
  .ns-chart-stat { min-width:0; padding:9px 10px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); text-align:left; }
  .ns-chart-stat-action { width:100%; color:var(--ink); font:inherit; cursor:pointer; transition:transform .16s,box-shadow .18s,border-color .18s; }
  .ns-chart-stat-action:hover { transform:translateY(-1px); box-shadow:0 5px 12px rgba(36,51,45,.1); }
  .ns-chart-stat-action:focus-visible,.ns-legend-item:focus-visible,.ns-chart-calendar-link:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 42%,transparent); outline-offset:2px; }
  .ns-chart-stat-label { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:9px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
  .ns-chart-stat-label .ns-ui-icon { width:13px; height:13px; }
  .ns-chart-stat-value { display:block; overflow:hidden; margin-top:5px; color:var(--ink); font:600 17px/1.1 Georgia,serif; text-overflow:ellipsis; white-space:nowrap; }
  .ns-chart-stat.is-overdue { border-color:color-mix(in srgb,#ef4444 35%,var(--line)); background:color-mix(in srgb,#ef4444 7%,var(--surface)); }
  .ns-chart-stat.is-overdue .ns-chart-stat-label,.ns-chart-stat.is-overdue .ns-chart-stat-value { color:#dc2626; }
  .ns-chart-stat.is-peak .ns-chart-stat-value { color:var(--green-dark); font-size:12px; }
  .ns-chart-legend { display:flex; flex-wrap:wrap; gap:7px; margin-top:11px; color:var(--muted); font-size:10px; }
  .ns-legend-item { display:inline-flex; min-height:29px; align-items:center; gap:6px; padding:0 9px; border:1px solid var(--line); border-radius:99px; background:var(--surface-soft); color:var(--ink); font:600 10px 'DM Sans',sans-serif; cursor:pointer; transition:opacity .16s,border-color .16s,transform .16s,box-shadow .16s; }
  .ns-legend-item:hover { transform:translateY(-1px); box-shadow:0 4px 10px rgba(36,51,45,.1); }
  .ns-legend-item.is-hidden { opacity:.48; }
  .ns-legend-dot { width:9px; height:9px; flex:none; border-radius:50%; background:var(--chart-done); box-shadow:0 0 0 2px color-mix(in srgb,var(--chart-done) 18%,transparent); }
  .ns-legend-dot.is-pending { background:var(--chart-pending); box-shadow:0 0 0 2px color-mix(in srgb,var(--chart-pending) 18%,transparent); }
  .ns-legend-dot.is-locked { background:var(--chart-locked); box-shadow:0 0 0 2px color-mix(in srgb,var(--chart-locked) 18%,transparent); }
  .ns-legend-count { color:var(--muted); font-size:9px; font-variant-numeric:tabular-nums; }
  .ns-chart-detail { margin-top:12px; padding:11px 12px; border-radius:12px; background:#f8faf7; }
  .ns-chart-detail-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; }
  .ns-chart-detail h3 { margin:0; color:var(--ink); font-size:11px; }
  .ns-chart-calendar-link { min-height:30px; padding:0 9px; font-size:10px; }
  .ns-chart-calendar-link .ns-ui-icon { width:13px; height:13px; }
  .ns-chart-detail-list { display:grid; gap:6px; }
  .ns-chart-detail-item { display:flex; align-items:center; justify-content:space-between; gap:10px; color:var(--muted); font-size:10px; }
  .ns-chart-detail-item strong { color:var(--ink); font-weight:600; }
  .ns-chart-detail-item > span:last-child { display:inline-flex; align-items:center; gap:5px; flex:none; padding:4px 7px; border-radius:99px; background:color-mix(in srgb,var(--chart-done) 12%,var(--surface)); color:color-mix(in srgb,var(--chart-done) 80%,var(--ink)); font-size:9px; font-weight:700; }
  .ns-chart-detail-item > span:last-child.is-pending { background:color-mix(in srgb,var(--chart-pending) 15%,var(--surface)); color:color-mix(in srgb,var(--chart-pending) 78%,var(--ink)); }
  .ns-chart-detail-item > span:last-child.is-locked { background:color-mix(in srgb,var(--chart-locked) 15%,var(--surface)); color:color-mix(in srgb,var(--chart-locked) 78%,var(--ink)); }
  .ns-chart-detail-actions { display:flex; justify-content:flex-end; margin-top:9px; }
  .ns-chart-detail-actions .ns-button { min-height:31px; padding:0 9px; font-size:10px; }
  .ns-chart-detail-empty { margin:0; color:var(--muted); font-size:10px; }
  .ns-subject-progress { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .ns-subject-progress-button { min-width:0; padding:10px; border:1px solid var(--line); border-radius:12px; background:#fbfcfa; text-align:left; cursor:pointer; transition:border-color .18s,background .18s,transform .18s; }
  .ns-subject-progress-button:hover { transform:translateY(-1px); border-color:#c9d7ca; background:#f5f9f4; }
  .ns-subject-progress-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .ns-subject-progress-top strong { overflow:hidden; color:var(--ink); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
  .ns-subject-progress-top span { flex:none; color:var(--green-dark); font-size:10px; font-weight:700; }
  .ns-subject-progress-button .ns-progress-track { height:5px; margin-top:8px; }
  .ns-subject-progress-meta { display:block; margin-top:5px; color:var(--muted); font-size:9px; }
  .ns-site-footer { margin-top:14px; padding:12px 0 4px; border-top:1px solid var(--line); color:var(--muted); font-size:11px; text-align:center; }
  .ns-site-footer strong { color:var(--ink); font-weight:600; }
  .ns-dashboard-empty { grid-column:1/-1; padding:18px; border:1px dashed #d5ded3; border-radius:16px; color:var(--muted); text-align:center; font-size:12px; }
  .ns-calendar-layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,.8fr); gap:16px; align-items:start; }
  .ns-calendar-panel,.ns-calendar-detail { padding:22px; border:1px solid var(--line); border-radius:20px; background:white; box-shadow:0 12px 28px rgba(38,59,44,.045); }
  .ns-calendar-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:20px; }
  .ns-calendar-month { margin:0; color:var(--ink); font:600 clamp(18px,2vw,24px) Georgia,serif; text-transform:capitalize; }
  .ns-calendar-controls { display:flex; align-items:center; gap:7px; }
  .ns-calendar-controls .ns-icon-button { width:36px; min-height:36px; }
  .ns-calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; }
  .ns-calendar-weekday { padding:5px 0; color:var(--muted); text-align:center; font-size:10px; font-weight:700; text-transform:uppercase; }
  .ns-calendar-day { position:relative; display:flex; min-width:0; min-height:82px; flex-direction:column; align-items:flex-start; gap:8px; padding:9px; border:1px solid transparent; border-radius:13px; background:#fafbf9; color:var(--ink); text-align:left; cursor:pointer; transition:background .16s,border-color .16s,transform .16s; }
  .ns-calendar-day:hover { transform:translateY(-1px); border-color:#d6e2d5; background:#f4f8f3; }
  .ns-calendar-day.is-selected { border-color:var(--green); background:#edf4eb; box-shadow:inset 0 0 0 1px rgba(82,118,94,.08); }
  .ns-calendar-day.is-today .ns-calendar-day-number { color:var(--green-dark); font-weight:800; }
  .ns-calendar-day.is-outside { visibility:hidden; }
  .ns-calendar-day-number { font-size:12px; font-weight:600; }
  .ns-calendar-day-count { display:inline-flex; align-items:center; gap:4px; padding:3px 6px; border-radius:99px; background:#f5ece4; color:#8c603f; font-size:9px; font-weight:700; white-space:nowrap; }
  .ns-calendar-dots { display:flex; gap:3px; }
  .ns-calendar-dot { width:6px; height:6px; border-radius:50%; background:#d8a987; }
  .ns-calendar-dot.is-done { background:#6e9575; }
  .ns-calendar-dot.is-locked { background:#b5bdba; }
  .ns-calendar-legend { display:flex; flex-wrap:wrap; gap:12px; margin-top:14px; color:var(--muted); font-size:10px; }
  .ns-calendar-detail { position:sticky; top:18px; }
  .ns-calendar-detail-date { margin:0; color:var(--ink); font:600 20px Georgia,serif; text-transform:capitalize; }
  .ns-calendar-detail-subtitle { margin:5px 0 17px; color:var(--muted); font-size:11px; }
  .ns-calendar-task-list { display:grid; gap:9px; }
  .ns-calendar-task { padding:12px; border:1px solid var(--line); border-radius:13px; background:#fbfcfa; }
  .ns-calendar-task-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
  .ns-calendar-task-top strong { display:block; color:var(--ink); font-size:11px; line-height:1.4; }
  .ns-calendar-task-top span { display:block; margin-top:4px; color:var(--muted); font-size:10px; }
  .ns-calendar-task-badge { flex:none; padding:4px 7px; border-radius:99px; background:#edf2ec; color:var(--green-dark); font-size:9px; font-weight:700; }
  .ns-calendar-task-badge.is-late { background:var(--rose-soft); color:var(--rose); }
  .ns-calendar-task-badge.is-locked { background:#f0f1ef; color:#7a827d; }
  .ns-calendar-task .ns-button { width:100%; min-height:34px; margin-top:10px; padding:0 10px; font-size:11px; }
  .ns-weekly-plan { margin-bottom:18px; padding:17px; border:1px solid var(--line); border-radius:18px; background:linear-gradient(140deg,#fff,var(--paper)); }
  .ns-weekly-plan-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .ns-weekly-plan-header h2 { margin:0; color:var(--ink); font:600 17px Georgia,serif; }
  .ns-weekly-plan-header p { margin:4px 0 0; color:var(--muted); font-size:11px; }
  .ns-weekly-plan-controls { display:flex; align-items:center; gap:6px; }
  .ns-weekly-plan-controls .ns-icon-button { width:34px; min-height:34px; }
  .ns-weekly-form { display:grid; grid-template-columns:minmax(140px,1fr) minmax(180px,1.4fr) minmax(145px,.8fr) auto; gap:8px; margin-bottom:12px; }
  .ns-weekly-form .ns-input { min-width:0; padding:9px 10px; font-size:12px; }
  .ns-weekly-form .ns-button { min-height:40px; padding:0 12px; }
  .ns-weekly-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; }
  .ns-weekly-day { min-width:0; min-height:88px; padding:9px; border:1px solid var(--line); border-radius:11px; background:#fff; }
  .ns-weekly-day.is-today { border-color:var(--green); background:var(--green-soft); }
  .ns-weekly-day-heading { display:flex; justify-content:space-between; gap:4px; margin-bottom:7px; color:var(--ink); font-size:10px; font-weight:700; text-transform:capitalize; }
  .ns-weekly-day-heading span:last-child { color:var(--muted); font-weight:500; }
  .ns-weekly-day-empty { color:var(--muted); font-size:9px; }
  .ns-weekly-task-list { display:grid; gap:5px; }
  .ns-weekly-task { display:flex; align-items:flex-start; gap:4px; min-width:0; }
  .ns-weekly-task-toggle { display:flex; flex:1; min-width:0; align-items:flex-start; gap:5px; padding:0; border:0; background:transparent; color:var(--ink); text-align:left; font:500 10px/1.35 'DM Sans',sans-serif; cursor:pointer; }
  .ns-weekly-task-toggle > span:first-child { display:grid; width:15px; height:15px; flex:none; place-items:center; border:1px solid var(--line); border-radius:5px; color:transparent; font-size:10px; }
  .ns-weekly-task-toggle.is-done { color:var(--muted); text-decoration:line-through; }
  .ns-weekly-task-toggle.is-done > span:first-child { border-color:var(--green); background:var(--green); color:#fff; text-decoration:none; }
  .ns-weekly-task-copy { min-width:0; overflow-wrap:anywhere; }
  .ns-weekly-task-copy small { display:block; margin-top:2px; color:var(--muted); font-size:9px; text-decoration:none; }
  .ns-weekly-task-remove { flex:none; padding:0 2px; border:0; background:transparent; color:var(--muted); font-size:14px; cursor:pointer; }
  .ns-weekly-task-remove:hover { color:var(--rose); }
  .ns-profile-dialog { width:min(100%,430px); }
  .ns-profile-page { max-width:900px; }
  .ns-settings-page { max-width:780px; }
  .ns-profile-hero { display:flex; align-items:center; gap:15px; padding:20px; border:1px solid var(--line); border-radius:19px; background:linear-gradient(130deg,var(--surface),color-mix(in srgb,var(--green-soft) 68%,var(--surface))); box-shadow:0 10px 26px rgba(36,51,45,.07),0 2px 5px rgba(36,51,45,.035); }
  .ns-profile-page-avatar { width:76px; height:76px; border:3px solid var(--surface); font-size:28px; }
  .ns-profile-hero-copy { min-width:0; flex:1; }
  .ns-profile-eyebrow,.ns-contact-eyebrow { color:var(--green-dark); font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
  .ns-profile-hero-copy h2 { margin:3px 0; color:var(--ink); font:600 23px Georgia,serif; overflow-wrap:anywhere; }
  .ns-profile-hero-copy p { display:flex; align-items:center; gap:5px; margin:0; color:var(--muted); font-size:11px; }
  .ns-profile-hero-copy .ns-rank-badge { width:22px; height:22px; }
  .ns-profile-edit { flex:none; }
  .ns-profile-stat-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; margin:12px 0; }
  .ns-profile-stat { min-width:0; padding:13px; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:0 5px 15px rgba(36,51,45,.045); }
  .ns-profile-stat span { display:block; color:var(--muted); font-size:10px; line-height:1.35; }
  .ns-profile-stat strong { display:block; margin-top:7px; color:var(--ink); font:600 22px Georgia,serif; }
  .ns-profile-progress-panel { padding:17px; border:1px solid var(--line); border-radius:17px; background:var(--surface); box-shadow:0 8px 20px rgba(36,51,45,.05); }
  .ns-profile-progress-panel .ns-section-heading { margin-bottom:10px; }
  .ns-profile-progress-panel .ns-section-heading h2 { margin:0; color:var(--ink); font:600 17px Georgia,serif; }
  .ns-profile-progress-panel .ns-section-heading p { margin:4px 0 0; color:var(--muted); font-size:11px; }
  .ns-profile-progress-panel .ns-section-heading > strong { color:var(--green-dark); font:600 16px Georgia,serif; }
  .ns-profile-roadmap { max-height:280px; margin-top:14px; }
  .nourish-app .ns-contact-card { position:relative; isolation:isolate; display:grid; grid-template-columns:minmax(0,1fr) minmax(350px,.92fr); gap:clamp(24px,5vw,70px); align-items:center; min-height:500px; margin:16px 0 0; padding:clamp(28px,5vw,68px); overflow:hidden; border:1px solid rgba(220,207,255,.11); border-radius:28px 28px 0 0; background:radial-gradient(ellipse at 82% 33%,rgba(139,61,255,.14),transparent 32%),radial-gradient(ellipse at 98% 63%,rgba(255,79,154,.11),transparent 26%),radial-gradient(ellipse at 5% 10%,rgba(198,60,255,.09),transparent 35%),linear-gradient(126deg,#08090d 0%,#10121a 54%,#0d0c14 100%); -webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 78%,rgba(0,0,0,.88) 86%,rgba(0,0,0,.56) 93%,rgba(0,0,0,.18) 98%,transparent 100%); mask-image:linear-gradient(to bottom,#000 0%,#000 78%,rgba(0,0,0,.88) 86%,rgba(0,0,0,.56) 93%,rgba(0,0,0,.18) 98%,transparent 100%); box-shadow:0 28px 68px rgba(17,11,32,.22),0 0 54px rgba(139,61,255,.075); color:#f5f5f7; }
  .nourish-app .ns-contact-card::before { position:absolute; z-index:-1; inset:-1px; background:radial-gradient(circle at 13% 30%,rgba(255,79,154,.21),transparent 2px),radial-gradient(circle at 28% 72%,rgba(198,60,255,.22),transparent 2px),radial-gradient(circle at 67% 19%,rgba(255,138,61,.26),transparent 2px),radial-gradient(circle at 93% 26%,rgba(198,60,255,.24),transparent 2px),radial-gradient(ellipse at 86% 47%,rgba(255,79,154,.13),transparent 34%); pointer-events:none; content:""; }
  .nourish-app .ns-contact-card::after { display:none; }
  .nourish-app .ns-contact-copy { min-width:0; max-width:510px; }
  .nourish-app .ns-contact-eyebrow { display:inline-flex; align-items:center; gap:9px; color:#d8c7ff; font-size:10px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
  .nourish-app .ns-contact-eyebrow::before { width:7px; height:7px; border:1px solid #d8a8ff; border-radius:50%; content:""; box-shadow:0 0 12px rgba(198,60,255,.55); }
  .nourish-app .ns-contact-eyebrow .ns-ui-icon { display:none; }
  .nourish-app .ns-contact-copy h2 { max-width:530px; margin:22px 0 16px; color:#f5f5f7; font:600 clamp(36px,5vw,64px)/1.04 Georgia,serif; letter-spacing:-.045em; }
  .nourish-app .ns-contact-copy h2 span { background:linear-gradient(105deg,#ff83ad 4%,#c786ff 51%,#ffac69 95%); background-clip:text; -webkit-text-fill-color:transparent; }
  .nourish-app .ns-contact-copy p { max-width:430px; margin:0; color:#b7b5c2; font-size:14px; line-height:1.75; }
  .nourish-app .ns-contact-handle { display:inline-flex; align-items:center; gap:9px; margin-top:25px; color:#f2e9ff; font-size:13px; font-weight:600; text-decoration:none; transition:color .2s ease; }
  .nourish-app .ns-contact-handle:hover { color:#ff9bc0; }
  .nourish-app .ns-contact-handle .ns-ui-icon { width:18px; height:18px; color:#ff78ae; }
  .nourish-app .ns-contact-link { display:inline-flex; width:max-content; min-height:48px; align-items:center; gap:10px; margin:22px 0 0; padding:0 18px; border:1px solid rgba(255,255,255,.2); border-radius:14px; background:linear-gradient(105deg,#8b3dff 0%,#c63cff 43%,#ff4f9a 78%,#ff8a3d 112%); color:#fff; font-size:12px; text-decoration:none; box-shadow:0 8px 24px rgba(198,60,255,.2),inset 0 1px 0 rgba(255,255,255,.28); transition:transform .24s ease,box-shadow .24s ease,filter .24s ease; }
  .nourish-app .ns-contact-link:hover { transform:translateY(-2px) scale(1.025); border-color:rgba(255,255,255,.34); background:linear-gradient(105deg,#8b3dff 0%,#c63cff 43%,#ff4f9a 78%,#ff8a3d 112%); color:#fff; filter:saturate(1.12) brightness(1.06); box-shadow:0 12px 30px rgba(198,60,255,.28),0 0 24px rgba(255,79,154,.13),inset 0 1px 0 rgba(255,255,255,.32); }
  .nourish-app .ns-contact-link .ns-ui-icon { width:17px; height:17px; }
  .nourish-app .ns-instagram-preview { position:relative; z-index:0; min-width:0; overflow:hidden; padding:0 14px; border:1px solid rgba(230,219,255,.16); border-radius:21px; background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025)); box-shadow:0 22px 58px rgba(0,0,0,.3),0 0 46px rgba(198,60,255,.14),inset 0 1px 0 rgba(255,255,255,.09); -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); transition:transform .32s ease,border-color .32s ease,box-shadow .32s ease; }
  .nourish-app .ns-instagram-preview::before { position:absolute; z-index:-1; top:-40px; right:-55px; width:210px; height:210px; border-radius:50%; background:rgba(198,60,255,.19); filter:blur(64px); pointer-events:none; content:""; }
  .nourish-app .ns-instagram-preview:hover { transform:translateY(-4px); border-color:rgba(222,182,255,.3); box-shadow:0 28px 66px rgba(0,0,0,.34),0 0 54px rgba(198,60,255,.19),inset 0 1px 0 rgba(255,255,255,.12); }
  .nourish-app .ns-instagram-preview-header { display:flex; min-height:52px; align-items:center; justify-content:space-between; gap:8px; color:#aaa7b7; font-size:10px; }
  .nourish-app .ns-instagram-preview-header strong { display:inline-flex; align-items:center; gap:8px; color:#f5f5f7; font-size:11px; font-weight:600; }
  .nourish-app .ns-instagram-preview-header .ns-ui-icon { width:17px; height:17px; color:#ff76ad; }
  .nourish-app .ns-instagram-live { display:inline-flex; align-items:center; gap:7px; color:#c6c2d1; font-size:9px; font-weight:600; }
  .nourish-app .ns-instagram-live::before { width:7px; height:7px; border-radius:50%; background:#66dfa0; content:""; box-shadow:0 0 0 3px rgba(102,223,160,.12),0 0 10px rgba(102,223,160,.3); }
  .nourish-app .ns-instagram-feed { position:relative; height:368px; overflow:hidden; border-radius:13px 13px 8px 8px; background:#10121a; -webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 47%,rgba(0,0,0,.98) 56%,rgba(0,0,0,.9) 67%,rgba(0,0,0,.66) 79%,rgba(0,0,0,.3) 91%,transparent 100%); mask-image:linear-gradient(to bottom,#000 0%,#000 47%,rgba(0,0,0,.98) 56%,rgba(0,0,0,.9) 67%,rgba(0,0,0,.66) 79%,rgba(0,0,0,.3) 91%,transparent 100%); }
  .nourish-app .ns-instagram-fade { position:absolute; z-index:2; inset:39% 0 0; overflow:hidden; pointer-events:none; background:linear-gradient(to bottom,transparent 0%,rgba(8,9,13,.08) 17%,rgba(8,9,13,.24) 38%,rgba(8,9,13,.62) 72%,#0d0c14 100%); -webkit-mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.2) 18%,#000 48%,#000 100%); mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.2) 18%,#000 48%,#000 100%); opacity:.96; transition:opacity .32s ease; }
  .nourish-app .ns-instagram-fade::before,.nourish-app .ns-instagram-fade::after,.nourish-app .ns-instagram-fade-layer { position:absolute; inset:0; content:""; pointer-events:none; }
  .nourish-app .ns-instagram-fade::before { -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); -webkit-mask-image:linear-gradient(to bottom,transparent 0%,transparent 12%,#000 68%,#000 100%); mask-image:linear-gradient(to bottom,transparent 0%,transparent 12%,#000 68%,#000 100%); }
  .nourish-app .ns-instagram-fade::after { -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); -webkit-mask-image:linear-gradient(to bottom,transparent 0%,transparent 43%,rgba(0,0,0,.2) 62%,#000 100%); mask-image:linear-gradient(to bottom,transparent 0%,transparent 43%,rgba(0,0,0,.2) 62%,#000 100%); }
  .nourish-app .ns-instagram-fade-layer { -webkit-backdrop-filter:blur(9px); backdrop-filter:blur(9px); -webkit-mask-image:linear-gradient(to bottom,transparent 0%,transparent 66%,rgba(0,0,0,.18) 80%,#000 100%); mask-image:linear-gradient(to bottom,transparent 0%,transparent 66%,rgba(0,0,0,.18) 80%,#000 100%); }
  .nourish-app .ns-instagram-preview:hover .ns-instagram-fade { opacity:1; }
  .nourish-app .ns-instagram-frame { display:block; width:100%; height:500px; border:0; background:transparent; }
  .nourish-app .ns-instagram-fallback { position:relative; z-index:1; margin:0 -2px; padding:0 2px 13px; color:#9693a4; font-size:9px; line-height:1.5; }
  .nourish-app[data-mode="dark"] .ns-contact-card { border-color:rgba(220,207,255,.11); background:radial-gradient(ellipse at 82% 33%,rgba(139,61,255,.14),transparent 32%),radial-gradient(ellipse at 98% 63%,rgba(255,79,154,.11),transparent 26%),radial-gradient(ellipse at 5% 10%,rgba(198,60,255,.09),transparent 35%),linear-gradient(126deg,#08090d 0%,#10121a 54%,#0d0c14 100%); }
  .nourish-app[data-mode="dark"] .ns-instagram-feed { background:#10121a; }
  .nourish-app[data-mode="dark"] .ns-contact-card + .ns-section { background:linear-gradient(180deg,rgba(16,17,16,0),#101110 62px); }
  .nourish-app .ns-contact-card + .ns-section { position:relative; z-index:1; margin-top:-24px; padding-top:54px; background:linear-gradient(180deg,rgba(247,248,244,0),#f7f8f4 62px); }
  .nourish-app .ns-contact-card + .ns-section .ns-section-heading { padding-top:4px; }
  .nourish-app .ns-contact-card + .ns-section .ns-section-heading h2 { font:600 20px Georgia,serif; }
  .nourish-app .ns-contact-card + .ns-section .ns-muted { color:var(--muted); }
  @media (max-width:1100px) {
    .nourish-app .ns-contact-card { grid-template-columns:minmax(0,1fr); gap:24px; }
    .nourish-app .ns-contact-copy { max-width:620px; }
    .nourish-app .ns-instagram-preview { width:min(100%,520px); justify-self:center; }
  }
  @media (prefers-reduced-motion:reduce) {
    .nourish-app .ns-contact-link,.nourish-app .ns-instagram-preview { transition:none; }
    .nourish-app .ns-instagram-preview:hover,.nourish-app .ns-contact-link:hover { transform:none; }
  }
  .ns-settings-panel { padding:clamp(17px,3vw,25px); }
  .ns-settings-heading { display:flex; align-items:center; gap:11px; margin-bottom:12px; }
  .ns-settings-heading h2 { margin:0; color:var(--ink); font:600 18px Georgia,serif; }
  .ns-settings-heading p { margin:3px 0 0; color:var(--muted); font-size:11px; }
  .ns-setting-row { display:flex; min-height:70px; align-items:center; justify-content:space-between; gap:22px; padding:14px 0; border-top:1px solid var(--line); }
  .ns-setting-row > span { min-width:0; flex:1; }
  .ns-setting-row strong,.ns-setting-row small { display:block; }
  .ns-setting-row strong { color:var(--ink); font-size:12px; }
  .ns-setting-row small { margin-top:4px; color:var(--muted); font-size:10px; line-height:1.45; }
  .ns-input.ns-setting-select { width:min(220px,40%); min-width:170px; flex:none; padding:10px 12px; border-color:var(--line); background-color:var(--surface-soft); cursor:pointer; }
  .ns-setting-switch { display:flex; width:46px; height:26px; flex:none; align-items:center; padding:3px; border:1px solid var(--line); border-radius:99px; background:var(--surface-soft); cursor:pointer; transition:background .18s,border-color .18s; }
  .ns-setting-switch > span { width:18px; height:18px; border-radius:50%; background:var(--muted); box-shadow:0 1px 3px rgba(0,0,0,.2); transition:transform .18s,background .18s; }
  .ns-setting-switch.is-active { border-color:var(--green); background:var(--green); }
  .ns-setting-switch.is-active > span { transform:translateX(19px); background:#fff; }
  .ns-setting-switch:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 42%,transparent); outline-offset:2px; }
  .ns-settings-note { display:flex; align-items:center; gap:6px; margin:10px 2px; color:var(--muted); font-size:10px; }
  .ns-settings-note .ns-ui-icon { width:14px; height:14px; color:var(--green-dark); }
  .ns-developer-card { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:22px; padding:16px; border:1px solid var(--line); border-radius:16px; background:linear-gradient(120deg,color-mix(in srgb,var(--green-soft) 58%,var(--surface)),var(--surface) 70%); }
  .ns-developer-copy { min-width:0; }
  .ns-developer-copy small,.ns-developer-copy strong { display:block; }
  .ns-developer-copy small { margin-bottom:5px; color:var(--green-dark); font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
  .ns-developer-copy strong { color:var(--ink); font:600 16px Georgia,serif; }
  .ns-developer-copy p { margin:4px 0 0; color:var(--muted); font-size:10px; line-height:1.45; }
  .ns-developer-link { display:inline-flex; min-height:38px; flex:none; align-items:center; justify-content:center; gap:7px; padding:0 12px; border:1px solid color-mix(in srgb,var(--green) 28%,var(--line)); border-radius:11px; background:var(--surface); color:var(--green-dark); font-size:10px; font-weight:700; text-decoration:none; transition:background .18s,border-color .18s,transform .18s,box-shadow .18s; }
  .ns-developer-link:hover { transform:translateY(-1px); border-color:var(--green); background:var(--green-soft); box-shadow:0 5px 14px color-mix(in srgb,var(--green) 13%,transparent); }
  .ns-developer-link .ns-ui-icon { width:14px; height:14px; }
  .ns-developer-link:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 48%,transparent); outline-offset:3px; }
  .ns-settings-theme-link { display:flex; width:100%; min-height:62px; align-items:center; gap:12px; margin-top:12px; padding:10px 13px; border:1px solid var(--line); border-radius:14px; background:var(--surface); color:var(--ink); text-align:left; cursor:pointer; transition:border-color .18s,transform .18s,box-shadow .18s; }
  .ns-settings-theme-link:hover { transform:translateY(-1px); border-color:color-mix(in srgb,var(--green) 45%,var(--line)); box-shadow:0 6px 16px rgba(36,51,45,.07); }
  .ns-settings-theme-link > .ns-theme-mode-icon { width:38px; height:38px; color:var(--green-dark); }
  .ns-settings-theme-link-copy { display:grid; min-width:0; flex:1; gap:3px; }
  .ns-settings-theme-link-copy strong { font-size:11px; }
  .ns-settings-theme-link-copy small { color:var(--muted); font-size:10px; }
  .ns-settings-theme-link > .ns-ui-icon { width:17px; height:17px; color:var(--green); }
  .ns-settings-theme-link:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 48%,transparent); outline-offset:3px; }
  .ns-profile-photo-choice { display:flex; align-items:center; gap:14px; }
  .ns-profile-photo-choice .ns-avatar { width:68px; height:68px; font-size:23px; }
  .ns-profile-photo-actions { display:grid; gap:7px; }
  .ns-profile-photo-actions input { display:none; }
  .ns-rank-summary { padding:16px; border-radius:15px; background:#f4f8f2; }
  .ns-rank-summary strong { color:var(--green-dark); font:600 18px Georgia,serif; }
  .ns-rank-summary p { margin:5px 0 0; color:var(--muted); font-size:11px; line-height:1.5; }
  .ns-rank-summary .ns-progress-track { margin-top:12px; }
  .ns-rank-roadmap { display:grid; gap:7px; max-height:180px; overflow:auto; }
  .ns-rank-roadmap-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border:1px solid var(--line); border-radius:10px; color:var(--muted); font-size:10px; }
  .ns-rank-roadmap-item.is-current { border-color:var(--green); background:var(--green-soft); color:var(--green-dark); font-weight:700; }
  .ns-rank-roadmap-item > span:first-child { display:inline-flex; min-width:0; align-items:center; gap:5px; }
  .ns-rank-badge { display:inline-grid; flex:none; width:40px; height:40px; place-items:center; color:var(--badge-color); filter:drop-shadow(0 3px 5px color-mix(in srgb,var(--badge-color) 24%,transparent)); vertical-align:middle; transition:filter .2s,transform .2s; }
  .ns-rank-badge:hover { transform:translateY(-2px) scale(1.04); filter:drop-shadow(0 5px 8px color-mix(in srgb,var(--badge-color) 38%,transparent)); }
  .ns-rank-badge.is-small { width:25px; height:25px; }
  .ns-rank-badge.is-large { width:78px; height:78px; }
  .ns-rank-badge svg { display:block; width:100%; height:100%; overflow:visible; }
  .ns-rank-badge-ribbon { fill:color-mix(in srgb,var(--badge-color) 70%,#242c27); stroke:color-mix(in srgb,var(--badge-color) 82%,white); stroke-width:1; stroke-linejoin:round; }
  .ns-rank-badge-ground { fill:color-mix(in srgb,var(--badge-color) 20%,#fff); stroke:color-mix(in srgb,var(--badge-color) 58%,white); stroke-width:1.4; stroke-linejoin:round; }
  .ns-rank-badge-inner { fill:color-mix(in srgb,var(--badge-color) 13%,white); stroke:color-mix(in srgb,var(--badge-color) 55%,white); stroke-width:.8; stroke-linejoin:round; }
  .ns-rank-badge-ring { fill:none; stroke:var(--badge-color); stroke-width:1.5; }
  .ns-rank-badge-fruit { fill:var(--badge-color); }
  .ns-rank-badge-leaf { fill:color-mix(in srgb,var(--badge-color) 68%,#547b4e); }
  .ns-rank-badge-vein,.ns-rank-badge-stem { fill:none; stroke:#fff; stroke-linecap:round; stroke-width:1.6; }
  .ns-rank-badge-highlight { fill:none; stroke:color-mix(in srgb,var(--badge-color) 42%,white); stroke-linecap:round; stroke-width:1.7; }
  .ns-rank-badge-dot { fill:color-mix(in srgb,var(--badge-color) 65%,white); }
  .nourish-app[data-mode="dark"] .ns-rank-badge-ground { fill:color-mix(in srgb,var(--badge-color) 32%,#171917); }
  .nourish-app[data-mode="dark"] .ns-rank-badge-inner { fill:color-mix(in srgb,var(--badge-color) 19%,#1d201d); }
  .ns-palette-section { display:grid; gap:9px; }
  .ns-palette-section h3 { margin:0; color:var(--ink); font:600 14px Georgia,serif; }
  .ns-palette-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; }
  .ns-palette-option { display:flex; align-items:center; gap:8px; min-height:42px; padding:7px 9px; border:1px solid var(--line); border-radius:11px; background:white; color:var(--muted); font:600 10px 'DM Sans',sans-serif; text-align:left; cursor:pointer; }
  .ns-palette-option.is-active { border-color:var(--green); background:var(--green-soft); color:var(--green-dark); box-shadow:0 0 0 1px var(--green); }
  .ns-palette-swatches { display:flex; flex:none; }
  .ns-palette-swatches i { width:13px; height:20px; border:1px solid #ffffffaa; border-radius:5px; margin-left:-3px; }
  .ns-themes-page { max-width:850px; }
  .ns-theme-panel { padding:20px; border:1px solid var(--line); border-radius:18px; background:var(--surface,#fff); box-shadow:0 10px 24px rgba(38,59,44,.04); }
  .ns-theme-panel + .ns-theme-panel { margin-top:14px; }
  .ns-theme-panel h2 { margin:0; color:var(--ink); font:600 18px Georgia,serif; }
  .ns-theme-panel > p { margin:5px 0 14px; color:var(--muted); font-size:12px; }
  .ns-theme-modes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
  .ns-theme-mode { display:flex; min-height:72px; align-items:center; gap:12px; padding:12px; border:1px solid var(--line); border-radius:13px; background:var(--surface-soft,#fafbf8); color:var(--ink); text-align:left; cursor:pointer; }
  .ns-theme-mode.is-active { border-color:var(--green); background:var(--green-soft); box-shadow:inset 0 0 0 1px var(--green); }
  .ns-theme-mode-icon { display:grid; width:38px; height:38px; flex:none; place-items:center; border-radius:12px; background:var(--surface,#fff); font-size:20px; }
  .ns-theme-mode-icon .ns-ui-icon { width:20px; height:20px; }
  .ns-theme-mode strong,.ns-theme-mode small { display:block; }
  .ns-theme-mode strong { font-size:12px; }
  .ns-theme-mode small { margin-top:3px; color:var(--muted); font-size:10px; }
  .nourish-app[data-mode="dark"] .ns-theme-panel,
  .nourish-app[data-mode="dark"] .ns-theme-mode-icon { background:var(--surface); }
  .nourish-app[data-mode="dark"] .ns-theme-mode { background:var(--surface-soft); border-color:var(--line); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-theme-mode.is-active { background:var(--green-soft); border-color:var(--green); }
  .ns-section { margin:24px 0; }
  .ns-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .ns-section-heading h2 { margin:0; color:var(--ink); font:600 19px Georgia,serif; }
  .ns-muted { color:var(--muted); font-size:12px; }
  .ns-list { display:grid; gap:12px; }
  .ns-card { background:white; border:1px solid var(--line); border-radius:18px; padding:19px; box-shadow:0 10px 24px rgba(38,59,44,.04); transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
  .ns-card:hover { transform:translateY(-2px); box-shadow:0 14px 26px rgba(38,59,44,.06); border-color:#d5dfd4; }
  .ns-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
  .ns-subject { display:inline-block; color:var(--green-dark); background:var(--green-soft); border-radius:99px; padding:5px 10px; font-size:11px; font-weight:700; }
  .ns-card-title { margin:10px 0 4px; font:600 17px/1.35 Georgia,serif; }
  .ns-card-date { margin:0; color:var(--muted); font-size:12px; }
  .ns-delete { flex:none; border:0; background:transparent; color:#9da79f; padding:8px; border-radius:10px; cursor:pointer; font-size:17px; }
  .ns-delete:hover { color:var(--rose); background:var(--rose-soft); }
  .ns-checks { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; }
  .ns-check { display:inline-flex; align-items:center; gap:8px; border:1px solid var(--line); color:var(--muted); background:white; border-radius:12px; padding:8px 12px; font:600 11px 'DM Sans',sans-serif; cursor:pointer; transition:all .18s ease; }
  .ns-check:hover { border-color:#c9d7ca; background:#f7faf6; }
  .ns-check-indicator { width:18px; height:18px; display:grid; place-items:center; border-radius:50%; background:#edf2ec; color:transparent; border:1px solid transparent; font-size:11px; font-weight:700; }
  .ns-check.is-done { border-color:#cfdfcd; background:var(--green-soft); color:var(--green-dark); }
  .ns-check.is-done .ns-check-indicator { background:var(--green-dark); color:white; border-color:var(--green-dark); }
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
  .ns-nav-button { display:flex; min-width:70px; flex-direction:column; align-items:center; gap:4px; padding:7px 10px; border:0; border-radius:12px; background:transparent; color:var(--muted); font:600 10px 'DM Sans',sans-serif; cursor:pointer; transition:all .18s ease; }
  .ns-nav-button span:first-child { font-size:18px; }
  .ns-nav-button.is-active { color:var(--green-dark); background:linear-gradient(180deg,var(--green-soft) 0%,var(--paper) 100%); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 12%,transparent); }
  .ns-fab { position:fixed; z-index:6; right:28px; bottom:26px; display:flex; align-items:center; gap:10px; min-height:54px; padding:0 18px 0 12px; border:1px solid color-mix(in srgb,var(--green) 70%,white); border-radius:18px; background:linear-gradient(135deg,var(--green) 0%,var(--green-dark) 100%); color:white; box-shadow:0 10px 26px color-mix(in srgb,var(--green-dark) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.24); font:600 13px 'DM Sans',sans-serif; cursor:pointer; transition:transform .18s ease,box-shadow .18s ease,filter .18s ease; }
  .ns-fab span:first-child { display:grid; width:28px; height:28px; flex:none; place-items:center; border:1px solid rgba(255,255,255,.28); border-radius:50%; background:rgba(255,255,255,.15); color:inherit; font-size:21px; line-height:1; }
  .ns-fab span:last-child { letter-spacing:.01em; }
  .ns-fab:hover { transform:translateY(-2px); filter:brightness(1.06); box-shadow:0 15px 32px color-mix(in srgb,var(--green-dark) 38%,transparent),inset 0 1px 0 rgba(255,255,255,.3); }
  .ns-fab:active { transform:translateY(0) scale(.98); }
  .ns-fab:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 48%,transparent); outline-offset:3px; }
  .nourish-app[data-mode="dark"] .ns-fab { border-color:color-mix(in srgb,var(--green) 58%,#424642); background-color:#20251f; background-image:linear-gradient(125deg,color-mix(in srgb,var(--green) 44%,#292d28) 0%,color-mix(in srgb,var(--green) 32%,#1b1e1a) 52%,color-mix(in srgb,var(--green) 48%,#101210) 100%); color:#f5f7f1; box-shadow:0 12px 30px color-mix(in srgb,var(--green) 20%,rgba(0,0,0,.55)),inset 0 1px 0 rgba(255,255,255,.16); }
  .nourish-app[data-mode="dark"] .ns-fab span:first-child { border-color:color-mix(in srgb,var(--green) 55%,transparent); background:color-mix(in srgb,var(--green) 24%,#222522); color:var(--green); }
  .nourish-app[data-mode="dark"] .ns-fab:hover { filter:brightness(1.14); box-shadow:0 16px 34px rgba(0,0,0,.5),0 0 0 1px color-mix(in srgb,var(--green) 30%,transparent); }
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
  @media (max-width:900px) {
    .ns-sidebar { position:fixed; left:0; top:0; width:min(290px,84vw); height:100dvh; transform:translateX(-105%); box-shadow:12px 0 35px rgba(21,38,27,.12); }
    .ns-workspace.mobile-nav-open .ns-sidebar { transform:translateX(0); }
    .ns-workspace.is-collapsed .ns-sidebar { width:min(290px,84vw); padding:22px 15px 16px; }
    .ns-sidebar-backdrop { position:fixed; z-index:7; inset:0; display:block; border:0; background:rgba(23,37,28,.35); }
    .ns-main-shell { padding:20px clamp(14px,3vw,28px) 40px; }
    .ns-mobile-menu { display:inline-grid; width:36px; height:36px; flex:none; place-items:center; border:1px solid var(--line); border-radius:10px; background:white; color:var(--ink); font-size:17px; cursor:pointer; }
    .ns-sidebar-collapse { display:none; }
    .ns-workspace.is-collapsed .ns-sidebar-brand-copy,
    .ns-workspace.is-collapsed .ns-profile-copy,
    .ns-workspace.is-collapsed .ns-sidebar-nav .ns-nav-button span:last-child { display:initial; }
    .ns-workspace.is-collapsed .ns-sidebar-nav .ns-nav-button { justify-content:flex-start; }
  }
  @media (min-width:901px) {
    .ns-workspace.is-collapsed .ns-sidebar-brand { justify-content:center; padding-right:0; padding-left:0; }
    .ns-workspace.is-collapsed .ns-sidebar-brand-copy,
    .ns-workspace.is-collapsed .ns-profile-copy,
    .ns-workspace.is-collapsed .ns-sidebar-nav .ns-nav-button span:last-child { display:none; }
    .ns-workspace.is-collapsed .ns-sidebar-profile { justify-content:center; padding:10px 4px; }
    .ns-workspace.is-collapsed .ns-sidebar-nav .ns-nav-button { justify-content:center; padding:0; }
    .ns-workspace.is-collapsed .ns-sidebar-collapse { font-size:0; }
    .ns-workspace.is-collapsed .ns-sidebar-collapse .ns-ui-icon { width:18px; height:18px; }
  }
  @media (max-width:1000px) {
    .ns-dashboard-card:first-child,.ns-dashboard-card:nth-child(2) { grid-column:span 6; }
  }
  @media (max-width:700px) {
    .ns-main-shell { padding:16px 14px 34px; }
    .ns-header { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px 10px; margin-bottom:20px; }
    .ns-header-start { display:contents; }
    .ns-header-start .ns-brand { display:flex; grid-column:1; grid-row:1; min-width:0; max-width:100%; gap:8px; }
    .ns-page-nav { display:flex; grid-column:1/-1; grid-row:2; min-width:0; padding:1px 1px 0; }
    .ns-page-nav h1 { font-size:25px; }
    .ns-page-nav p { margin-top:3px; font-size:11px; }
    .ns-header-profile { display:inline-flex; align-items:center; justify-content:center; padding:0; border:0; border-radius:50%; background:transparent; cursor:pointer; }
    .ns-header-profile .ns-avatar { width:38px; height:38px; }
    .ns-title { font-size:19px; }
    .ns-kicker { font-size:8px; letter-spacing:.12em; }
    .ns-mark { width:40px; height:40px; border-radius:13px; }
    .ns-actions { grid-column:2; grid-row:1; width:auto; min-width:0; justify-content:flex-end; flex-wrap:nowrap; gap:7px; }
    .ns-header-search { grid-column:1/-1; grid-row:3; }
    .ns-header.is-home .ns-actions { grid-column:1/-1; grid-row:3; }
    .ns-header.is-home .ns-header-search { grid-row:4; }
    .ns-button, .ns-file-label { flex:1 1 0; min-height:40px; }
    .ns-header-action { min-width:0; padding-right:8px; padding-left:8px; }
    .ns-file-label { min-width:0; }
    .ns-icon-button, .ns-file-label { min-height:40px; }
    .ns-intro { padding:21px; }
    .ns-metrics { grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr)); gap:9px; }
    .ns-metric { min-height:100px; padding:14px; }
    .ns-metric-value { font-size:25px; margin-top:10px; }
    .ns-dashboard { grid-template-columns:minmax(0,1fr); gap:10px; margin:18px 0 24px; }
    .ns-dashboard-card:first-child,.ns-dashboard-card:nth-child(2),.ns-dashboard-card:nth-child(3) { grid-column:1/-1; }
    .ns-dashboard-card { padding:14px; }
    .ns-weekly-plan { padding:15px; border-radius:17px; }
    .ns-weekly-plan-header { display:grid; grid-template-columns:minmax(0,1fr); gap:11px; margin-bottom:13px; }
    .ns-weekly-plan-header > div:first-child { min-width:0; }
    .ns-weekly-plan-header h2 { max-width:25ch; font-size:17px; line-height:1.25; }
    .ns-weekly-plan-header p { font-size:10px; line-height:1.45; }
    .ns-weekly-plan-controls { display:grid; grid-template-columns:38px minmax(0,1fr) 38px; gap:7px; width:100%; }
    .ns-weekly-plan-controls .ns-icon-button { width:38px; min-height:38px; }
    .ns-weekly-plan-controls .ns-button { min-height:38px; }
    .ns-weekly-form { grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; margin-bottom:14px; }
    .ns-weekly-form input:first-child,.ns-weekly-form input:nth-of-type(2) { grid-column:1/-1; }
    .ns-weekly-form input:nth-of-type(3) { width:100%; }
    .ns-weekly-form .ns-button { grid-column:auto; min-width:0; gap:5px; padding:0 8px; font-size:11px; }
    .ns-weekly-days { grid-template-columns:minmax(0,1fr); gap:6px; }
    .ns-weekly-day { display:grid; grid-template-columns:58px minmax(0,1fr); align-items:center; column-gap:11px; min-height:52px; padding:7px 9px; border-radius:12px; }
    .ns-weekly-day-heading { grid-row:1; flex-direction:column; align-items:center; justify-content:center; gap:1px; min-height:36px; margin:0; padding-right:9px; border-right:1px solid var(--line); font-size:9px; line-height:1.2; }
    .ns-weekly-day-heading span:last-child { color:var(--ink); font-size:13px; font-weight:700; }
    .ns-weekly-day-empty,.ns-weekly-task-list { grid-column:2; }
    .ns-weekly-day-empty { font-size:10px; }
    .ns-weekly-task-list { width:100%; gap:4px; }
    .ns-weekly-task { align-items:center; gap:7px; }
    .ns-weekly-task-toggle { align-items:center; gap:7px; font-size:11px; }
    .ns-weekly-task-toggle > span:first-child { width:18px; height:18px; }
    .ns-weekly-task-copy small { font-size:9px; }
    .ns-weekly-task-remove { min-width:28px; min-height:28px; }
    .ns-dashboard-heading { margin-bottom:12px; }
    .ns-dashboard-heading h2 { font-size:16px; }
    .ns-dashboard-heading p { font-size:10px; }
    .ns-chart-summary { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
    .ns-chart-stat { padding:8px; }
    .ns-chart-detail-item { align-items:flex-start; }
    .ns-profile-hero { display:grid; grid-template-columns:54px minmax(0,1fr); align-items:center; gap:10px 12px; padding:14px; }
    .ns-profile-page-avatar { width:54px; height:54px; font-size:21px; }
    .ns-profile-hero-copy { align-self:center; }
    .ns-profile-hero-copy h2 { font-size:20px; }
    .ns-profile-hero-copy p { flex-wrap:wrap; align-items:center; line-height:1.4; }
    .ns-profile-hero-copy .ns-rank-badge { flex:none; }
    .ns-profile-edit { grid-column:1/-1; width:100%; min-height:40px; }
    .ns-profile-stat-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
    .ns-profile-stat { padding:10px; }
    .nourish-app .ns-contact-card { grid-template-columns:minmax(0,1fr); gap:24px; min-height:0; margin-top:10px; padding:27px 20px 26px; border-radius:22px 22px 0 0; }
    .nourish-app .ns-contact-copy h2 { margin:17px 0 12px; font-size:clamp(38px,10vw,52px); }
    .nourish-app .ns-contact-copy p { font-size:13px; }
    .nourish-app .ns-contact-handle { margin-top:20px; }
    .nourish-app .ns-contact-link { width:max-content; min-height:48px; margin-top:17px; }
    .nourish-app .ns-instagram-preview { margin:0 -8px; padding:0 11px; border-radius:18px; }
    .nourish-app .ns-instagram-preview-header { min-height:48px; }
    .nourish-app .ns-instagram-feed { height:310px; margin:0 -2px; }
    .nourish-app .ns-instagram-fade { inset:35% 0 0; }
    .nourish-app .ns-instagram-frame { height:460px; }
    .nourish-app .ns-instagram-fallback { padding-bottom:12px; font-size:9px; }
    .ns-setting-row { align-items:flex-start; flex-direction:column; gap:10px; }
    .ns-input.ns-setting-select { width:100%; min-width:0; }
    .ns-subject-progress { grid-template-columns:repeat(auto-fit,minmax(min(100%,135px),1fr)); gap:8px; }
    .ns-subject-progress-button { padding:9px; }
    .ns-home-actions { grid-template-columns:1fr; gap:9px; }
    .ns-history-card { align-items:flex-start; }
    .ns-dialog { padding:19px; }
    .ns-calendar-layout { grid-template-columns:1fr; }
    .ns-calendar-panel,.ns-calendar-detail { padding:15px; }
    .ns-calendar-day { min-height:60px; gap:6px; padding:7px 5px; }
    .ns-calendar-grid { gap:4px; }
    .ns-calendar-day-count { padding:2px 4px; font-size:8px; }
    .ns-calendar-detail { position:static; }
    .ns-fab { right:16px; bottom:16px; min-height:50px; padding:0 15px 0 10px; }
  }
  @media (max-width:520px) {
    .ns-setting-row { gap:9px; }
    .ns-setting-switch { align-self:flex-end; margin-top:-2px; }
    .ns-chart-heading { align-items:flex-start; flex-wrap:wrap; }
    .ns-chart-heading .ns-range-switch { margin-left:auto; }
    .ns-theme-panel { padding:15px; }
    .ns-theme-modes { grid-template-columns:1fr; gap:7px; }
    .ns-theme-mode { min-height:62px; padding:10px; }
    .ns-theme-mode small { line-height:1.35; }
    .ns-palette-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .ns-palette-option { min-width:0; padding:7px; }
    .ns-palette-swatches i { flex:none; }
    .ns-calendar-day { min-height:58px; gap:4px; padding:6px 4px; overflow:hidden; }
    .ns-calendar-day-count { max-width:100%; overflow:hidden; padding:2px 4px; font-size:7px; text-overflow:ellipsis; }
    .ns-calendar-dots { gap:2px; }
    .nourish-app .ns-contact-card { padding-right:17px; padding-left:17px; }
    .nourish-app .ns-contact-copy h2 { max-width:340px; }
    .nourish-app .ns-contact-copy p { font-size:12px; }
    .nourish-app .ns-instagram-preview { margin-right:-11px; margin-left:-11px; padding-right:9px; padding-left:9px; }
    .nourish-app .ns-instagram-feed { height:290px; }
    .nourish-app .ns-instagram-fade { inset:33% 0 0; }
    .nourish-app .ns-instagram-frame { height:440px; }
  }
  @media (max-width:380px) {
    .ns-main-shell { padding-right:11px; padding-left:11px; }
    .ns-intro { padding:17px; }
    .ns-calendar-day-count { display:none; }
    .ns-progress-overview { gap:12px; }
    .ns-progress-ring { width:84px; height:84px; }
    .ns-progress-ring::before { inset:7px; }
    .ns-progress-ring strong { font-size:19px; }
    .ns-dashboard-heading h2 { font-size:15px; }
    .ns-chart-detail-heading { align-items:flex-start; flex-direction:column; }
    .ns-metrics { grid-template-columns:minmax(0,1fr); }
    .ns-metric { min-height:88px; }
    .ns-progress-overview { align-items:flex-start; }
    .ns-progress-ring { width:72px; height:72px; }
    .ns-progress-ring::before { inset:7px; }
    .ns-progress-ring strong { font-size:17px; }
    .ns-progress-copy strong { font-size:12px; }
    .ns-progress-copy span { font-size:10px; }
    .ns-calendar-weekday { font-size:8px; }
    .ns-calendar-day { min-height:51px; padding:6px 3px; }
    .ns-calendar-dot { width:5px; height:5px; }
  }
  .ns-card,.ns-dashboard-card,.ns-calendar-panel,.ns-calendar-detail,.ns-theme-panel,.ns-weekly-plan,.ns-home-action-card,.ns-intro { box-shadow:0 10px 26px rgba(36,51,45,.07),0 2px 5px rgba(36,51,45,.035); }
  .ns-card:hover,.ns-dashboard-card:hover,.ns-calendar-panel:hover,.ns-calendar-detail:hover,.ns-theme-panel:hover,.ns-weekly-plan:hover { box-shadow:0 16px 34px rgba(36,51,45,.1),0 3px 8px rgba(36,51,45,.045); }
  .ns-button,.ns-icon-button,.ns-check,.ns-filter,.ns-revision,.ns-calendar-day,.ns-palette-option,.ns-theme-mode,.ns-mobile-menu,.ns-sidebar-collapse,.ns-nav-button,.ns-range-button,.ns-chart-column,.ns-subject-progress-button { box-shadow:0 2px 5px rgba(36,51,45,.055),inset 0 1px 0 rgba(255,255,255,.5); transition:transform .16s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease; }
  .ns-button:hover,.ns-icon-button:hover,.ns-check:hover,.ns-filter:hover,.ns-revision:hover,.ns-calendar-day:hover,.ns-palette-option:hover,.ns-theme-mode:hover,.ns-mobile-menu:hover,.ns-sidebar-collapse:hover,.ns-nav-button:hover,.ns-range-button:hover,.ns-chart-column:hover,.ns-subject-progress-button:hover { box-shadow:0 5px 12px rgba(36,51,45,.12),inset 0 1px 0 rgba(255,255,255,.45); }
  .ns-button:active,.ns-icon-button:active,.ns-check:active,.ns-filter:active,.ns-revision:active,.ns-calendar-day:active,.ns-palette-option:active,.ns-theme-mode:active,.ns-mobile-menu:active,.ns-sidebar-collapse:active,.ns-nav-button:active,.ns-range-button:active,.ns-chart-column:active,.ns-subject-progress-button:active { transform:translateY(1px); }
  .ns-delete { display:grid; width:32px; height:32px; place-items:center; border-radius:10px; transition:background .16s,color .16s,box-shadow .16s; }
  .ns-weekly-task-remove { display:grid; width:22px; height:22px; place-items:center; border-radius:7px; transition:background .16s,color .16s,box-shadow .16s; }
  .ns-delete:hover,.ns-weekly-task-remove:hover { box-shadow:0 4px 10px rgba(36,51,45,.12); }
  .ns-weekly-task-toggle > span:first-child { box-shadow:0 1px 3px rgba(36,51,45,.12),inset 0 1px 0 rgba(255,255,255,.35); }
  .ns-nav-button.is-active { box-shadow:0 3px 10px color-mix(in srgb,var(--green) 15%,transparent),inset 0 0 0 1px color-mix(in srgb,var(--green) 20%,transparent); }
  .ns-sidebar-profile { box-shadow:0 4px 12px rgba(36,51,45,.055); transition:transform .18s,box-shadow .18s,border-color .18s; }
  .ns-sidebar-profile:hover { transform:translateY(-1px); box-shadow:0 8px 18px rgba(36,51,45,.11); border-color:color-mix(in srgb,var(--green) 35%,var(--line)); }
  .ns-button-primary,.ns-fab { box-shadow:0 5px 14px color-mix(in srgb,var(--green-dark) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.25); }
  .ns-button-primary:hover,.ns-fab:hover { box-shadow:0 9px 20px color-mix(in srgb,var(--green-dark) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.32); }
  .ns-header-action { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-color:color-mix(in srgb,var(--green) 20%,var(--line)); background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--green-soft) 68%,var(--surface))); box-shadow:0 3px 9px rgba(36,51,45,.07),inset 0 1px 0 rgba(255,255,255,.65); }
  .ns-header-action .ns-ui-icon { width:16px; height:16px; color:var(--green-dark); }
  .ns-header-action:hover { border-color:color-mix(in srgb,var(--green) 55%,var(--line)); background:linear-gradient(135deg,var(--green-soft),var(--surface)); }
  .nourish-app[data-mode="dark"] .ns-header-action { background:linear-gradient(135deg,#262a26,var(--surface)); border-color:color-mix(in srgb,var(--green) 25%,var(--line)); box-shadow:0 3px 10px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06); }
  .nourish-app[data-mode="dark"] .ns-header-action .ns-ui-icon { color:var(--green); }
  .nourish-app[data-mode="dark"] .ns-header-action:hover { background:linear-gradient(135deg,var(--green-soft),#202320); border-color:var(--green); }
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-completed { background:linear-gradient(180deg,#6ee7b7,#10b981); }
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-pending { background:linear-gradient(180deg,#fde68a,#f59e0b); }
  .nourish-app[data-mode="dark"] .ns-chart-segment.is-locked { background:linear-gradient(180deg,#c4b5fd,#8b5cf6); }
  .nourish-app[data-mode="dark"] .ns-legend-dot { background:#34d399; }
  .nourish-app[data-mode="dark"] .ns-legend-dot.is-pending { background:#fbbf24; }
  .nourish-app[data-mode="dark"] .ns-legend-dot.is-locked { background:#a78bfa; }
  .nourish-app[data-mode="dark"] .ns-chart-stat.is-overdue { background:#3a2525; border-color:#713b3b; }
  .nourish-app[data-mode="dark"] .ns-chart-stat.is-overdue .ns-chart-stat-label,
  .nourish-app[data-mode="dark"] .ns-chart-stat.is-overdue .ns-chart-stat-value { color:#ff8b83; }
  .nourish-app[data-mode="dark"] .ns-chart-detail-item > span:last-child { background:#173a30; color:#6ee7b7; }
  .nourish-app[data-mode="dark"] .ns-chart-detail-item > span:last-child.is-pending { background:#44351b; color:#fcd34d; }
  .nourish-app[data-mode="dark"] .ns-chart-detail-item > span:last-child.is-locked { background:#34274b; color:#c4b5fd; }
  .ns-chart-summary { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .ns-profile-name-row { display:flex; min-width:0; align-items:center; gap:5px; }
  .ns-profile-name-row strong { min-width:0; }
  .ns-profile-name-row .ns-rank-badge { width:21px; height:21px; }
  .nourish-app[data-mode="dark"] .ns-card,
  .nourish-app[data-mode="dark"] .ns-dashboard-card,
  .nourish-app[data-mode="dark"] .ns-calendar-panel,
  .nourish-app[data-mode="dark"] .ns-calendar-detail,
  .nourish-app[data-mode="dark"] .ns-theme-panel,
  .nourish-app[data-mode="dark"] .ns-profile-hero,
  .nourish-app[data-mode="dark"] .ns-profile-stat,
  .nourish-app[data-mode="dark"] .ns-profile-progress-panel,
  .nourish-app[data-mode="dark"] .ns-weekly-plan,
  .nourish-app[data-mode="dark"] .ns-home-action-card,
  .nourish-app[data-mode="dark"] .ns-intro { box-shadow:0 12px 30px rgba(0,0,0,.2),0 2px 6px rgba(0,0,0,.12); }
  .nourish-app[data-mode="dark"] .ns-card:hover,
  .nourish-app[data-mode="dark"] .ns-dashboard-card:hover,
  .nourish-app[data-mode="dark"] .ns-calendar-panel:hover,
  .nourish-app[data-mode="dark"] .ns-calendar-detail:hover,
  .nourish-app[data-mode="dark"] .ns-theme-panel:hover,
  .nourish-app[data-mode="dark"] .ns-weekly-plan:hover { box-shadow:0 17px 38px rgba(0,0,0,.3),0 3px 9px rgba(0,0,0,.18); }
  .nourish-app[data-mode="dark"] .ns-profile-hero,
  .nourish-app[data-mode="dark"] .ns-profile-stat,
  .nourish-app[data-mode="dark"] .ns-profile-progress-panel { border-color:var(--line); background:linear-gradient(135deg,var(--surface),var(--surface-soft)); }
  .nourish-app[data-mode="dark"] .ns-contact-icon,
  .nourish-app[data-mode="dark"] .ns-settings-heading .ns-theme-mode-icon { background:var(--green-soft); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-button,
  .nourish-app[data-mode="dark"] .ns-icon-button,
  .nourish-app[data-mode="dark"] .ns-check,
  .nourish-app[data-mode="dark"] .ns-filter,
  .nourish-app[data-mode="dark"] .ns-revision,
  .nourish-app[data-mode="dark"] .ns-calendar-day,
  .nourish-app[data-mode="dark"] .ns-palette-option,
  .nourish-app[data-mode="dark"] .ns-theme-mode,
  .nourish-app[data-mode="dark"] .ns-mobile-menu,
  .nourish-app[data-mode="dark"] .ns-sidebar-collapse,
  .nourish-app[data-mode="dark"] .ns-nav-button,
  .nourish-app[data-mode="dark"] .ns-range-button,
  .nourish-app[data-mode="dark"] .ns-chart-column,
  .nourish-app[data-mode="dark"] .ns-subject-progress-button { box-shadow:0 2px 7px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.035); }
  .nourish-app[data-mode="dark"] .ns-button:hover,
  .nourish-app[data-mode="dark"] .ns-icon-button:hover,
  .nourish-app[data-mode="dark"] .ns-check:hover,
  .nourish-app[data-mode="dark"] .ns-filter:hover,
  .nourish-app[data-mode="dark"] .ns-revision:hover,
  .nourish-app[data-mode="dark"] .ns-calendar-day:hover,
  .nourish-app[data-mode="dark"] .ns-palette-option:hover,
  .nourish-app[data-mode="dark"] .ns-theme-mode:hover,
  .nourish-app[data-mode="dark"] .ns-mobile-menu:hover,
  .nourish-app[data-mode="dark"] .ns-sidebar-collapse:hover,
  .nourish-app[data-mode="dark"] .ns-nav-button:hover,
  .nourish-app[data-mode="dark"] .ns-range-button:hover,
  .nourish-app[data-mode="dark"] .ns-chart-column:hover,
  .nourish-app[data-mode="dark"] .ns-subject-progress-button:hover { box-shadow:0 5px 14px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.05); }
  .nourish-app[data-mode="dark"] .ns-weekly-task-toggle > span:first-child { box-shadow:0 1px 4px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05); }
  .nourish-app[data-mode="dark"] .ns-delete:hover,
  .nourish-app[data-mode="dark"] .ns-weekly-task-remove:hover { box-shadow:0 4px 10px rgba(0,0,0,.28); }
  .ns-icon-button .ns-ui-icon,.ns-button .ns-ui-icon,.ns-delete .ns-ui-icon,.ns-weekly-task-remove .ns-ui-icon { width:17px; height:17px; margin:auto; }
  .ns-home-action-icon .ns-ui-icon { width:21px; height:21px; }
  .ns-empty-icon .ns-ui-icon { width:32px; height:32px; margin:auto; }
  .ns-check-indicator .ns-ui-icon { width:12px; height:12px; }
  .ns-rank-status-icon { width:12px; height:12px; }
  .nourish-app { background:radial-gradient(ellipse at 88% 0%,color-mix(in srgb,var(--green-soft) 58%,transparent),transparent 30%),var(--paper); }
  .ns-sidebar { background:color-mix(in srgb,var(--surface) 94%,var(--paper)); box-shadow:8px 0 28px rgba(33,51,39,.025); }
  .ns-header { gap:16px; }
  .ns-header-search { display:flex; width:min(260px,25vw); min-width:170px; height:42px; flex:none; align-items:center; gap:9px; padding:0 10px 0 12px; border:1px solid var(--line); border-radius:13px; background:var(--surface); color:var(--muted); box-shadow:0 3px 12px rgba(36,51,45,.045),inset 0 1px 0 rgba(255,255,255,.6); transition:border-color .18s,box-shadow .18s,background .18s; }
  .ns-header-search:focus-within { border-color:color-mix(in srgb,var(--green) 55%,var(--line)); box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 13%,transparent),0 5px 16px rgba(36,51,45,.06); }
  .ns-header-search > .ns-ui-icon { width:17px; height:17px; flex:none; color:var(--green-dark); }
  .ns-header-search input { width:100%; min-width:0; padding:0; border:0; outline:0; background:transparent; color:var(--ink); font:12px 'DM Sans',sans-serif; }
  .ns-header-search input::placeholder { color:var(--muted); opacity:.85; }
  .ns-header-search kbd { flex:none; padding:3px 5px; border:1px solid var(--line); border-radius:6px; background:var(--surface-soft); color:var(--muted); font:600 9px 'DM Sans',sans-serif; white-space:nowrap; }
  .ns-notification-button { position:relative; display:grid; width:42px; height:42px; flex:none; place-items:center; padding:0; }
  .ns-notification-button > .ns-ui-icon { width:18px; height:18px; }
  .ns-notification-count { position:absolute; top:-5px; right:-5px; display:grid; min-width:18px; height:18px; place-items:center; padding:0 4px; border:2px solid var(--paper); border-radius:99px; background:#d46a45; color:#fff; font:700 9px 'DM Sans',sans-serif; }
  .ns-notification-wrap { position:relative; flex:none; }
  .ns-notification-panel { position:absolute; z-index:30; top:calc(100% + 9px); right:0; width:min(360px,calc(100vw - 28px)); max-height:min(70vh,520px); overflow:auto; padding:14px; border:1px solid var(--line); border-radius:17px; background:var(--surface); box-shadow:0 18px 48px rgba(28,43,32,.2),0 3px 10px rgba(28,43,32,.08); color:var(--ink); }
  .ns-notification-panel-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px; }
  .ns-notification-panel-header h2 { margin:0; color:var(--ink); font:600 17px Georgia,serif; }
  .ns-notification-panel-header p { margin:4px 0 0; color:var(--muted); font-size:10px; }
  .ns-notification-panel-header .ns-icon-button { width:30px; height:30px; min-height:30px; border-radius:9px; }
  .ns-notification-list { display:grid; gap:8px; }
  .ns-notification-item { min-width:0; padding:11px; border:1px solid var(--line); border-radius:13px; background:var(--surface-soft); }
  .ns-notification-item.is-overdue { border-color:color-mix(in srgb,#d46a45 30%,var(--line)); }
  .ns-notification-item-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .ns-notification-status { display:inline-flex; align-items:center; gap:5px; color:var(--muted); font-size:9px; font-weight:700; }
  .ns-notification-status .ns-ui-icon { width:13px; height:13px; }
  .ns-notification-item.is-overdue .ns-notification-status { color:#bd613d; }
  .ns-notification-item time { color:var(--muted); font-size:9px; white-space:nowrap; }
  .ns-notification-item h3 { margin:8px 0 2px; color:var(--ink); font-size:11px; line-height:1.4; }
  .ns-notification-item p { margin:0; overflow:hidden; color:var(--muted); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
  .ns-notification-item-actions { display:flex; gap:7px; margin-top:10px; }
  .ns-notification-item-actions .ns-button { min-height:32px; padding:0 9px; font-size:9px; }
  .ns-notification-empty { display:grid; justify-items:center; gap:7px; padding:22px 12px; border:1px dashed var(--line); border-radius:13px; color:var(--muted); text-align:center; }
  .ns-notification-empty .ns-ui-icon { width:22px; height:22px; color:var(--green); }
  .ns-notification-empty strong { color:var(--ink); font-size:11px; }
  .ns-notification-empty span { font-size:9px; line-height:1.5; }
  .nourish-app[data-mode="dark"] .ns-notification-panel { border-color:var(--line); background:var(--surface); box-shadow:0 20px 55px rgba(0,0,0,.48); }
  .nourish-app[data-mode="dark"] .ns-notification-item { background:var(--surface-soft); }
  .nourish-app[data-mode="dark"] .ns-notification-item.is-overdue .ns-notification-status { color:#efa27b; }
  .nourish-app[data-mode="dark"] .ns-sidebar { background:color-mix(in srgb,var(--surface) 88%,var(--paper)); box-shadow:8px 0 28px rgba(0,0,0,.16); }
  .nourish-app[data-mode="dark"] .ns-header-search { background:var(--surface); border-color:var(--line); box-shadow:0 4px 14px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.035); }
  .nourish-app[data-mode="dark"] .ns-header-search kbd { background:var(--surface-soft); border-color:var(--line); color:var(--muted); }
  .nourish-app[data-mode="dark"] .ns-notification-count { border-color:var(--surface); }
  .ns-intro { position:relative; isolation:isolate; display:grid; grid-template-columns:minmax(0,1fr) minmax(235px,.62fr); align-items:center; gap:clamp(18px,3vw,38px); min-height:214px; overflow:hidden; padding:clamp(23px,3vw,34px); border-radius:24px; background:radial-gradient(ellipse at 4% 0%,color-mix(in srgb,var(--green) 13%,transparent),transparent 45%),linear-gradient(122deg,color-mix(in srgb,var(--green-soft) 84%,var(--surface)),var(--surface) 78%); box-shadow:0 16px 36px rgba(36,51,45,.075),0 2px 6px rgba(36,51,45,.035); }
  .ns-intro::before { position:absolute; z-index:-1; top:-125px; right:20%; width:270px; height:270px; border:1px solid color-mix(in srgb,var(--green) 10%,transparent); border-radius:50%; box-shadow:0 0 0 28px color-mix(in srgb,var(--green) 3%,transparent),0 0 0 58px color-mix(in srgb,var(--green) 2%,transparent); content:""; pointer-events:none; }
  .nourish-app[data-mode="dark"] .ns-intro { border-color:color-mix(in srgb,var(--green) 20%,var(--line)); background:radial-gradient(ellipse at 4% 0%,color-mix(in srgb,var(--green) 14%,transparent),transparent 48%),linear-gradient(125deg,#1b201a,#141614 80%); box-shadow:0 17px 38px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.035); }
  .ns-intro-copy { min-width:0; }
  .ns-intro .ns-date { display:inline-flex; align-items:center; gap:8px; }
  .ns-intro .ns-date::before { width:7px; height:7px; border-radius:50%; background:var(--green); content:""; box-shadow:0 0 0 4px color-mix(in srgb,var(--green) 12%,transparent); }
  .ns-greeting { margin-top:13px; font-size:clamp(28px,3.2vw,39px); letter-spacing:-.035em; }
  .ns-subtitle { max-width:510px; font-size:13px; line-height:1.65; }
  .ns-focus-card { min-width:0; padding:17px; border:1px solid color-mix(in srgb,var(--green) 17%,var(--line)); border-radius:18px; background:color-mix(in srgb,var(--surface) 89%,transparent); box-shadow:0 10px 24px rgba(36,51,45,.06),inset 0 1px 0 rgba(255,255,255,.65); backdrop-filter:blur(10px); }
  .nourish-app[data-mode="dark"] .ns-focus-card { border-color:color-mix(in srgb,var(--green) 20%,var(--line)); background:color-mix(in srgb,var(--surface) 90%,transparent); box-shadow:0 12px 28px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.045); }
  .ns-focus-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
  .ns-focus-heading .ns-ui-icon { width:17px; height:17px; color:var(--green); }
  .ns-focus-counts { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px; margin-top:14px; }
  .ns-focus-counts > span { display:grid; gap:3px; }
  .ns-focus-counts strong { color:var(--ink); font:600 25px/1 Georgia,serif; }
  .ns-focus-counts small { color:var(--muted); font-size:9px; }
  .ns-focus-counts > i { width:1px; height:32px; background:var(--line); }
  .ns-focus-progress { margin-top:14px; }
  .ns-focus-progress-top { display:flex; justify-content:space-between; gap:8px; margin-bottom:6px; color:var(--muted); font-size:9px; }
  .ns-focus-progress-top strong { color:var(--green-dark); }
  .ns-focus-progress .ns-progress-track { height:6px; }
  .ns-focus-link { display:flex; width:100%; align-items:center; justify-content:space-between; gap:8px; margin-top:13px; padding:0; border:0; background:transparent; color:var(--green-dark); font:700 10px 'DM Sans',sans-serif; text-align:left; cursor:pointer; }
  .ns-focus-link > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ns-focus-link .ns-ui-icon { width:15px; height:15px; transition:transform .18s ease; }
  .ns-focus-link:hover .ns-ui-icon { transform:translateX(3px); }
  .ns-priority-summary { display:flex; align-items:center; gap:7px; }
  .ns-priority-badge { display:inline-flex; align-items:center; gap:5px; padding:5px 8px; border:1px solid var(--line); border-radius:99px; background:var(--surface); color:var(--muted); font-size:9px; font-weight:700; white-space:nowrap; }
  .ns-priority-badge .ns-ui-icon { width:12px; height:12px; }
  .ns-priority-badge.is-late { border-color:color-mix(in srgb,var(--rose) 25%,var(--line)); background:var(--rose-soft); color:var(--rose); }
  .ns-priority-badge.is-today { border-color:color-mix(in srgb,#d49b46 30%,var(--line)); background:color-mix(in srgb,#f7edda 68%,var(--surface)); color:#9b6b20; }
  .ns-priority-badge.is-clear { border-color:color-mix(in srgb,var(--green) 23%,var(--line)); background:var(--green-soft); color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-priority-badge.is-today { background:#332b1f; color:#e7bf77; border-color:#55452c; }
  .ns-section-heading .ns-button { min-height:34px; padding:0 10px; font-size:10px; }
  .ns-card { background:linear-gradient(155deg,var(--surface),color-mix(in srgb,var(--surface-soft) 35%,var(--surface))); }
  .ns-card:hover { border-color:color-mix(in srgb,var(--green) 25%,var(--line)); }
  .ns-subject { display:inline-flex; align-items:center; gap:5px; padding:6px 10px; border:1px solid color-mix(in srgb,var(--green) 12%,transparent); box-shadow:0 2px 8px color-mix(in srgb,var(--green) 9%,transparent); }
  .ns-subject::before { width:6px; height:6px; border-radius:50%; background:var(--green); content:""; }
  .ns-dashboard-card,.ns-theme-panel,.ns-calendar-panel,.ns-calendar-detail,.ns-weekly-plan { background:linear-gradient(155deg,var(--surface),color-mix(in srgb,var(--surface-soft) 34%,var(--surface))); }
  .ns-notification-button.is-attention { color:#bd613d; border-color:color-mix(in srgb,#bd613d 23%,var(--line)); }
  .nourish-app[data-mode="dark"] .ns-notification-button.is-attention { color:#efa27b; border-color:color-mix(in srgb,#efa27b 28%,var(--line)); }
  .ns-nav-button { position:relative; }
  .ns-sidebar-nav .ns-nav-button.is-active { color:var(--green-dark); background:linear-gradient(100deg,var(--green-soft),color-mix(in srgb,var(--green-soft) 35%,var(--surface))); box-shadow:inset 3px 0 0 var(--green),0 4px 12px color-mix(in srgb,var(--green) 10%,transparent); }
  .nourish-app[data-mode="dark"] .ns-sidebar-nav .ns-nav-button.is-active { color:var(--ink); background:linear-gradient(100deg,color-mix(in srgb,var(--green-soft) 88%,var(--surface)),var(--surface)); box-shadow:inset 3px 0 0 var(--green),0 4px 12px rgba(0,0,0,.16); }
  .nourish-app[data-mode="dark"] .ns-card,.nourish-app[data-mode="dark"] .ns-dashboard-card,.nourish-app[data-mode="dark"] .ns-theme-panel,.nourish-app[data-mode="dark"] .ns-calendar-panel,.nourish-app[data-mode="dark"] .ns-calendar-detail,.nourish-app[data-mode="dark"] .ns-weekly-plan { background:linear-gradient(155deg,#1b1e1b,#171917 82%); border-color:#303630; }
  .ns-button:focus-visible,.ns-icon-button:focus-visible,.ns-check:focus-visible,.ns-filter:focus-visible,.ns-revision:focus-visible,.ns-nav-button:focus-visible,.ns-sidebar-profile:focus-visible,.ns-home-action-card:focus-visible,.ns-notification-button:focus-visible,.ns-focus-link:focus-visible,.ns-section-heading .ns-button:focus-visible { outline:3px solid color-mix(in srgb,var(--green) 48%,transparent); outline-offset:3px; }
  @media (max-width:1100px) {
    .ns-header-search { width:190px; min-width:150px; }
    .ns-header-search kbd { display:none; }
  }
  @media (max-width:900px) {
    .ns-sidebar { background:var(--surface); }
    .nourish-app[data-mode="dark"] .ns-sidebar { background:var(--surface); }
  }
  @media (max-width:700px) {
    .ns-header { gap:10px; }
    .ns-header-start { order:1; flex:1 1 calc(100% - 2px); }
    .ns-header-search { order:2; width:100%; min-width:0; height:42px; }
    .ns-header-search kbd { display:inline; }
    .ns-actions { order:3; }
    .ns-intro { grid-template-columns:minmax(0,1fr); gap:19px; min-height:0; padding:22px; }
    .ns-focus-card { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); column-gap:16px; align-items:center; padding:14px; }
    .ns-focus-heading { grid-column:1/-1; }
    .ns-focus-counts { margin-top:10px; }
    .ns-focus-progress { margin-top:8px; }
    .ns-focus-link { grid-column:1/-1; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
    .ns-priority-summary { flex-wrap:wrap; justify-content:flex-end; }
    .ns-filters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; overflow:visible; padding:3px 0 8px; }
    .ns-filter { width:100%; min-width:0; min-height:38px; padding:7px 9px; border-radius:12px; line-height:1.25; white-space:normal; overflow-wrap:anywhere; }
  }
  @media (max-width:420px) {
    .ns-header-search kbd { display:none; }
    .ns-intro { padding:18px; border-radius:19px; }
    .ns-greeting { font-size:27px; }
    .ns-subtitle { font-size:12px; }
    .ns-focus-card { column-gap:10px; padding:12px; }
    .ns-focus-counts strong { font-size:22px; }
    .ns-priority-badge { padding:4px 6px; font-size:8px; }
  }
  @media (max-width:700px) {
    .ns-sidebar { position:fixed; z-index:10; top:auto; right:0; bottom:0; left:0; width:auto; height:auto; min-height:0; padding:7px 9px calc(8px + env(safe-area-inset-bottom)); transform:none; overflow:visible; border:0; border-top:1px solid color-mix(in srgb,var(--green) 22%,var(--line)); border-radius:21px 21px 0 0; background:linear-gradient(125deg,color-mix(in srgb,var(--green) 13%,var(--surface)),var(--surface) 48%,color-mix(in srgb,var(--green) 8%,var(--surface))); box-shadow:0 -10px 36px rgba(31,50,37,.12),inset 0 1px 0 rgba(255,255,255,.7); }
    .nourish-app[data-mode="dark"] .ns-sidebar { border-color:color-mix(in srgb,var(--green) 24%,var(--line)); background:linear-gradient(125deg,color-mix(in srgb,var(--green) 13%,#171a17),#171917 48%,color-mix(in srgb,var(--green) 9%,#131513)); box-shadow:0 -12px 34px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.045); }
    .ns-sidebar-brand,.ns-sidebar-profile,.ns-sidebar-nav,.ns-sidebar-spacer,.ns-sidebar-collapse { display:none; }
    .ns-mobile-dock { position:relative; display:block; width:100%; }
    .ns-mobile-dock-nav { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) 58px repeat(3,minmax(0,1fr)); min-height:59px; align-items:center; gap:2px; }
    .ns-mobile-dock-link { display:flex; min-width:0; min-height:49px; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:4px 1px; border:0; border-radius:13px; background:transparent; color:var(--muted); font:600 8px 'DM Sans',sans-serif; text-align:center; cursor:pointer; transition:color .16s,background .16s,transform .16s; }
    .ns-mobile-dock-link .ns-ui-icon { width:19px; height:19px; }
    .ns-mobile-dock-link > span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ns-mobile-dock-link.is-active { color:var(--green-dark); background:color-mix(in srgb,var(--green) 11%,transparent); }
    .ns-mobile-dock-link.is-active .ns-ui-icon { color:var(--green); stroke-width:2.1; }
    .nourish-app[data-mode="dark"] .ns-mobile-dock-link.is-active { color:var(--green-dark); background:color-mix(in srgb,var(--green) 13%,transparent); }
    .ns-mobile-dock-link:active { transform:scale(.94); }
    .ns-mobile-dock-create { position:relative; z-index:1; left:auto; right:auto; display:grid; width:54px; height:54px; min-height:54px; align-content:center; justify-items:center; justify-self:center; gap:0; padding:0; transform:translateY(-12px); border:1px solid color-mix(in srgb,var(--green) 72%,white); border-radius:19px; background:linear-gradient(145deg,var(--green),var(--green-dark)); color:white; box-shadow:0 8px 19px color-mix(in srgb,var(--green-dark) 32%,transparent),inset 0 1px 0 rgba(255,255,255,.3); }
    .ns-mobile-dock-create:hover { transform:translateY(-14px) scale(1.035); filter:brightness(1.06); }
    .ns-mobile-dock-create:active { transform:translateY(-10px) scale(.96); }
    .ns-mobile-dock-create > span:first-child { display:grid; width:100%; height:100%; place-items:center; border:0; border-radius:inherit; background:transparent; color:white; }
    .ns-mobile-dock-create > span:first-child .ns-ui-icon { width:25px; height:25px; }
    .ns-mobile-dock-create > span:last-child { position:absolute; bottom:-17px; left:50%; color:var(--green-dark); font-size:8px; line-height:1; transform:translateX(-50%); }
    .nourish-app[data-mode="dark"] .ns-mobile-dock-create { border-color:color-mix(in srgb,var(--green) 74%,white); background:linear-gradient(145deg,var(--green),color-mix(in srgb,var(--green) 55%,var(--green-dark))); color:#fff; box-shadow:0 8px 20px color-mix(in srgb,var(--green) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.22); }
    .nourish-app[data-mode="dark"] .ns-mobile-dock-create > span:last-child { color:var(--green-dark); }
    .ns-desktop-fab { display:none; }
    .ns-main-shell { padding-bottom:calc(122px + env(safe-area-inset-bottom)); }
    .ns-mobile-menu { display:none; }
    .ns-header-start { gap:0; }
  }
  @media (max-width:360px) {
    .ns-sidebar { padding-right:5px; padding-left:5px; }
    .ns-mobile-dock-nav { grid-template-columns:repeat(3,minmax(0,1fr)) 52px repeat(3,minmax(0,1fr)); gap:0; }
    .ns-mobile-dock-link { font-size:7px; }
    .ns-mobile-dock-link .ns-ui-icon { width:18px; height:18px; }
    .ns-mobile-dock-create { width:49px; height:51px; min-height:51px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .nourish-app *, .nourish-app *::before, .nourish-app *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
  }
  @keyframes ns-view-enter {
    from { opacity:0; transform:translateY(7px); }
    to { opacity:1; transform:translateY(0); }
  }
  .nourish-app[data-motion="dynamic"] :is(button,a,input,select,textarea,[role="switch"]) {
    transition:color .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s cubic-bezier(.2,.7,.25,1),opacity .18s ease;
  }
  .nourish-app[data-motion="dynamic"] .ns-app-content > * {
    animation:ns-view-enter .24s cubic-bezier(.2,.7,.25,1) both;
  }
  .nourish-app[data-motion="reduced"] *, .nourish-app[data-motion="reduced"] *::before, .nourish-app[data-motion="reduced"] *::after {
    animation-duration:.01ms !important;
    transition-duration:.01ms !important;
    scroll-behavior:auto !important;
  }
  .nourish-app .ns-dashboard-welcome { position:relative; isolation:isolate; display:flex; min-height:212px; align-items:center; justify-content:space-between; gap:24px; margin:0 0 18px; padding:clamp(23px,4vw,38px); overflow:hidden; border:1px solid rgba(171,137,206,.32); border-radius:26px; background:radial-gradient(ellipse at 87% 3%,rgba(232,178,210,.22),transparent 36%),radial-gradient(ellipse at 9% 100%,rgba(163,130,208,.25),transparent 43%),linear-gradient(115deg,#30223f 0%,#493455 54%,#63435e 100%); color:#fff; box-shadow:0 18px 44px rgba(68,42,82,.2),inset 0 1px 0 rgba(255,255,255,.16); }
  .nourish-app .ns-dashboard-welcome-copy { position:relative; z-index:1; max-width:650px; }
  .nourish-app .ns-dashboard-eyebrow { display:inline-flex; align-items:center; gap:7px; color:#efd3ec; font-size:9px; font-weight:700; letter-spacing:.16em; }
  .nourish-app .ns-dashboard-eyebrow .ns-ui-icon { width:14px; height:14px; }
  .nourish-app .ns-dashboard-welcome h2 { margin:13px 0 8px; color:#fff; font:600 clamp(26px,3vw,38px)/1.12 Georgia,serif; letter-spacing:-.035em; }
  .nourish-app .ns-dashboard-welcome h2 span { background:linear-gradient(100deg,#f4c4da,#d7baff 68%,#f7c6a6); background-clip:text; -webkit-text-fill-color:transparent; }
  .nourish-app .ns-dashboard-welcome-copy > p { max-width:510px; margin:0; color:rgba(247,250,243,.78); font-size:12px; line-height:1.6; }
  .nourish-app .ns-dashboard-welcome-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:20px; }
  .nourish-app .ns-dashboard-primary-action,.nourish-app .ns-dashboard-secondary-action { display:inline-flex; min-height:39px; align-items:center; justify-content:center; gap:8px; padding:0 13px; border:1px solid rgba(255,255,255,.19); border-radius:11px; color:#fff; font:600 11px 'DM Sans',sans-serif; text-decoration:none; cursor:pointer; transition:transform .18s,background .18s,border-color .18s,box-shadow .18s; }
  .nourish-app .ns-dashboard-primary-action { border-color:#f0e3f5; background:linear-gradient(115deg,#f5e9f4,#e8e2fa); color:#3d2c4b; box-shadow:0 5px 15px rgba(25,11,35,.16); }
  .nourish-app .ns-dashboard-secondary-action { background:rgba(255,255,255,.08); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); }
  .nourish-app .ns-dashboard-primary-action:hover,.nourish-app .ns-dashboard-secondary-action:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.56); box-shadow:0 8px 20px rgba(11,35,19,.2); }
  .nourish-app .ns-dashboard-primary-action .ns-ui-icon,.nourish-app .ns-dashboard-secondary-action .ns-ui-icon { width:15px; height:15px; }
  .nourish-app .ns-dashboard-primary-action:focus-visible,.nourish-app .ns-dashboard-secondary-action:focus-visible { outline:3px solid rgba(255,255,255,.68); outline-offset:3px; }
  .nourish-app .ns-dashboard-welcome-rank { position:relative; z-index:1; display:flex; min-width:160px; align-items:center; gap:12px; padding:13px 15px; border:1px solid rgba(255,255,255,.18); border-radius:17px; background:rgba(10,30,18,.19); box-shadow:inset 0 1px 0 rgba(255,255,255,.08); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
  .nourish-app .ns-dashboard-rank-badge { display:grid; width:42px; height:42px; flex:none; place-items:center; border-radius:13px; background:rgba(255,255,255,.12); }
  .nourish-app .ns-dashboard-rank-badge .ns-rank-badge { width:31px; height:31px; }
  .nourish-app .ns-dashboard-welcome-rank small,.nourish-app .ns-dashboard-welcome-rank strong,.nourish-app .ns-dashboard-welcome-rank em { display:block; }
  .nourish-app .ns-dashboard-welcome-rank small { color:#ead3ed; font-size:8px; font-weight:700; letter-spacing:.13em; }
  .nourish-app .ns-dashboard-welcome-rank strong { margin-top:3px; color:#fff; font:600 17px Georgia,serif; }
  .nourish-app .ns-dashboard-welcome-rank em { margin-top:2px; color:rgba(247,250,243,.7); font-size:9px; font-style:normal; }
  .nourish-app .ns-dashboard-welcome-glow { position:absolute; z-index:-1; right:12%; bottom:-130px; width:320px; height:220px; border-radius:50%; background:rgba(226,166,217,.2); filter:blur(55px); pointer-events:none; }
  .nourish-app .ns-metrics { gap:11px; margin-bottom:17px; }
  .nourish-app .ns-metric { position:relative; min-height:106px; padding:15px 16px; overflow:hidden; border-radius:17px; background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--surface-soft) 72%,var(--surface))); box-shadow:0 8px 22px rgba(36,51,45,.055),inset 0 1px 0 rgba(255,255,255,.55); }
  .nourish-app .ns-metric::after { position:absolute; right:-25px; bottom:-34px; width:94px; height:74px; border-radius:50%; background:var(--metric-glow,color-mix(in srgb,var(--green) 12%,transparent)); filter:blur(18px); content:""; pointer-events:none; }
  .nourish-app .ns-metric:nth-child(1) { --metric-accent:#278a7e; --metric-glow:rgba(70,174,155,.18); }
  .nourish-app .ns-metric:nth-child(2) { --metric-accent:#c65c62; --metric-glow:rgba(222,113,121,.17); }
  .nourish-app .ns-metric:nth-child(3) { --metric-accent:#5578b4; --metric-glow:rgba(112,151,211,.19); }
  .nourish-app .ns-metric:nth-child(4) { --metric-accent:#8762ad; --metric-glow:rgba(163,126,203,.18); }
  .nourish-app .ns-metric-icon { width:27px; height:27px; border-radius:9px; background:color-mix(in srgb,var(--metric-accent) 12%,var(--surface)); color:var(--metric-accent); }
  .nourish-app .ns-metric-value { margin-top:9px; color:var(--metric-accent); font-size:27px; font-variant-numeric:tabular-nums; }
  .nourish-app .ns-dashboard { --dashboard-accent:#8764a8; --dashboard-accent-soft:#efe8f5; --chart-done:#35a99a; --chart-pending:#ed985d; --chart-locked:#987dca; gap:14px; margin-top:0; }
  .nourish-app .ns-dashboard-card { padding:clamp(16px,2vw,22px); border-radius:20px; background:linear-gradient(150deg,var(--surface),color-mix(in srgb,var(--surface-soft) 55%,var(--surface))); box-shadow:0 12px 30px rgba(36,51,45,.06),0 2px 5px rgba(36,51,45,.025); transition:transform .2s,border-color .2s,box-shadow .2s; }
  .nourish-app .ns-dashboard-card:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--green) 25%,var(--line)); box-shadow:0 17px 36px rgba(36,51,45,.09),0 4px 10px rgba(36,51,45,.035); }
  .nourish-app .ns-dashboard-action:hover { transform:translateY(-2px); }
  .nourish-app .ns-dashboard-heading h2 { font-size:18px; letter-spacing:-.015em; }
  .nourish-app .ns-progress-overview { align-items:center; gap:14px; }
  .nourish-app .ns-progress-ring { background:conic-gradient(var(--dashboard-accent) var(--progress),color-mix(in srgb,var(--dashboard-accent) 13%,var(--line)) 0); box-shadow:0 6px 20px color-mix(in srgb,var(--dashboard-accent) 17%,transparent); }
  .nourish-app .ns-progress-ring::before { background:var(--surface); }
  .nourish-app .ns-dashboard .ns-progress-track { background:color-mix(in srgb,var(--dashboard-accent) 12%,var(--line)); }
  .nourish-app .ns-dashboard .ns-progress-fill { background:linear-gradient(90deg,#a58ac0,var(--dashboard-accent)); }
  .nourish-app .ns-dashboard .ns-rank-summary { background:linear-gradient(135deg,var(--dashboard-accent-soft),color-mix(in srgb,var(--dashboard-accent-soft) 42%,var(--surface))); }
  .nourish-app .ns-dashboard .ns-rank-summary strong,.nourish-app .ns-dashboard .ns-subject-progress-top span { color:var(--dashboard-accent); }
  .nourish-app .ns-range-switch { padding:4px; border-color:color-mix(in srgb,var(--green) 12%,var(--line)); background:color-mix(in srgb,var(--green-soft) 45%,var(--surface-soft)); }
  .nourish-app .ns-range-button { min-height:30px; padding:0 11px; }
  .nourish-app .ns-range-button.is-active { background:var(--surface); color:var(--green-dark); box-shadow:0 2px 7px rgba(36,51,45,.12); }
  .nourish-app .ns-chart-summary { gap:7px; }
  .nourish-app .ns-chart-stat { padding:10px; border-color:color-mix(in srgb,var(--green) 9%,var(--line)); background:color-mix(in srgb,var(--green-soft) 22%,var(--surface-soft)); }
  .nourish-app .ns-chart-stat-label { letter-spacing:.02em; }
  .nourish-app .ns-chart-stat-value { font-size:19px; }
  .nourish-app .ns-chart-stat.is-overdue { border-color:color-mix(in srgb,#c65c62 25%,var(--line)); background:color-mix(in srgb,#c65c62 7%,var(--surface)); }
  .nourish-app .ns-chart-stat.is-peak .ns-chart-stat-value { color:var(--green-dark); }
  .nourish-app .ns-chart-bar { width:min(100%,29px); height:110px; background:color-mix(in srgb,var(--green-soft) 40%,var(--line)); box-shadow:inset 0 1px 2px rgba(26,42,31,.07); }
  .nourish-app .ns-chart-column { gap:7px; }
  .nourish-app .ns-chart-column:hover,.nourish-app .ns-chart-column.is-selected { background:color-mix(in srgb,var(--green-soft) 52%,transparent); }
  .nourish-app .ns-chart-column small { font-size:10px; }
  .nourish-app .ns-legend-item { min-height:31px; background:var(--surface); }
  .nourish-app .ns-chart-detail { border:1px solid var(--line); background:var(--surface-soft); }
  .nourish-app .ns-subject-progress { gap:11px; }
  .nourish-app .ns-subject-progress-button { padding:13px; border-radius:14px; background:linear-gradient(145deg,var(--surface),var(--surface-soft)); box-shadow:0 3px 10px rgba(36,51,45,.035); }
  .nourish-app .ns-subject-progress-button:hover { border-color:color-mix(in srgb,var(--green) 32%,var(--line)); background:color-mix(in srgb,var(--green-soft) 32%,var(--surface)); box-shadow:0 8px 18px rgba(36,51,45,.07); }
  .nourish-app .ns-schedule-heading { align-items:center; margin-bottom:14px; }
  .nourish-app .ns-schedule-heading .ns-range-switch { flex:none; }
  .nourish-app .ns-schedule-summary { display:flex; align-items:center; gap:11px; margin-bottom:13px; padding:11px 13px; border:1px solid color-mix(in srgb,var(--dashboard-accent) 15%,var(--line)); border-radius:13px; background:linear-gradient(100deg,color-mix(in srgb,var(--dashboard-accent-soft) 70%,var(--surface)),var(--surface-soft)); }
  .nourish-app .ns-schedule-summary-icon { display:grid; width:32px; height:32px; flex:none; place-items:center; border-radius:10px; background:color-mix(in srgb,var(--dashboard-accent) 12%,var(--surface)); color:var(--dashboard-accent); }
  .nourish-app .ns-schedule-summary-icon .ns-ui-icon { width:17px; height:17px; }
  .nourish-app .ns-schedule-summary strong,.nourish-app .ns-schedule-summary small { display:block; }
  .nourish-app .ns-schedule-summary strong { color:var(--ink); font-size:12px; }
  .nourish-app .ns-schedule-summary small { margin-top:2px; color:var(--muted); font-size:10px; }
  .nourish-app .ns-schedule-list { display:grid; max-height:350px; gap:8px; overflow-y:auto; padding:1px 3px 2px 1px; scrollbar-color:color-mix(in srgb,var(--dashboard-accent) 28%,var(--line)) transparent; scrollbar-width:thin; }
  .nourish-app .ns-schedule-day { display:grid; grid-template-columns:minmax(70px,auto) minmax(0,1fr) 32px; align-items:start; gap:11px; padding:11px; border:1px solid var(--line); border-radius:13px; background:var(--surface); transition:border-color .18s,background .18s,transform .18s; }
  .nourish-app .ns-schedule-day:hover { transform:translateY(-1px); border-color:color-mix(in srgb,var(--dashboard-accent) 28%,var(--line)); background:color-mix(in srgb,var(--dashboard-accent-soft) 24%,var(--surface)); }
  .nourish-app .ns-schedule-day-date strong,.nourish-app .ns-schedule-day-date span { display:block; }
  .nourish-app .ns-schedule-day-date strong { color:var(--ink); font-size:11px; }
  .nourish-app .ns-schedule-day-date span { margin-top:4px; color:var(--dashboard-accent); font-size:9px; font-weight:700; }
  .nourish-app .ns-schedule-day-items { display:grid; min-width:0; gap:8px; }
  .nourish-app .ns-schedule-item { display:flex; min-width:0; align-items:flex-start; gap:8px; }
  .nourish-app .ns-schedule-item-dot { width:7px; height:7px; flex:none; margin-top:4px; border-radius:50%; background:#e69a62; box-shadow:0 0 0 3px color-mix(in srgb,#e69a62 13%,transparent); }
  .nourish-app .ns-schedule-item > span:last-child { min-width:0; }
  .nourish-app .ns-schedule-item strong,.nourish-app .ns-schedule-item small { display:block; overflow:hidden; text-overflow:ellipsis; }
  .nourish-app .ns-schedule-item strong { color:var(--ink); font-size:10px; }
  .nourish-app .ns-schedule-item small { margin-top:3px; color:var(--muted); font-size:9px; line-height:1.4; }
  .nourish-app .ns-schedule-open-day { display:grid; width:30px; height:30px; place-items:center; border:1px solid var(--line); border-radius:9px; background:var(--surface-soft); color:var(--dashboard-accent); cursor:pointer; transition:background .18s,border-color .18s,transform .18s; }
  .nourish-app .ns-schedule-open-day:hover { transform:translateX(2px); border-color:color-mix(in srgb,var(--dashboard-accent) 35%,var(--line)); background:var(--dashboard-accent-soft); }
  .nourish-app .ns-schedule-open-day .ns-ui-icon { width:15px; height:15px; }
  .nourish-app .ns-schedule-open-day:focus-visible,.nourish-app .ns-schedule-empty-link:focus-visible { outline:3px solid color-mix(in srgb,var(--dashboard-accent) 42%,transparent); outline-offset:2px; }
  .nourish-app .ns-schedule-hint { margin:12px 0 0; color:var(--muted); font-size:9px; line-height:1.5; }
  .nourish-app .ns-schedule-empty { display:grid; justify-items:start; gap:7px; padding:18px 14px; border:1px dashed color-mix(in srgb,var(--dashboard-accent) 25%,var(--line)); border-radius:13px; background:color-mix(in srgb,var(--dashboard-accent-soft) 24%,var(--surface)); }
  .nourish-app .ns-schedule-empty > strong { color:var(--ink); font-size:12px; }
  .nourish-app .ns-schedule-empty > span { max-width:460px; color:var(--muted); font-size:10px; line-height:1.5; }
  .nourish-app .ns-schedule-empty-link { display:inline-flex; align-items:center; gap:6px; margin-top:3px; padding:0; border:0; background:transparent; color:var(--dashboard-accent); font:700 10px 'DM Sans',sans-serif; cursor:pointer; }
  .nourish-app .ns-schedule-empty-link .ns-ui-icon { width:14px; height:14px; }
  .nourish-app[data-mode="dark"] .ns-dashboard { --dashboard-accent:#b89bd4; --dashboard-accent-soft:#30263b; --chart-done:#61caba; --chart-pending:#f1ad79; --chart-locked:#b7a0e8; }
  .nourish-app[data-mode="dark"] .ns-dashboard-welcome { border-color:rgba(180,147,214,.23); background:radial-gradient(ellipse at 88% 0%,rgba(182,139,213,.17),transparent 39%),radial-gradient(ellipse at 4% 100%,rgba(222,143,187,.12),transparent 44%),linear-gradient(115deg,#191321 0%,#211a2b 58%,#2c2030 100%); box-shadow:0 18px 44px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.055); }
  .nourish-app[data-mode="dark"] .ns-dashboard-welcome h2 span { background:linear-gradient(100deg,#f0b8d0,#d3b3f3 68%,#f4c1a4); background-clip:text; -webkit-text-fill-color:transparent; }
  .nourish-app[data-mode="dark"] .ns-dashboard-primary-action { border-color:#453552; background:linear-gradient(115deg,#3d2d49,#342b46); color:#f1e8f7; }
  .nourish-app[data-mode="dark"] .ns-dashboard-secondary-action { border-color:rgba(209,182,223,.2); background:rgba(255,255,255,.045); color:var(--ink); }
  .nourish-app[data-mode="dark"] .ns-dashboard-welcome-rank { border-color:rgba(209,182,223,.17); background:rgba(0,0,0,.19); }
  .nourish-app[data-mode="dark"] .ns-dashboard-rank-badge { background:rgba(206,177,220,.09); }
  .nourish-app[data-mode="dark"] .ns-metric { background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--surface-soft) 72%,var(--surface))); box-shadow:0 9px 24px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.035); }
  .nourish-app[data-mode="dark"] .ns-metric-icon { background:color-mix(in srgb,var(--metric-accent) 18%,var(--surface)); color:color-mix(in srgb,var(--metric-accent) 75%,white); }
  .nourish-app[data-mode="dark"] .ns-metric-value { color:color-mix(in srgb,var(--metric-accent) 78%,white); }
  .nourish-app[data-mode="dark"] .ns-dashboard-card { background:linear-gradient(150deg,var(--surface),color-mix(in srgb,var(--surface-soft) 43%,var(--surface))); box-shadow:0 12px 30px rgba(0,0,0,.2),0 2px 6px rgba(0,0,0,.1); }
  .nourish-app[data-mode="dark"] .ns-dashboard-card:hover { box-shadow:0 17px 38px rgba(0,0,0,.3),0 3px 9px rgba(0,0,0,.16); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-rank-summary { background:linear-gradient(135deg,#30263b,#25212a); }
  .nourish-app[data-mode="dark"] .ns-schedule-summary { border-color:color-mix(in srgb,var(--dashboard-accent) 18%,var(--line)); background:linear-gradient(100deg,color-mix(in srgb,var(--dashboard-accent-soft) 75%,var(--surface)),var(--surface-soft)); }
  .nourish-app[data-mode="dark"] .ns-schedule-day:hover { background:color-mix(in srgb,var(--dashboard-accent-soft) 45%,var(--surface)); }
  .nourish-app[data-mode="dark"] .ns-schedule-empty { background:color-mix(in srgb,var(--dashboard-accent-soft) 55%,var(--surface)); }
  .nourish-app[data-mode="dark"] .ns-schedule-empty-link { color:var(--green-dark); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-chart-segment.is-completed { background:linear-gradient(180deg,#8de0d4,#43b8a6); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-chart-segment.is-pending { background:linear-gradient(180deg,#ffd0a8,#e89155); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-chart-segment.is-locked { background:linear-gradient(180deg,#d0bdf2,#967acb); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-legend-dot { background:var(--chart-done); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-legend-dot.is-pending { background:var(--chart-pending); }
  .nourish-app[data-mode="dark"] .ns-dashboard .ns-legend-dot.is-locked { background:var(--chart-locked); }
  .nourish-app[data-mode="dark"] .ns-chart-stat { border-color:var(--line); background:color-mix(in srgb,var(--surface-soft) 85%,var(--surface)); }
  .nourish-app[data-mode="dark"] .ns-chart-stat.is-overdue { border-color:#713b3b; background:#352424; }
  .nourish-app[data-mode="dark"] .ns-chart-bar { background:color-mix(in srgb,var(--green) 12%,var(--surface-soft)); }
  .nourish-app[data-mode="dark"] .ns-chart-column:hover,.nourish-app[data-mode="dark"] .ns-chart-column.is-selected { background:color-mix(in srgb,var(--green) 12%,transparent); }
  .nourish-app[data-mode="dark"] .ns-legend-item { background:var(--surface-soft); }
  .nourish-app[data-mode="dark"] .ns-chart-detail { border-color:var(--line); background:var(--surface-soft); }
  .nourish-app[data-mode="dark"] .ns-subject-progress-button { background:linear-gradient(145deg,var(--surface),var(--surface-soft)); }
  .nourish-app[data-mode="dark"] .ns-subject-progress-button:hover { background:color-mix(in srgb,var(--green-soft) 60%,var(--surface)); }
  @media (max-width:900px) {
    .nourish-app .ns-dashboard-welcome { min-height:190px; }
    .nourish-app .ns-dashboard-welcome-rank { min-width:144px; }
    .nourish-app .ns-dashboard-card:first-child,.nourish-app .ns-dashboard-card:nth-child(2) { grid-column:span 6; }
  }
  @media (max-width:700px) {
    .nourish-app .ns-dashboard-welcome { min-height:0; align-items:flex-start; flex-direction:column; gap:18px; margin-bottom:13px; padding:22px; border-radius:21px; }
    .nourish-app .ns-dashboard-welcome h2 { max-width:400px; font-size:clamp(27px,7.5vw,35px); }
    .nourish-app .ns-dashboard-welcome-copy > p { font-size:11px; }
    .nourish-app .ns-dashboard-welcome-actions { width:100%; margin-top:16px; }
    .nourish-app .ns-dashboard-primary-action,.nourish-app .ns-dashboard-secondary-action { min-height:42px; }
    .nourish-app .ns-dashboard-welcome-rank { min-width:0; width:100%; padding:10px 12px; }
    .nourish-app .ns-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .nourish-app .ns-metric { min-height:98px; padding:12px; }
    .nourish-app .ns-metric-label { gap:6px; font-size:10px; letter-spacing:.04em; }
    .nourish-app .ns-metric-icon { width:24px; height:24px; }
    .nourish-app .ns-metric-value { font-size:24px; }
    .nourish-app .ns-dashboard { gap:10px; margin-bottom:20px; }
    .nourish-app .ns-dashboard-card { grid-column:1/-1 !important; }
    .nourish-app .ns-dashboard-card:first-child { grid-row:auto; }
    .nourish-app .ns-chart-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
  @media (max-width:420px) {
    .nourish-app .ns-dashboard-welcome { padding:18px; }
    .nourish-app .ns-dashboard-welcome-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
    .nourish-app .ns-dashboard-primary-action,.nourish-app .ns-dashboard-secondary-action { gap:5px; padding:0 8px; font-size:10px; }
    .nourish-app .ns-dashboard-card { padding:14px; border-radius:17px; }
    .nourish-app .ns-dashboard-heading { gap:8px; }
    .nourish-app .ns-dashboard-heading h2 { font-size:16px; }
    .nourish-app .ns-dashboard-heading p { max-width:210px; font-size:10px; }
    .nourish-app .ns-progress-overview { align-items:flex-start; gap:11px; }
    .nourish-app .ns-progress-ring { width:78px; height:78px; }
    .nourish-app .ns-progress-ring::before { inset:7px; }
    .nourish-app .ns-progress-ring strong { font-size:19px; }
    .nourish-app .ns-progress-copy strong { font-size:12px; }
    .nourish-app .ns-progress-copy span { font-size:10px; }
    .nourish-app .ns-chart-heading { align-items:flex-start; flex-wrap:wrap; }
    .nourish-app .ns-chart-summary { gap:6px; }
    .nourish-app .ns-chart-stat { padding:8px; }
    .nourish-app .ns-chart-stat-label { font-size:8px; }
    .nourish-app .ns-chart-stat-value { font-size:17px; }
    .nourish-app .ns-chart-legend { gap:5px; }
    .nourish-app .ns-legend-item { min-height:28px; padding:0 7px; font-size:9px; }
    .nourish-app .ns-schedule-heading { align-items:flex-start; flex-wrap:wrap; }
    .nourish-app .ns-schedule-heading .ns-range-switch { margin-left:auto; }
    .nourish-app .ns-schedule-day { grid-template-columns:minmax(56px,auto) minmax(0,1fr) 30px; gap:7px; padding:9px 7px; }
    .nourish-app .ns-schedule-day-date strong { font-size:10px; }
    .nourish-app .ns-schedule-item strong { font-size:9px; }
    .nourish-app .ns-schedule-item small { font-size:8px; }
  }
  @media (max-width:360px) {
    .nourish-app .ns-metric { min-height:94px; padding:10px; }
    .nourish-app .ns-metric-label { gap:5px; font-size:8px; letter-spacing:.025em; }
    .nourish-app .ns-metric-icon { width:22px; height:22px; }
    .nourish-app .ns-metric-value { margin-top:7px; font-size:22px; }
    .nourish-app .ns-metric .ns-muted { font-size:9px; }
  }
  @media (max-width:700px) {
    .nourish-app .ns-notification-panel { position:fixed; top:72px; right:14px; width:min(360px,calc(100vw - 42px)); max-height:62vh; }
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
          <AppIcon name="trash" className="ns-ui-icon" />
        </button>
      </div>

      <div className="ns-checks" aria-label="Materiais de estudo">
        <button
          type="button"
          className={`ns-check${study.hasNotes ? ' is-done' : ''}`}
          aria-pressed={study.hasNotes}
          onClick={() => onToggle(study.id, 'hasNotes')}
        >
          <span className="ns-check-indicator"><AppIcon name="check" className="ns-ui-icon" /></span>
          {study.hasNotes ? 'Anotações feitas' : 'Anotações'}
        </button>
        <button
          type="button"
          className={`ns-check${study.hasExercises ? ' is-done' : ''}`}
          aria-pressed={study.hasExercises}
          onClick={() => onToggle(study.id, 'hasExercises')}
        >
          <span className="ns-check-indicator"><AppIcon name="check" className="ns-ui-icon" /></span>
          {study.hasExercises ? 'Questões resolvidas' : 'Questões'}
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
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>(getInitialWeeklyTasks)
  const [weeklyPlanWeekStart, setWeeklyPlanWeekStart] = useState(getWeekStart)
  const [weeklyTaskForm, setWeeklyTaskForm] = useState<WeeklyTaskForm>(() => ({
    subject: '',
    content: '',
    date: getWeekStart(),
  }))
  const [profile, setProfile] = useState<Profile>(getInitialProfile)
  const [progress, setProgress] = useState(() => getInitialXp(studies))
  const xp = progress.xp
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings)
  const [lightPalette, setLightPalette] = useState<PaletteKey>(getInitialPalette)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const palette = lightPalette
  const [todayLabel] = useState(() =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  )
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window === 'undefined') return 'home'
    return resolveTabFromHash(window.location.hash)
  })
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>(() => settings.defaultDashboardRange)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(localDateString())
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('ALL')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState<Profile>(profile)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [form, setForm] = useState<StudyForm>(freshForm)
  const [toast, setToast] = useState<Toast | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportDragActive, setIsImportDragActive] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Study | null>(null)
  const studiesRef = useRef(studies)
  const toastTimer = useRef<number | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const profilePhotoInput = useRef<HTMLInputElement>(null)
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const headerSearchInput = useRef<HTMLInputElement>(null)
  const notificationWrap = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    try {
      window.localStorage.setItem(WEEKLY_PLAN_STORAGE_KEY, JSON.stringify(weeklyTasks))
    } catch (error) {
      console.error('Não foi possível salvar o plano semanal.', error)
    }
  }, [weeklyTasks])

  useEffect(() => {
    try {
      window.localStorage.setItem(XP_STORAGE_KEY, JSON.stringify(progress))
    } catch (error) {
      console.error('Não foi possível salvar o XP.', error)
    }
  }, [progress])

  useEffect(() => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, lightPalette)
    } catch (error) {
      console.error('Não foi possível salvar a paleta escolhida.', error)
    }
  }, [lightPalette])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode)
    } catch (error) {
      console.error('Não foi possível salvar o modo de tema escolhido.', error)
    }
  }, [themeMode])

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('Não foi possível salvar as configurações.', error)
    }
  }, [settings])

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
    if (!window.location.hash || window.location.hash === '#/') {
      const startPageHash = settings.startPage === 'dashboard' ? '#/dashboard' : '#/'
      if (window.location.hash !== startPageHash) {
        window.history.replaceState(null, '', startPageHash)
        setActiveTab(settings.startPage)
      }
    }
    const handleHashChange = () => {
      setActiveTab(resolveTabFromHash(window.location.hash))
      setIsMobileNavOpen(false)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [settings.startPage])

  useEffect(() => {
    if (!pendingDelete) return
    cancelDeleteButton.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDelete(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingDelete])

  useEffect(() => {
    if (!isProfileOpen && !isFormOpen && !isMobileNavOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isProfileOpen) setIsProfileOpen(false)
      else if (isFormOpen) setIsFormOpen(false)
      else setIsMobileNavOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFormOpen, isMobileNavOpen, isProfileOpen])

  useEffect(() => {
    if (!isNotificationsOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationWrap.current?.contains(event.target)) {
        setIsNotificationsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isNotificationsOpen])

  useEffect(() => {
    const handleQuickSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        headerSearchInput.current?.focus()
      }
    }

    window.addEventListener('keydown', handleQuickSearch)
    return () => window.removeEventListener('keydown', handleQuickSearch)
  }, [])

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

  const reviewNotifications = useMemo<ReviewNotification[]>(() => {
    const items: ReviewNotification[] = []
    activeStudies.forEach((study) => {
      const dates = revisionDates(study.studyDate)
      const nextRevision: { field: StudyField; label: string; date: string; done: boolean; available: boolean }[] = [
        { field: 'rev24h', label: '24 horas', date: dates.d24h, done: study.rev24h, available: true },
        { field: 'rev7d', label: '7 dias', date: dates.d7d, done: study.rev7d, available: study.rev24h },
        { field: 'rev30d', label: '30 dias', date: dates.d30d, done: study.rev30d, available: study.rev7d },
      ]
      const pending = nextRevision.find((revision) => !revision.done && revision.available)
      if (!pending || (!isPast(pending.date) && !isToday(pending.date))) return
      items.push({
        study,
        field: pending.field,
        label: pending.label,
        date: pending.date,
        status: isPast(pending.date) ? 'overdue' : 'today',
      })
    })
    return items.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1
      return a.date.localeCompare(b.date)
    })
  }, [activeStudies])

  const focusStudy = overdue[0] ?? dueToday[0] ?? activeStudies[0] ?? null
  const notificationCount = reviewNotifications.length

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

  const dashboardDays = useMemo(() => {
    const today = localDateString()
    return Array.from({ length: dashboardRange }, (_, offset) => {
      const date = addDays(today, offset)
      const items: { subject: string; content: string; label: string }[] = []

      studies.forEach((study) => {
        const dates = revisionDates(study.studyDate)
        const scheduledRevisions: { field: StudyField; date: string; label: string; available: boolean }[] = [
          { field: 'rev24h', date: dates.d24h, label: 'Revisão em 24 horas', available: true },
          { field: 'rev7d', date: dates.d7d, label: 'Revisão em 7 dias', available: study.rev24h },
          { field: 'rev30d', date: dates.d30d, label: 'Revisão em 30 dias', available: study.rev7d },
        ]

        scheduledRevisions.forEach(({ field, date: revisionDate, label, available }) => {
          if (revisionDate === date && !study[field] && available) {
            items.push({ subject: study.subject, content: study.content, label })
          }
        })
      })

      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        day: date.slice(-2),
        pending: items.length,
        items,
      }
    })
  }, [studies, dashboardRange])

  const subjectProgress = useMemo(
    () =>
      Array.from(new Set(studies.map((study) => study.subject)))
        .map((subject) => {
          const subjectStudies = studies.filter((study) => study.subject === subject)
          const done = subjectStudies.reduce(
            (total, study) => total + Number(study.rev24h) + Number(study.rev7d) + Number(study.rev30d),
            0,
          )
          const total = subjectStudies.length * 3
          return { subject, done, total, rate: total ? Math.round((done / total) * 100) : 0, count: subjectStudies.length }
        })
        .sort((a, b) => b.rate - a.rate || a.subject.localeCompare(b.subject, 'pt-BR')),
    [studies],
  )

  const dashboardPendingDays = dashboardDays.filter((day) => day.pending > 0)
  const dashboardPendingCount = dashboardPendingDays.reduce((total, day) => total + day.pending, 0)
  const currentRankIndex = getRankIndex(xp)
  const currentRank = RANKS[currentRankIndex]
  const nextRank = RANKS[currentRankIndex + 1]
  const rankProgress = nextRank
    ? Math.min(100, Math.round(((xp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100))
    : 100

  const calendarGrid = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const mondayFirstOffset = (new Date(year, month, 1).getDay() + 6) % 7
    const cells: ({ date: string; day: number; items: CalendarRevision[] } | null)[] = Array.from(
      { length: mondayFirstOffset },
      () => null,
    )

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = localDateString(new Date(year, month, day))
      const items: CalendarRevision[] = []
      studies.forEach((study) => {
        const dates = revisionDates(study.studyDate)
        const revisions: { field: StudyField; label: string; date: string; done: boolean; available: boolean }[] = [
          { field: 'rev24h', label: '24 horas', date: dates.d24h, done: study.rev24h, available: true },
          { field: 'rev7d', label: '7 dias', date: dates.d7d, done: study.rev7d, available: study.rev24h },
          { field: 'rev30d', label: '30 dias', date: dates.d30d, done: study.rev30d, available: study.rev7d },
        ]
        revisions.forEach((revision) => {
          if (revision.date !== date) return
          items.push({
            studyId: study.id,
            subject: study.subject,
            content: study.content,
            field: revision.field,
            label: revision.label,
            done: revision.done,
            available: revision.available,
            late: !revision.done && revision.available && isPast(date),
          })
        })
      })
      cells.push({ date, day, items })
    }

    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calendarMonth, studies])

  const weeklyPlanDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(weeklyPlanWeekStart, offset)
        return {
          date,
          dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
          dayNumber: Number(date.slice(-2)),
          tasks: weeklyTasks.filter((task) => task.date === date),
        }
      }),
    [weeklyPlanWeekStart, weeklyTasks],
  )
  const weeklyPlanTaskCount = weeklyPlanDays.reduce((total, day) => total + day.tasks.length, 0)
  const weeklyPlanCompletedCount = weeklyPlanDays.reduce(
    (total, day) => total + day.tasks.filter((task) => task.completed).length,
    0,
  )
  const weeklyPlanRangeLabel = weeklyPlanDays.length
    ? `${new Date(`${weeklyPlanDays[0].date}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${new Date(`${weeklyPlanDays[6].date}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
    : ''

  const selectedCalendarItems = useMemo(() => {
    const items: CalendarRevision[] = []
    studies.forEach((study) => {
      const dates = revisionDates(study.studyDate)
      const revisions: { field: StudyField; label: string; date: string; done: boolean; available: boolean }[] = [
        { field: 'rev24h', label: '24 horas', date: dates.d24h, done: study.rev24h, available: true },
        { field: 'rev7d', label: '7 dias', date: dates.d7d, done: study.rev7d, available: study.rev24h },
        { field: 'rev30d', label: '30 dias', date: dates.d30d, done: study.rev30d, available: study.rev7d },
      ]
      revisions.forEach((revision) => {
        if (revision.date === selectedCalendarDate) {
          items.push({
            studyId: study.id,
            subject: study.subject,
            content: study.content,
            field: revision.field,
            label: revision.label,
            done: revision.done,
            available: revision.available,
            late: !revision.done && revision.available && isPast(revision.date),
          })
        }
      })
    })
    return items
  }, [selectedCalendarDate, studies])
  const filteredCompletedStudies = useMemo(
    () => completedStudies.filter((study) => subjectFilter === 'ALL' || study.subject === subjectFilter),
    [completedStudies, subjectFilter],
  )

  const toggleStudyField = useCallback(
    (id: string, field: StudyField) => {
      const current = studiesRef.current.find((study) => study.id === id)
      if (!current) return

      const updated = { ...current, [field]: !current[field] }
      const isRevision = field === 'rev24h' || field === 'rev7d' || field === 'rev30d'
      const taskKey = `${id}:${field}`
      const earnsXp = !current[field] && !progress.claimed.includes(taskKey)
      if (earnsXp) {
        setProgress((previous) => ({
          xp: previous.xp + XP_PER_REVIEW,
          claimed: [...previous.claimed, taskKey],
        }))
      }

      if (isRevision) {
        updated.completed = updated.rev24h && updated.rev7d && updated.rev30d
        if (updated.completed && !current.completed) {
          const rankMessage =
            earnsXp && getRankIndex(xp + XP_PER_REVIEW) > getRankIndex(xp)
              ? ` Novo rank: ${RANKS[getRankIndex(xp + XP_PER_REVIEW)].name}!`
              : ''
          showToast(`${earnsXp ? `+${XP_PER_REVIEW} XP!` : 'Parabéns!'} Estudo concluído e enviado para o histórico.${rankMessage}`)
        } else if (current.completed && !updated.completed) {
          showToast('Revisão desfeita. O estudo voltou para a lista ativa.', 'info')
        } else if (earnsXp) {
          const nextRankIndex = getRankIndex(xp + XP_PER_REVIEW)
          showToast(
            nextRankIndex > getRankIndex(xp)
              ? `+${XP_PER_REVIEW} XP! Novo rank: ${RANKS[nextRankIndex].name}!`
              : `Revisão concluída: +${XP_PER_REVIEW} XP.`,
          )
        }
      } else if (earnsXp) {
        const nextRankIndex = getRankIndex(xp + XP_PER_REVIEW)
        showToast(
          nextRankIndex > getRankIndex(xp)
            ? `+${XP_PER_REVIEW} XP! Novo rank: ${RANKS[nextRankIndex].name}!`
            : `Tarefa concluída: +${XP_PER_REVIEW} XP.`,
        )
      }

      setStudies((previous) => previous.map((study) => (study.id === id ? updated : study)))
    },
    [progress.claimed, showToast, xp],
  )

  const addWeeklyTask = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const subject = weeklyTaskForm.subject.trim()
      const content = weeklyTaskForm.content.trim()
      if (!subject || !content || !isValidDateString(weeklyTaskForm.date)) {
        showToast('Informe a matéria, a atividade e uma data válida para o plano.', 'error')
        return
      }
      const task: WeeklyTask = {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subject,
        content,
        date: weeklyTaskForm.date,
        completed: false,
      }
      setWeeklyTasks((previous) => [...previous, task])
      setWeeklyTaskForm((previous) => ({ ...previous, subject: '', content: '' }))
      showToast('Atividade adicionada ao plano semanal.')
    },
    [showToast, weeklyTaskForm],
  )

  const toggleWeeklyTask = useCallback((id: string) => {
    setWeeklyTasks((previous) =>
      previous.map((task) => task.id === id ? { ...task, completed: !task.completed } : task),
    )
  }, [])

  const removeWeeklyTask = useCallback((id: string) => {
    setWeeklyTasks((previous) => previous.filter((task) => task.id !== id))
  }, [])

  const shiftWeeklyPlan = useCallback((weeks: number) => {
    const nextWeek = addDays(weeklyPlanWeekStart, weeks * 7)
    setWeeklyPlanWeekStart(nextWeek)
    setWeeklyTaskForm((previous) => ({ ...previous, date: nextWeek }))
  }, [weeklyPlanWeekStart])

  const goToCurrentWeeklyPlan = useCallback(() => {
    const currentWeek = getWeekStart()
    setWeeklyPlanWeekStart(currentWeek)
    setWeeklyTaskForm((previous) => ({ ...previous, date: currentWeek }))
  }, [])

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
      link.download = `NutryStudy-backup-${localDateString()}.json`
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

  const processImportFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.json')) {
        showToast('Selecione um arquivo JSON válido para importar o backup.', 'error')
        return
      }

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

  const importData = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      processImportFile(file)
    },
    [processImportFile],
  )

  const handleImportDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      setIsImportDragActive(false)
      const file = event.dataTransfer.files?.[0]
      if (!file) return
      processImportFile(file)
    },
    [processImportFile],
  )

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return
    setStudies((previous) => previous.filter((study) => study.id !== pendingDelete.id))
    showToast('Estudo excluído.')
    setPendingDelete(null)
  }, [pendingDelete, showToast])

  const requestDelete = useCallback((study: Study) => {
    if (settings.confirmBeforeDelete) {
      setPendingDelete(study)
      return
    }
    setStudies((previous) => previous.filter((item) => item.id !== study.id))
    showToast('Estudo excluído.')
  }, [settings.confirmBeforeDelete, showToast])

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

  const handleProfilePhotoChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        showToast('Escolha um arquivo de imagem para a foto do perfil.', 'error')
        event.target.value = ''
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast('A foto deve ter no máximo 2 MB.', 'error')
        event.target.value = ''
        return
      }

      const reader = new FileReader()
      reader.onerror = () => {
        showToast('Não foi possível ler a imagem selecionada.', 'error')
        if (profilePhotoInput.current) profilePhotoInput.current.value = ''
      }
      reader.onload = () => {
        const photo = reader.result
        if (typeof photo === 'string') {
          setProfileForm((previous) => ({ ...previous, photo }))
        } else {
          showToast('Não foi possível processar essa imagem.', 'error')
        }
        if (profilePhotoInput.current) profilePhotoInput.current.value = ''
      }
      reader.readAsDataURL(file)
    },
    [showToast],
  )

  const saveProfile = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const updated = { ...profileForm, name: profileForm.name.trim() }
      if (!updated.name) {
        showToast('Informe seu nome para salvar o perfil.', 'error')
        return
      }
      try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated))
        setProfile(updated)
        setIsProfileOpen(false)
        showToast('Perfil atualizado.')
      } catch (error) {
        console.error('Não foi possível salvar o perfil.', error)
        showToast('Não foi possível salvar o perfil neste dispositivo.', 'error')
      }
    },
    [profileForm, showToast],
  )

  const setTab = useCallback((tab: TabKey) => {
    setActiveTab(tab)
    setIsMobileNavOpen(false)
    setIsNotificationsOpen(false)
    const nextHash = tab === 'home' ? '#/' : `#/${tab}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
  }, [])

  const goToProfile = useCallback(() => setTab('profile'), [setTab])

  const changeCalendarMonth = useCallback((offset: number) => {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1)
    setCalendarMonth(nextMonth)
    setSelectedCalendarDate(localDateString(nextMonth))
  }, [calendarMonth])

  const goToCalendarToday = useCallback(() => {
    const today = new Date()
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedCalendarDate(localDateString(today))
  }, [])

  const tabs: { key: TabKey; label: string; icon: IconName }[] = [
    { key: 'home', label: 'Início', icon: 'home' },
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'studies', label: 'Estudos', icon: 'book' },
    { key: 'calendar', label: 'Agenda', icon: 'calendar' },
    { key: 'history', label: 'Histórico', icon: 'history' },
    { key: 'themes', label: 'Temas', icon: 'palette' },
    { key: 'settings', label: 'Configurações', icon: 'settings' },
  ]
  const mobileLeftTabs = tabs.filter((tab) => ['home', 'dashboard', 'studies'].includes(tab.key))
  const mobileRightTabs = tabs.filter((tab) => ['calendar', 'history', 'settings'].includes(tab.key))
  const activeTabLabel = activeTab === 'profile' ? 'Perfil' : tabs.find((tab) => tab.key === activeTab)?.label ?? 'NutryStudy'
  const openProfile = () => {
    setProfileForm(profile)
    setIsProfileOpen(true)
    setIsMobileNavOpen(false)
  }

  return (
    <div className="nourish-app" data-palette={palette} data-mode={themeMode} data-motion={settings.motionEnabled ? 'dynamic' : 'reduced'}>
      <style>{styles}</style>
      <div className={`ns-workspace${isSidebarCollapsed ? ' is-collapsed' : ''}${isMobileNavOpen ? ' mobile-nav-open' : ''}`}>
        {isMobileNavOpen && (
          <button
            type="button"
            className="ns-sidebar-backdrop"
            aria-label="Fechar menu"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}
        <aside className="ns-sidebar" aria-label="Menu principal">
          <div className="ns-sidebar-brand">
            <div className="ns-mark"><NutryLogo /></div>
            <div className="ns-sidebar-brand-copy">
              <div className="ns-kicker">Nutrição e aprendizado</div>
              <h1 className="ns-title">NutryStudy</h1>
            </div>
          </div>
          <button
            type="button"
            className={`ns-sidebar-profile${activeTab === 'profile' ? ' is-active' : ''}`}
            onClick={goToProfile}
            title="Meu perfil"
            aria-label={`Abrir perfil de ${profile.name}`}
          >
            <span className="ns-avatar" aria-hidden="true">
              {profile.photo ? <img src={profile.photo} alt="" /> : profile.name.charAt(0).toUpperCase()}
            </span>
            <span className="ns-profile-copy">
              <span className="ns-profile-name-row">
                <strong>Meu perfil</strong>
                <RankBadge rankIndex={currentRankIndex} size="small" />
              </span>
              <small>{profile.name} · {currentRank.name}</small>
              <span className="ns-rank-mini-track"><span className="ns-rank-mini-fill" style={{ display: 'block', width: `${rankProgress}%` }} /></span>
            </span>
          </button>
          <nav className="ns-sidebar-nav" aria-label="Navegação principal">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`ns-nav-button${activeTab === tab.key ? ' is-active' : ''}`}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                title={isSidebarCollapsed ? tab.label : undefined}
                onClick={() => setTab(tab.key)}
              >
                <span><AppIcon name={tab.icon} className="ns-ui-icon" /></span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <span className="ns-sidebar-spacer" />
          <button
            type="button"
            className="ns-sidebar-collapse"
            aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          >
            {isSidebarCollapsed
              ? <AppIcon name="arrowRight" className="ns-ui-icon" />
              : <><AppIcon name="arrowLeft" className="ns-ui-icon" /> Recolher menu</>}
          </button>
          <div className="ns-mobile-dock">
            <nav className="ns-mobile-dock-nav" aria-label="Navegação inferior">
              {mobileLeftTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`ns-mobile-dock-link${activeTab === tab.key ? ' is-active' : ''}`}
                  aria-current={activeTab === tab.key ? 'page' : undefined}
                  onClick={() => setTab(tab.key)}
                >
                  <AppIcon name={tab.icon} className="ns-ui-icon" />
                  <span>
                    {tab.key === 'dashboard' ? 'Painel' : tab.label}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="ns-fab ns-mobile-dock-create"
                aria-label="Adicionar novo estudo"
                title="Adicionar novo estudo"
                onClick={() => {
                  setIsFormOpen(true)
                }}
              >
                <span aria-hidden="true"><AppIcon name="plus" className="ns-ui-icon" /></span>
                <span>Novo</span>
              </button>
              {mobileRightTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`ns-mobile-dock-link${activeTab === tab.key ? ' is-active' : ''}${tab.key === 'settings' ? ' ns-mobile-settings-link' : ''}`}
                  aria-label={tab.key === 'settings' ? tab.label : undefined}
                  aria-current={activeTab === tab.key ? 'page' : undefined}
                  onClick={() => setTab(tab.key)}
                >
                  <AppIcon name={tab.icon} className="ns-ui-icon" />
                  <span>{tab.key === 'settings' ? 'Config' : tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="ns-main-shell">
        <div className="ns-shell">
        <header className={`ns-header${activeTab === 'home' ? ' is-home' : ''}`}>
          <div className="ns-header-start">
            <button
              type="button"
              className="ns-mobile-menu"
              aria-label={isMobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              <AppIcon name={isMobileNavOpen ? 'close' : 'menu'} className="ns-ui-icon" />
            </button>
            <div className="ns-brand">
              <div className="ns-mark"><NutryLogo /></div>
              <div>
                <div className="ns-kicker">Seu espaço de aprendizagem</div>
                <div className="ns-title">NutryStudy</div>
              </div>
            </div>
            <div className="ns-page-nav">
              <div>
                <h1>{activeTabLabel}</h1>
                <p>{activeTab === 'calendar' ? 'Organize a semana e acompanhe suas revisões.' : activeTab === 'themes' ? 'Personalize as cores e a aparência do aplicativo.' : activeTab === 'profile' ? 'Seu percurso, suas conquistas e seus dados.' : activeTab === 'settings' ? 'Ajuste o funcionamento do NutryStudy.' : 'Seu espaço de aprendizagem e evolução.'}</p>
              </div>
            </div>
          </div>
          <form
            className="ns-header-search"
            role="search"
            aria-label="Busca rápida de estudos"
            onSubmit={(event) => {
              event.preventDefault()
              setSubjectFilter('ALL')
              setTab('studies')
            }}
          >
            <AppIcon name="search" className="ns-ui-icon" />
            <input
              ref={headerSearchInput}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar estudos..."
              aria-label="Buscar matéria ou conteúdo"
            />
            <kbd aria-hidden="true">Ctrl K</kbd>
          </form>
          <div className="ns-actions">
            <div className="ns-notification-wrap" ref={notificationWrap}>
              <button
                type="button"
                className={`ns-icon-button ns-notification-button${notificationCount ? ' is-attention' : ''}`}
                onClick={() => setIsNotificationsOpen((open) => !open)}
                title={`${overdue.length} atrasadas · ${dueToday.length} para hoje`}
                aria-label={notificationCount
                  ? `Ver notificações: ${overdue.length} revisões atrasadas e ${dueToday.length} para hoje.`
                  : 'Ver notificações. Nenhuma revisão atrasada ou para hoje.'}
                aria-expanded={isNotificationsOpen}
                aria-controls="ns-notification-panel"
              >
                <AppIcon name="bell" className="ns-ui-icon" />
                {notificationCount > 0 && <span className="ns-notification-count" aria-hidden="true">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </button>
              {isNotificationsOpen && (
                <section className="ns-notification-panel" id="ns-notification-panel" aria-label="Notificações de revisão" aria-live="polite">
                  <div className="ns-notification-panel-header">
                    <div>
                      <h2>Notificações</h2>
                      <p>{notificationCount
                        ? `${notificationCount} ${notificationCount === 1 ? 'revisão pendente' : 'revisões pendentes'} · ${overdue.length} atrasadas · ${dueToday.length} para hoje`
                        : 'Seu cronograma de revisões está em dia.'}</p>
                    </div>
                    <button type="button" className="ns-icon-button" aria-label="Fechar notificações" onClick={() => setIsNotificationsOpen(false)}>
                      <AppIcon name="close" className="ns-ui-icon" />
                    </button>
                  </div>
                  {reviewNotifications.length ? (
                    <div className="ns-notification-list">
                      {reviewNotifications.map((item) => (
                        <article className={`ns-notification-item${item.status === 'overdue' ? ' is-overdue' : ''}`} key={`${item.study.id}:${item.field}`}>
                          <div className="ns-notification-item-top">
                            <span className="ns-notification-status">
                              <AppIcon name={item.status === 'overdue' ? 'alert' : 'clock'} className="ns-ui-icon" />
                              {item.status === 'overdue' ? 'Revisão atrasada' : 'Revisão para hoje'}
                            </span>
                            <time dateTime={item.date}>{formatDateBR(item.date)}</time>
                          </div>
                          <h3>{item.study.subject} · Revisão de {item.label}</h3>
                          <p title={item.study.content}>{item.study.content}</p>
                          <div className="ns-notification-item-actions">
                            <button
                              type="button"
                              className="ns-button ns-button-primary"
                              onClick={() => toggleStudyField(item.study.id, item.field)}
                            >
                              <AppIcon name="check" className="ns-ui-icon" /> Concluir
                            </button>
                            <button
                              type="button"
                              className="ns-button"
                              onClick={() => {
                                const date = new Date(`${item.date}T00:00:00`)
                                setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                                setSelectedCalendarDate(item.date)
                                setTab('calendar')
                              }}
                            >
                              <AppIcon name="calendar" className="ns-ui-icon" /> Abrir agenda
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="ns-notification-empty">
                      <AppIcon name="check" className="ns-ui-icon" />
                      <strong>Nenhuma revisão pendente</strong>
                      <span>Revisões atrasadas ou previstas para hoje aparecerão aqui.</span>
                    </div>
                  )}
                </section>
              )}
            </div>
            {activeTab === 'home' && (
              <>
                <label
                  className={`ns-button ns-header-action ns-file-label${isImportDragActive ? ' is-dragover' : ''}`}
                  title="Importar backup JSON"
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsImportDragActive(true)
                  }}
                  onDragLeave={() => setIsImportDragActive(false)}
                  onDrop={handleImportDrop}
                >
                  {isImporting ? <span className="ns-loading"><span className="ns-spinner" />Importando</span> : <><AppIcon name="arrowUp" className="ns-ui-icon" /> <span>Importar</span></>}
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
                  className="ns-button ns-header-action"
                  onClick={exportData}
                  disabled={isExporting}
                >
                  {isExporting ? <span className="ns-loading"><span className="ns-spinner" />Exportando</span> : <><AppIcon name="arrowDown" className="ns-ui-icon" /> Exportar</>}
                </button>
              </>
            )}
            <button type="button" className="ns-header-profile" onClick={goToProfile} aria-label="Abrir meu perfil">
              <span className="ns-avatar" aria-hidden="true">
                {profile.photo ? <img src={profile.photo} alt="" /> : profile.name.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </header>

        {toast && (
          <div className={`ns-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
            {toast.message}
          </div>
        )}

        <main className="ns-app-content">
          {activeTab === 'not-found' && (
            <section className="ns-section" aria-labelledby="page-not-found-title">
              <div className="ns-empty" style={{ padding: '38px 22px' }}>
                <div className="ns-empty-icon"><AppIcon name="spark" className="ns-ui-icon" /></div>
                <h3 id="page-not-found-title">Essa página não existe</h3>
                <p>O endereço informado não corresponde a uma área do NutryStudy. Volte para a página inicial ou escolha uma aba válida.</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                  <button type="button" className="ns-button ns-button-primary" onClick={() => setTab('home')}>
                    Voltar para o início
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'home' && (
            <>
              <section className="ns-intro" aria-labelledby="welcome-title">
                <div className="ns-intro-copy">
                  <div className="ns-date">{todayLabel}</div>
                  <h2 className="ns-greeting" id="welcome-title">Olá, {profile.name}! <AppIcon name="leaf" className="ns-greeting-icon" /></h2>
                  <p className="ns-subtitle">Um passo de cada vez. Vamos cuidar do seu próximo aprendizado?</p>
                </div>
                <aside className="ns-focus-card" aria-label="Resumo e próximo foco de estudos">
                  <div className="ns-focus-heading"><span>Seu ritmo de hoje</span><AppIcon name="spark" className="ns-ui-icon" /></div>
                  <div className="ns-focus-counts">
                    <span><strong>{overdue.length}</strong><small>em atraso</small></span>
                    <i aria-hidden="true" />
                    <span><strong>{dueToday.length}</strong><small>para hoje</small></span>
                  </div>
                  <div className="ns-focus-progress">
                    <div className="ns-focus-progress-top"><span>Ciclo de revisões</span><strong>{completionRate}%</strong></div>
                    <span className="ns-progress-track" role="progressbar" aria-label="Progresso total do ciclo de revisões" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionRate}>
                      <span className="ns-progress-fill" style={{ display: 'block', width: `${completionRate}%` }} />
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ns-focus-link"
                    title={focusStudy ? `Continuar: ${focusStudy.content}` : 'Adicionar seu próximo estudo'}
                    onClick={() => {
                      if (!activeStudies.length) {
                        setIsFormOpen(true)
                        return
                      }
                      setSearchQuery(focusStudy?.subject ?? '')
                      setSubjectFilter('ALL')
                      setTab('studies')
                    }}
                  >
                    <span>{focusStudy ? `Continuar: ${focusStudy.content}` : 'Adicionar seu próximo estudo'}</span>
                    <AppIcon name="arrowRight" className="ns-ui-icon" />
                  </button>
                </aside>
              </section>

              <section className="ns-home-actions">
                <button type="button" className="ns-home-action-card" onClick={() => setTab('dashboard')}>
                  <span className="ns-home-action-icon"><AppIcon name="dashboard" className="ns-ui-icon" /></span>
                  <span><strong>Acompanhar progresso</strong><small>Veja seu dashboard e evolução de rank</small></span>
                  <span className="ns-home-action-arrow"><AppIcon name="arrowRight" className="ns-ui-icon" /></span>
                </button>
                <button type="button" className="ns-home-action-card" onClick={() => setTab('calendar')}>
                  <span className="ns-home-action-icon"><AppIcon name="calendar" className="ns-ui-icon" /></span>
                  <span><strong>Planejar revisões</strong><small>Abra o calendário mensal interativo</small></span>
                  <span className="ns-home-action-arrow"><AppIcon name="arrowRight" className="ns-ui-icon" /></span>
                </button>
              </section>
              <section className="ns-contact-card" aria-labelledby="nutrition-contact-title">
                <div className="ns-contact-copy">
                  <span className="ns-contact-eyebrow"><AppIcon name="leaf" className="ns-ui-icon" /> Nutrição com propósito</span>
                  <h2 id="nutrition-contact-title">Conheça a jornada da <span>Lívia</span></h2>
                  <p>Estudante de Nutrição em fase final da graduação. Acompanhe suas publicações e entre em contato pelo perfil oficial.</p>
                  <a
                    className="ns-contact-handle"
                    href="https://www.instagram.com/livia.arauj_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir @livia.arauj_ no Instagram em uma nova aba"
                  >
                    <AppIcon name="instagram" className="ns-ui-icon" /> @livia.arauj_
                  </a>
                  <a
                    className="ns-button ns-contact-link"
                    href="https://www.instagram.com/livia.arauj_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visitar perfil da Livia no Instagram em uma nova aba"
                  >
                    <AppIcon name="instagram" className="ns-ui-icon" /> Visitar perfil
                    <AppIcon name="arrowRight" className="ns-ui-icon" />
                  </a>
                </div>
                <div className="ns-instagram-preview">
                  <div className="ns-instagram-preview-header">
                    <strong><AppIcon name="instagram" className="ns-ui-icon" /> Perfil no Instagram</strong>
                    <span className="ns-instagram-live">Visão atualizada</span>
                  </div>
                  <div className="ns-instagram-feed" aria-label="Publicações recentes do perfil público da Livia">
                    <iframe
                      className="ns-instagram-frame"
                      src="https://www.instagram.com/livia.arauj_/embed"
                      title="Prévia atualizada do perfil público de Livia no Instagram"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allow="encrypted-media"
                    />
                    <div className="ns-instagram-fade" aria-hidden="true">
                      <span className="ns-instagram-fade-layer" />
                    </div>
                  </div>
                  <p className="ns-instagram-fallback">A prévia depende da disponibilidade do Instagram e de o perfil estar público. Se não carregar, use “Visitar perfil”.</p>
                </div>
              </section>
            </>
          )}

          {activeTab === 'profile' && (
            <section className="ns-section ns-profile-page" aria-label="Perfil e progresso">
              <article className="ns-profile-hero">
                <span className="ns-avatar ns-profile-page-avatar" aria-hidden="true">
                  {profile.photo ? <img src={profile.photo} alt="" /> : profile.name.charAt(0).toUpperCase()}
                </span>
                <div className="ns-profile-hero-copy">
                  <span className="ns-profile-eyebrow">Sua jornada NutryStudy</span>
                  <h2>{profile.name}</h2>
                  <p><RankBadge rankIndex={currentRankIndex} size="small" /> {currentRank.name} · {currentRank.title}</p>
                </div>
                <button type="button" className="ns-button ns-profile-edit" onClick={openProfile}>
                  <AppIcon name="user" className="ns-ui-icon" /> Editar perfil
                </button>
              </article>
              <div className="ns-profile-stat-grid" aria-label="Resumo do seu progresso">
                <article className="ns-profile-stat"><span>Revisões concluídas</span><strong>{totalReviews}</strong></article>
                <article className="ns-profile-stat"><span>Progresso do ciclo</span><strong>{completionRate}%</strong></article>
                <article className="ns-profile-stat"><span>Estudos em andamento</span><strong>{activeStudies.length}</strong></article>
                <article className="ns-profile-stat"><span>Ciclos concluídos</span><strong>{completedStudies.length}</strong></article>
              </div>
              <article className="ns-profile-progress-panel">
                <div className="ns-section-heading">
                  <div><h2>Próxima conquista</h2><p>{nextRank ? `${nextRank.minXp - xp} XP para alcançar ${nextRank.name}` : 'Você alcançou o rank máximo.'}</p></div>
                  <strong>{xp} XP</strong>
                </div>
                <div className="ns-progress-track" role="progressbar" aria-label="Progresso para o próximo rank" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rankProgress}>
                  <div className="ns-progress-fill" style={{ width: `${rankProgress}%` }} />
                </div>
                <div className="ns-rank-roadmap ns-profile-roadmap" aria-label="Ranks disponíveis">
                  {RANKS.map((rank, index) => (
                    <div className={`ns-rank-roadmap-item${index === currentRankIndex ? ' is-current' : ''}`} key={rank.name} title={rank.description}>
                      <span><RankBadge rankIndex={index} size="small" /> <AppIcon name={index <= currentRankIndex ? 'check' : 'diamond'} className="ns-rank-status-icon" /> {rank.name} · {rank.title}</span>
                      <span>{rank.minXp} XP</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="ns-section ns-settings-page" aria-label="Configurações do aplicativo">
              <article className="ns-theme-panel ns-settings-panel">
                <div className="ns-settings-heading">
                  <span className="ns-theme-mode-icon"><AppIcon name="settings" className="ns-ui-icon" /></span>
                  <div><h2>Preferências do aplicativo</h2><p>Personalize a inicialização, o dashboard e o comportamento da interface.</p></div>
                </div>
                <label className="ns-setting-row">
                  <span><strong>Página inicial ao abrir</strong><small>Escolha qual área será exibida quando voltar ao NutryStudy.</small></span>
                  <select
                    className="ns-input ns-setting-select"
                    value={settings.startPage}
                    aria-label="Página inicial ao abrir"
                    onChange={(event) => setSettings((previous) => ({ ...previous, startPage: event.target.value === 'dashboard' ? 'dashboard' : 'home' }))}
                  >
                    <option value="home">Início</option>
                    <option value="dashboard">Dashboard</option>
                  </select>
                </label>
                <label className="ns-setting-row">
                  <span><strong>Período inicial do dashboard</strong><small>Define o intervalo selecionado ao abrir o gráfico de revisões.</small></span>
                  <select
                    className="ns-input ns-setting-select"
                    value={settings.defaultDashboardRange}
                    aria-label="Período inicial do dashboard"
                    onChange={(event) => {
                      const range: DashboardRange = event.target.value === '14' ? 14 : 7
                      setDashboardRange(range)
                      setSettings((previous) => ({ ...previous, defaultDashboardRange: range }))
                    }}
                  >
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                  </select>
                </label>
                <div className="ns-setting-row">
                  <span><strong>Confirmar antes de excluir</strong><small>Evita remover um estudo por engano. Desativando, a exclusão será imediata.</small></span>
                  <button
                    type="button"
                    className={`ns-setting-switch${settings.confirmBeforeDelete ? ' is-active' : ''}`}
                    role="switch"
                    aria-checked={settings.confirmBeforeDelete}
                    aria-label="Confirmar antes de excluir estudos"
                    onClick={() => setSettings((previous) => ({ ...previous, confirmBeforeDelete: !previous.confirmBeforeDelete }))}
                  ><span /></button>
                </div>
                <div className="ns-setting-row">
                  <span><strong>Transições dinâmicas</strong><small>Use animações rápidas ao navegar e interagir. Desative para reduzir movimento.</small></span>
                  <button
                    type="button"
                    className={`ns-setting-switch${settings.motionEnabled ? ' is-active' : ''}`}
                    role="switch"
                    aria-checked={settings.motionEnabled}
                    aria-label="Transições dinâmicas"
                    onClick={() => setSettings((previous) => ({ ...previous, motionEnabled: !previous.motionEnabled }))}
                  ><span /></button>
                </div>
              </article>
              <button type="button" className="ns-settings-theme-link" onClick={() => setTab('themes')}>
                <span className="ns-theme-mode-icon"><AppIcon name="palette" className="ns-ui-icon" /></span>
                <span className="ns-settings-theme-link-copy">
                  <strong>Aparência e paletas</strong>
                  <small>Personalize as cores e o modo do NutryStudy.</small>
                </span>
                <AppIcon name="arrowRight" className="ns-ui-icon" />
              </button>
              <p className="ns-settings-note"><AppIcon name="check" className="ns-ui-icon" /> Preferências salvas neste navegador; não alteram seus estudos nem o backup.</p>
              <aside className="ns-developer-card" aria-label="Sobre o desenvolvedor">
                <div className="ns-developer-copy">
                  <small>Sobre o desenvolvedor</small>
                  <strong>Marcos Lucas</strong>
                  <p>Conheça mais sobre quem criou o NutryStudy.</p>
                </div>
                <a className="ns-developer-link" href="https://github.com/LucasReisD" target="_blank" rel="noopener noreferrer" aria-label="Ver perfil de Marcos Lucas no GitHub (abre em nova aba)">
                  <span>GitHub</span>
                  <AppIcon name="arrowRight" className="ns-ui-icon" />
                </a>
              </aside>
            </section>
          )}

          {activeTab === 'themes' && (
            <section className="ns-section ns-themes-page" aria-label="Configurações de temas">
              <article className="ns-theme-panel">
                <h2>Modo de aparência</h2>
                <p>Escolha entre uma interface clara ou escura.</p>
                <div className="ns-theme-modes" role="group" aria-label="Modo de aparência">
                  <button
                    type="button"
                    className={`ns-theme-mode${themeMode === 'light' ? ' is-active' : ''}`}
                    aria-pressed={themeMode === 'light'}
                    onClick={() => setThemeMode('light')}
                  >
                    <span className="ns-theme-mode-icon"><AppIcon name="sun" className="ns-ui-icon" /></span>
                    <span><strong>Modo claro</strong><small>Visual leve para ambientes iluminados</small></span>
                  </button>
                  <button
                    type="button"
                    className={`ns-theme-mode${themeMode === 'dark' ? ' is-active' : ''}`}
                    aria-pressed={themeMode === 'dark'}
                    onClick={() => setThemeMode('dark')}
                  >
                    <span className="ns-theme-mode-icon"><AppIcon name="moon" className="ns-ui-icon" /></span>
                    <span><strong>Modo escuro</strong><small>Conforto visual em ambientes com pouca luz</small></span>
                  </button>
                </div>
              </article>
              <article className="ns-theme-panel">
                <h2>Paletas de cores</h2>
                <p>{themeMode === 'dark' ? 'Escolha um acento para combinar com a base grafite do modo escuro.' : 'Escolha uma paleta para personalizar as cores do NutryStudy.'}</p>
                <div className="ns-palette-grid">
                  {PALETTES.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`ns-palette-option${lightPalette === option.key ? ' is-active' : ''}`}
                      aria-pressed={lightPalette === option.key}
                      onClick={() => setLightPalette(option.key)}
                    >
                      <span className="ns-palette-swatches" aria-hidden="true">
                        {(themeMode === 'dark' ? option.darkSwatches : option.swatches).map((swatch) => <i key={swatch} style={{ background: swatch }} />)}
                      </span>
                      {option.name}
                    </button>
                  ))}
                </div>
              </article>
            </section>
          )}

          {activeTab === 'dashboard' && (
            <>
              <section className="ns-dashboard-welcome" aria-label="Visão geral da sua jornada">
                <div className="ns-dashboard-welcome-copy">
                  <span className="ns-dashboard-eyebrow"><AppIcon name="leaf" className="ns-ui-icon" /> SEU ESPAÇO DE EVOLUÇÃO</span>
                  <h2>Seu próximo passo começa <span>hoje.</span></h2>
                  <p>Acompanhe seu ritmo, organize as revisões e avance com consistência.</p>
                  <div className="ns-dashboard-welcome-actions">
                    <button type="button" className="ns-dashboard-primary-action" onClick={() => setIsFormOpen(true)}>
                      <AppIcon name="plus" className="ns-ui-icon" /> Novo estudo
                    </button>
                    <button type="button" className="ns-dashboard-secondary-action" onClick={() => { goToCalendarToday(); setTab('calendar') }}>
                      <AppIcon name="calendar" className="ns-ui-icon" /> Abrir agenda
                    </button>
                  </div>
                </div>
                <div className="ns-dashboard-welcome-rank">
                  <span className="ns-dashboard-rank-badge"><RankBadge rankIndex={currentRankIndex} /></span>
                  <span><small>RANK ATUAL</small><strong>{currentRank.name}</strong><em>{xp} XP acumulados</em></span>
                </div>
                <span className="ns-dashboard-welcome-glow" aria-hidden="true" />
              </section>
              <section className="ns-metrics" aria-label="Resumo de estudos">
                <button type="button" className="ns-metric ns-metric-action" onClick={() => { goToCalendarToday(); setTab('calendar') }} aria-label={`${dueToday.length} revisões para hoje. Abrir agenda.`}>
                  <span className="ns-metric-label"><span className="ns-metric-icon"><AppIcon name="clock" className="ns-ui-icon" /></span> Revisões hoje</span>
                  <strong className="ns-metric-value">{dueToday.length}</strong>
                </button>
                <button type="button" className="ns-metric ns-metric-action" onClick={() => { setSearchQuery(''); setSubjectFilter('ALL'); setTab('studies') }} aria-label={`${overdue.length} estudos com revisões atrasadas. Abrir estudos.`}>
                  <span className="ns-metric-label"><span className="ns-metric-icon"><AppIcon name="alert" className="ns-ui-icon" /></span> Em atraso</span>
                  <strong className="ns-metric-value">{overdue.length}</strong>
                </button>
                <button type="button" className="ns-metric ns-metric-action" onClick={() => { setSearchQuery(''); setSubjectFilter('ALL'); setTab('studies') }} aria-label={`${activeStudies.length} estudos ativos. Abrir estudos.`}>
                  <span className="ns-metric-label"><span className="ns-metric-icon"><AppIcon name="book" className="ns-ui-icon" /></span> Estudos ativos</span>
                  <strong className="ns-metric-value">{activeStudies.length}</strong>
                </button>
                <button type="button" className="ns-metric ns-metric-action" onClick={goToProfile} aria-label={`${totalReviews} revisões feitas, ${completionRate}% do ciclo. Abrir perfil e ranks.`}>
                  <div className="ns-metric-label"><span className="ns-metric-icon"><AppIcon name="check" className="ns-ui-icon" /></span> Revisões feitas</div>
                  <strong className="ns-metric-value">{totalReviews}</strong>
                  <span className="ns-muted">{completionRate}% do ciclo total</span>
                </button>
              </section>

              <section className="ns-dashboard" aria-label="Dashboard de progresso">
                {studies.length === 0 ? (
                  <div className="ns-dashboard-empty">
                    Adicione seu primeiro estudo para acompanhar o progresso e visualizar as próximas revisões.
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ns-dashboard-card ns-dashboard-action"
                      onClick={goToProfile}
                      aria-label={`Progresso geral ${completionRate} por cento; rank ${currentRank.name}. Abrir perfil e ranks.`}
                    >
                      <div className="ns-dashboard-heading">
                        <div>
                          <h2>Seu progresso</h2>
                          <p>Revisões concluídas no ciclo · abrir perfil e ranks</p>
                        </div>
                      </div>
                      <div className="ns-progress-overview">
                        <div
                          className="ns-progress-ring"
                          role="img"
                          aria-label={`${completionRate}% das revisões concluídas`}
                          style={{ '--progress': `${completionRate}%` } as CSSProperties}
                        >
                          <strong>{completionRate}%</strong>
                        </div>
                        <div className="ns-progress-copy">
                          <strong>{totalReviews} de {studies.length * 3} revisões</strong>
                          <span>{completedStudies.length} estudos concluídos · {activeStudies.length} em andamento</span>
                          <div
                            className="ns-progress-track"
                            role="progressbar"
                            aria-label="Progresso total das revisões"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={completionRate}
                          >
                            <div className="ns-progress-fill" style={{ width: `${completionRate}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="ns-rank-summary" style={{ marginTop: 18 }}>
                        <strong><RankBadge rankIndex={currentRankIndex} /> {currentRank.name} — {currentRank.title}</strong>
                        <p>{currentRank.description}</p>
                        <p>{xp} XP · {nextRank ? `${nextRank.minXp - xp} XP para chegar a ${nextRank.name}` : 'Você alcançou o rank máximo.'}</p>
                        <div
                          className="ns-progress-track"
                          role="progressbar"
                          aria-label="Progresso para o próximo rank"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={rankProgress}
                        >
                          <div className="ns-progress-fill" style={{ width: `${rankProgress}%` }} />
                        </div>
                      </div>
                    </button>

                    <article className="ns-dashboard-card">
                      <div className="ns-dashboard-heading ns-schedule-heading">
                        <div>
                          <h2>Revisões para fazer</h2>
                          <p>Etapas liberadas para os próximos {dashboardRange} dias</p>
                        </div>
                        <div className="ns-range-switch" role="group" aria-label="Período da lista de revisões">
                          {([7, 14] as const).map((range) => (
                            <button
                              key={range}
                              type="button"
                              className={`ns-range-button${dashboardRange === range ? ' is-active' : ''}`}
                              aria-pressed={dashboardRange === range}
                              onClick={() => {
                                setDashboardRange(range)
                              }}
                            >
                              {range} dias
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ns-schedule-summary" role="status" aria-live="polite">
                        <span className="ns-schedule-summary-icon"><AppIcon name="calendar" className="ns-ui-icon" /></span>
                        <span>
                          <strong>{dashboardPendingCount} {dashboardPendingCount === 1 ? 'revisão liberada' : 'revisões liberadas'}</strong>
                          <small>Prontas para você estudar neste período</small>
                        </span>
                      </div>
                      {dashboardPendingDays.length === 0 ? (
                        <div className="ns-schedule-empty">
                          <strong>Nenhuma revisão liberada por enquanto</strong>
                          <span>As próximas etapas aparecem aqui quando chegar a data e a revisão anterior estiver concluída.</span>
                          <button type="button" className="ns-schedule-empty-link" onClick={() => { goToCalendarToday(); setTab('calendar') }}>
                            Ver agenda completa <AppIcon name="arrowRight" className="ns-ui-icon" />
                          </button>
                        </div>
                      ) : (
                        <div className="ns-schedule-list" aria-label={`Revisões liberadas nos próximos ${dashboardRange} dias`}>
                          {dashboardPendingDays.map((day, index) => {
                            const date = new Date(`${day.date}T00:00:00`)
                            const dateLabel = index === 0 && day.date === localDateString()
                              ? 'Hoje'
                              : date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
                            return (
                              <article className="ns-schedule-day" key={day.date}>
                                <div className="ns-schedule-day-date">
                                  <strong>{dateLabel}</strong>
                                  <span>{day.pending} {day.pending === 1 ? 'revisão' : 'revisões'}</span>
                                </div>
                                <div className="ns-schedule-day-items">
                                  {day.items.map((item, itemIndex) => (
                                    <div className="ns-schedule-item" key={`${item.content}-${itemIndex}`}>
                                      <span className="ns-schedule-item-dot" aria-hidden="true" />
                                      <span><strong>{item.subject}</strong><small>{item.label} · {item.content}</small></span>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  className="ns-schedule-open-day"
                                  aria-label={`Abrir agenda de ${dateLabel}`}
                                  onClick={() => {
                                    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                                    setSelectedCalendarDate(day.date)
                                    setTab('calendar')
                                  }}
                                >
                                  <AppIcon name="arrowRight" className="ns-ui-icon" />
                                </button>
                              </article>
                            )
                          })}
                        </div>
                      )}
                      <p className="ns-schedule-hint">Revisões futuras são liberadas após concluir a etapa anterior.</p>
                    </article>

                    <article className="ns-dashboard-card" style={{ gridColumn: '1 / -1' }}>
                      <div className="ns-dashboard-heading">
                        <div>
                          <h2>Progresso por matéria</h2>
                          <p>Selecione uma matéria para ver o progresso detalhado</p>
                        </div>
                      </div>
                      <div className="ns-subject-progress">
                        {subjectProgress.map((progress) => {
                          const hasActiveStudies = activeStudies.some((study) => study.subject === progress.subject)
                          return (
                            <button
                              type="button"
                              className="ns-subject-progress-button"
                              key={progress.subject}
                              aria-label={`${progress.subject}: ${progress.rate}% concluído, ${progress.count} ${progress.count === 1 ? 'estudo' : 'estudos'}. Abrir ${hasActiveStudies ? 'estudos ativos' : 'histórico'}.`}
                              onClick={() => {
                                setSubjectFilter(progress.subject)
                                setSearchQuery('')
                                setTab(hasActiveStudies ? 'studies' : 'history')
                              }}
                            >
                              <span className="ns-subject-progress-top">
                                <strong>{progress.subject}</strong>
                                <span>{progress.rate}%</span>
                              </span>
                              <span
                                className="ns-progress-track"
                                role="progressbar"
                                aria-label={`Progresso de ${progress.subject}`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress.rate}
                              >
                                <span className="ns-progress-fill" style={{ display: 'block', width: `${progress.rate}%` }} />
                              </span>
                              <span className="ns-subject-progress-meta">{progress.done}/{progress.total} revisões · {progress.count} {progress.count === 1 ? 'estudo' : 'estudos'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </article>
                  </>
                )}
              </section>
            </>
          )}

          {activeTab === 'home' && (
            <>
              <section className="ns-section" aria-labelledby="priority-title">
                <div className="ns-section-heading">
                  <h2 id="priority-title">Prioridades</h2>
                  <div className="ns-priority-summary">
                    {overdue.length > 0 && <span className="ns-priority-badge is-late"><AppIcon name="alert" className="ns-ui-icon" /> {overdue.length} atrasadas</span>}
                    {dueToday.length > 0 && <span className="ns-priority-badge is-today"><AppIcon name="clock" className="ns-ui-icon" /> {dueToday.length} hoje</span>}
                    {notificationCount === 0 && <span className="ns-priority-badge is-clear"><AppIcon name="check" className="ns-ui-icon" /> Tudo em dia</span>}
                    {notificationCount > 0 && <button type="button" className="ns-button" onClick={() => setTab('dashboard')}>Ver dashboard</button>}
                  </div>
                </div>
                {notificationCount === 0 ? (
                  <EmptyState icon="spark" title="Tudo em dia" description="Nenhuma revisão pendente para hoje. Aproveite para adicionar um novo tema." />
                ) : (
                  <div className="ns-list">
                    {[...overdue, ...dueToday].map((study) => (
                      <StudyCard key={study.id} study={study} onToggle={toggleStudyField} onDelete={requestDelete} />
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
              <div className="ns-filters" role="group" aria-label="Filtrar por matéria">
                <button type="button" className={`ns-filter${subjectFilter === 'ALL' ? ' is-active' : ''}`} aria-pressed={subjectFilter === 'ALL'} onClick={() => setSubjectFilter('ALL')}>
                  Todas ({activeStudies.length})
                </button>
                {subjects.map((subject) => (
                  <button
                    type="button"
                    className={`ns-filter${subjectFilter === subject ? ' is-active' : ''}`}
                    aria-pressed={subjectFilter === subject}
                    key={subject}
                    onClick={() => setSubjectFilter(subject)}
                  >
                    {subject}
                  </button>
                ))}
              </div>
              {filteredStudies.length === 0 ? (
                <EmptyState
                  icon={activeStudies.length === 0 ? 'book' : 'search'}
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
                    <StudyCard key={study.id} study={study} onToggle={toggleStudyField} onDelete={requestDelete} />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'calendar' && (
            <section className="ns-section" aria-labelledby="calendar-title">
              <section className="ns-weekly-plan" aria-labelledby="weekly-plan-title">
                <div className="ns-weekly-plan-header">
                  <div>
                    <h2 id="weekly-plan-title">Plano de estudos da semana</h2>
                    <p>{weeklyPlanRangeLabel} · {weeklyPlanCompletedCount} de {weeklyPlanTaskCount} atividades concluídas</p>
                  </div>
                  <div className="ns-weekly-plan-controls" aria-label="Navegar entre semanas">
                    <button type="button" className="ns-icon-button" aria-label="Semana anterior" onClick={() => shiftWeeklyPlan(-1)}><AppIcon name="arrowLeft" className="ns-ui-icon" /></button>
                    <button type="button" className="ns-button" onClick={goToCurrentWeeklyPlan}>Esta semana</button>
                    <button type="button" className="ns-icon-button" aria-label="Próxima semana" onClick={() => shiftWeeklyPlan(1)}><AppIcon name="arrowRight" className="ns-ui-icon" /></button>
                  </div>
                </div>
                <form className="ns-weekly-form" onSubmit={addWeeklyTask}>
                  <input
                    className="ns-input"
                    type="text"
                    list="weekly-plan-subjects"
                    placeholder="Matéria"
                    aria-label="Matéria da atividade"
                    value={weeklyTaskForm.subject}
                    onChange={(event) => setWeeklyTaskForm((previous) => ({ ...previous, subject: event.target.value }))}
                    required
                  />
                  <datalist id="weekly-plan-subjects">
                    {Array.from(new Set(studies.map((study) => study.subject))).map((subject) => <option key={subject} value={subject} />)}
                  </datalist>
                  <input
                    className="ns-input"
                    type="text"
                    placeholder="O que vai estudar?"
                    aria-label="Atividade de estudo"
                    value={weeklyTaskForm.content}
                    onChange={(event) => setWeeklyTaskForm((previous) => ({ ...previous, content: event.target.value }))}
                    required
                  />
                  <input
                    className="ns-input"
                    type="date"
                    aria-label="Data da atividade"
                    value={weeklyTaskForm.date}
                    onChange={(event) => setWeeklyTaskForm((previous) => ({ ...previous, date: event.target.value }))}
                    required
                  />
                  <button type="submit" className="ns-button ns-button-primary"><AppIcon name="plus" className="ns-ui-icon" /> Adicionar</button>
                </form>
                <div className="ns-weekly-days" aria-label="Atividades planejadas para a semana">
                  {weeklyPlanDays.map((day) => (
                    <article className={`ns-weekly-day${day.date === localDateString() ? ' is-today' : ''}`} key={day.date}>
                      <div className="ns-weekly-day-heading">
                        <span>{day.dayLabel}</span>
                        <span>{day.dayNumber}</span>
                      </div>
                      {day.tasks.length === 0 ? (
                        <span className="ns-weekly-day-empty">Sem atividades</span>
                      ) : (
                        <div className="ns-weekly-task-list">
                          {day.tasks.map((task) => (
                            <div className="ns-weekly-task" key={task.id}>
                              <button
                                type="button"
                                className={`ns-weekly-task-toggle${task.completed ? ' is-done' : ''}`}
                                aria-pressed={task.completed}
                                aria-label={`${task.completed ? 'Reabrir' : 'Concluir'} ${task.content} de ${task.subject}`}
                                onClick={() => toggleWeeklyTask(task.id)}
                              >
                                <AppIcon name="check" className="ns-ui-icon" />
                                <span className="ns-weekly-task-copy">
                                  {task.content}
                                  <small>{task.subject}</small>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="ns-weekly-task-remove"
                                aria-label={`Remover atividade ${task.content}`}
                                onClick={() => removeWeeklyTask(task.id)}
                              >
                                <AppIcon name="close" className="ns-ui-icon" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              <div className="ns-calendar-layout">
                <article className="ns-calendar-panel">
                  <div className="ns-calendar-toolbar">
                    <div>
                      <h2 className="ns-calendar-month" id="calendar-title">
                        {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </h2>
                      <span className="ns-muted">Selecione um dia para ver as revisões</span>
                    </div>
                    <div className="ns-calendar-controls">
                      <button type="button" className="ns-button" onClick={goToCalendarToday}>Hoje</button>
                      <button type="button" className="ns-icon-button" aria-label="Mês anterior" title="Mês anterior" onClick={() => changeCalendarMonth(-1)}><AppIcon name="arrowLeft" className="ns-ui-icon" /></button>
                      <button type="button" className="ns-icon-button" aria-label="Próximo mês" title="Próximo mês" onClick={() => changeCalendarMonth(1)}><AppIcon name="arrowRight" className="ns-ui-icon" /></button>
                    </div>
                  </div>
                  <div className="ns-calendar-grid" role="grid" aria-label={calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}>
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((weekday) => (
                      <span className="ns-calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>
                    ))}
                    {calendarGrid.map((cell, index) => {
                      if (!cell) {
                        return <span key={`empty-${index}`} className="ns-calendar-day is-outside" aria-hidden="true" />
                      }
                      const isToday = cell.date === localDateString()
                      const selected = cell.date === selectedCalendarDate
                      const completedCount = cell.items.filter((item) => item.done).length
                      const pendingCount = cell.items.filter((item) => !item.done && item.available).length
                      const lockedCount = cell.items.filter((item) => !item.done && !item.available).length
                      const monthLabel = new Date(`${cell.date}T00:00:00`).toLocaleDateString('pt-BR', { month: 'long' })
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          role="gridcell"
                          className={`ns-calendar-day${isToday ? ' is-today' : ''}${selected ? ' is-selected' : ''}`}
                          aria-label={`${cell.day} de ${monthLabel}${isToday ? ', hoje' : ''}: ${cell.items.length} ${cell.items.length === 1 ? 'revisão' : 'revisões'}`}
                          aria-pressed={selected}
                          onClick={() => setSelectedCalendarDate(cell.date)}
                        >
                          <span className="ns-calendar-day-number">{cell.day}</span>
                          {cell.items.length > 0 && (
                            <>
                              <span className="ns-calendar-dots" aria-hidden="true">
                                {cell.items.slice(0, 4).map((item, dotIndex) => (
                                  <span
                                    key={`${item.studyId}-${item.field}-${dotIndex}`}
                                    className={`ns-calendar-dot${item.done ? ' is-done' : !item.available ? ' is-locked' : ''}`}
                                  />
                                ))}
                              </span>
                              <span className="ns-calendar-day-count">
                                {pendingCount > 0
                                  ? `${pendingCount} pend.`
                                  : lockedCount > 0
                                    ? `${lockedCount} ${lockedCount === 1 ? 'bloqueada' : 'bloqueadas'}`
                                    : <>{completedCount} <AppIcon name="check" className="ns-ui-icon" /></>}
                              </span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div className="ns-calendar-legend" aria-label="Legenda do calendário">
                    <span className="ns-legend-item"><span className="ns-calendar-dot" />Pendente</span>
                    <span className="ns-legend-item"><span className="ns-calendar-dot is-done" />Concluída</span>
                    <span className="ns-legend-item"><span className="ns-calendar-dot is-locked" />Aguardando etapa anterior</span>
                  </div>
                </article>

                <aside className="ns-calendar-detail" aria-live="polite">
                  <h3 className="ns-calendar-detail-date">
                    {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="ns-calendar-detail-subtitle">
                    {selectedCalendarItems.length
                      ? `${selectedCalendarItems.length} ${selectedCalendarItems.length === 1 ? 'revisão prevista' : 'revisões previstas'}`
                      : 'Nenhuma revisão neste dia'}
                  </p>
                  {selectedCalendarItems.length === 0 ? (
                    <EmptyState icon="spark" title="Dia livre" description="Escolha outro dia ou avance para planejar os próximos ciclos." />
                  ) : (
                    <div className="ns-calendar-task-list">
                      {selectedCalendarItems.map((item) => (
                        <article className="ns-calendar-task" key={`${item.studyId}-${item.field}`}>
                          <div className="ns-calendar-task-top">
                            <div>
                              <strong>{item.content}</strong>
                              <span>{item.subject} · Revisão de {item.label}</span>
                            </div>
                            <span className={`ns-calendar-task-badge${item.late ? ' is-late' : ''}${!item.available && !item.done ? ' is-locked' : ''}`}>
                              {item.done ? 'Concluída' : !item.available ? 'Bloqueada' : item.late ? 'Atrasada' : 'Pendente'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={`ns-button${item.done ? '' : ' ns-button-primary'}`}
                            disabled={!item.available && !item.done}
                            onClick={() => toggleStudyField(item.studyId, item.field)}
                          >
                            {item.done ? 'Desfazer conclusão' : item.available ? 'Marcar revisão concluída' : 'Conclua a revisão anterior primeiro'}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
            </section>
          )}

          {activeTab === 'history' && (
            <section className="ns-section" aria-labelledby="history-title">
              <div className="ns-section-heading">
                <h2 id="history-title">Histórico concluído</h2>
                <span className="ns-muted">{filteredCompletedStudies.length} estudos</span>
              </div>
              {completedStudies.length === 0 ? (
                <EmptyState icon="history" title="Seu histórico começa aqui" description="Quando completar as três revisões de um estudo, ele aparecerá nesta lista." />
              ) : filteredCompletedStudies.length === 0 ? (
                <EmptyState icon="search" title="Nenhum estudo nesta matéria" description="Não há estudos concluídos para o filtro selecionado." />
              ) : (
                <div className="ns-list">
                  {filteredCompletedStudies.map((study) => (
                    <article className="ns-card ns-history-card" key={study.id}>
                      <div>
                        <span className="ns-subject">{study.subject}</span>
                        <h3 className="ns-history-title">{study.content}</h3>
                        <p className="ns-card-date">Estudado em {formatDateBR(study.studyDate)} · ciclo concluído</p>
                      </div>
                      <div className="ns-history-actions">
                        <button type="button" className="ns-icon-button" aria-label={`Restaurar ${study.content}`} title="Restaurar estudo" onClick={() => restoreStudy(study)}><AppIcon name="history" className="ns-ui-icon" /></button>
                        <button type="button" className="ns-icon-button" aria-label={`Solicitar exclusão de ${study.content}`} title="Excluir estudo" onClick={() => requestDelete(study)}><AppIcon name="trash" className="ns-ui-icon" /></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
        <footer className="ns-site-footer">
          NutryStudy · Criado por <strong>Marcos Lucas</strong>
        </footer>
        </div>
        </div>
      </div>

      <button type="button" className="ns-fab ns-desktop-fab" aria-label="Adicionar novo estudo" title="Adicionar novo estudo" onClick={() => setIsFormOpen(true)}>
        <span aria-hidden="true"><AppIcon name="plus" className="ns-ui-icon" /></span><span>Novo estudo</span>
      </button>

      {isProfileOpen && (
        <div className="ns-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsProfileOpen(false) }}>
          <section className="ns-dialog ns-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <div className="ns-dialog-header">
              <h2 id="profile-title">Perfil e evolução</h2>
              <button type="button" className="ns-icon-button" aria-label="Fechar perfil" onClick={() => setIsProfileOpen(false)}><AppIcon name="close" className="ns-ui-icon" /></button>
            </div>
            <form className="ns-form" onSubmit={saveProfile}>
              <div className="ns-profile-photo-choice">
                <span className="ns-avatar" aria-hidden="true">
                  {profileForm.photo ? <img src={profileForm.photo} alt="" /> : profileForm.name.charAt(0).toUpperCase() || '?'}
                </span>
                <div className="ns-profile-photo-actions">
                  <input ref={profilePhotoInput} type="file" accept="image/*" aria-label="Escolher foto de perfil" onChange={handleProfilePhotoChange} />
                  <button type="button" className="ns-button" onClick={() => profilePhotoInput.current?.click()}>Escolher foto</button>
                  {profileForm.photo && (
                    <button type="button" className="ns-button ns-button-danger" onClick={() => setProfileForm((previous) => ({ ...previous, photo: null }))}>
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
              <label className="ns-label">
                Nome de exibição
                <input
                  className="ns-input"
                  value={profileForm.name}
                  maxLength={50}
                  required
                  placeholder="Como devemos chamar você?"
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, name: event.target.value }))}
                />
              </label>
              <div className="ns-rank-summary">
                <strong><RankBadge rankIndex={currentRankIndex} size="large" /> {currentRank.name} — {currentRank.title}</strong>
                <p>{currentRank.description}</p>
                <p>{xp} XP · {nextRank ? `${nextRank.minXp - xp} XP para ${nextRank.name}` : 'Rank máximo alcançado!'}</p>
                <div
                  className="ns-progress-track"
                  role="progressbar"
                  aria-label="Progresso para o próximo rank"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rankProgress}
                >
                  <div className="ns-progress-fill" style={{ width: `${rankProgress}%` }} />
                </div>
                <p>Cada nova tarefa concluída rende {XP_PER_REVIEW} XP. Cada tarefa só pontua uma vez.</p>
              </div>
              <div className="ns-rank-roadmap" aria-label="Ranks disponíveis">
                {RANKS.map((rank, index) => (
                  <div className={`ns-rank-roadmap-item${index === currentRankIndex ? ' is-current' : ''}`} key={rank.name} title={rank.description}>
                    <span><RankBadge rankIndex={index} size="small" /> <AppIcon name={index <= currentRankIndex ? 'check' : 'diamond'} className="ns-rank-status-icon" /> {rank.name} · {rank.title}</span>
                    <span>{rank.minXp} XP</span>
                  </div>
                ))}
              </div>
              <button type="submit" className="ns-button ns-button-primary">Salvar perfil</button>
            </form>
          </section>
        </div>
      )}

      {isFormOpen && (
        <div className="ns-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
          <section className="ns-dialog" role="dialog" aria-modal="true" aria-labelledby="new-study-title">
            <div className="ns-dialog-header">
              <h2 id="new-study-title">Adicionar estudo</h2>
              <button type="button" className="ns-icon-button" aria-label="Fechar formulário" onClick={() => setIsFormOpen(false)}><AppIcon name="close" className="ns-ui-icon" /></button>
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
              <button type="button" className="ns-icon-button" aria-label="Fechar confirmação" onClick={() => setPendingDelete(null)}><AppIcon name="close" className="ns-ui-icon" /></button>
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

function EmptyState({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <div className="ns-empty" role="status">
      <div className="ns-empty-icon"><AppIcon name={icon} className="ns-ui-icon" /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
