import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ materias: 0, asistencias: 0, tareas: 0 })
  const [materiasData, setMateriasData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    api.get('/materias')
      .then((r) => {
        setStats((s) => ({ ...s, materias: r.data.length }))
        setMateriasData(r.data.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold dash-title">
          Bienvenido, {user?.nombre?.split(' ')[0] ?? 'Viajero'}
        </h2>
        <p className="dash-subtitle text-sm mt-1">
          Panel de control — SICAT
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <CardMaterias total={stats.materias} />
        <CardAsistencias total={stats.asistencias} />
        <CardTareas total={stats.tareas} />
      </div>

      {/* ── Materias recientes ── */}
      <div className="dash-card">
        <div className="dash-card__header">
          <h3 className="font-semibold dash-card__title">Materias Activas</h3>
          <Link to="/materias" className="dash-link text-sm">
            Ver todas →
          </Link>
        </div>
        {loading ? (
          <div className="p-6 text-center dash-muted">Cargando...</div>
        ) : materiasData.length === 0 ? (
          <div className="p-6 text-center dash-muted">No hay materias registradas.</div>
        ) : (
          <ul className="dash-list">
            {materiasData.map(m => (
              <li key={m.id}>
                <Link
                  to={`/materias/${m.id}`}
                  className="dash-list__item"
                >
                  <div>
                    <p className="text-sm font-medium dash-list__name">{m.nombre}</p>
                    <p className="text-xs dash-list__sub">
                      {m.sigla ?? 'Materia'}
                    </p>
                  </div>
                  <span className="dash-badge">Activa</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ── Card 1: Materias ───────────────────── */
function CardMaterias({ total }) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const todayDate = new Date()
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const firstDayOfWeek = new Date(calMonth.year, calMonth.month, 1).getDay()
  const daysInMonth    = new Date(calMonth.year, calMonth.month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => setCalMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  )
  const nextMonth = () => setCalMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  )

  const isToday = (day) =>
    todayDate.getDate() === day &&
    todayDate.getMonth() === calMonth.month &&
    todayDate.getFullYear() === calMonth.year

  return (
    <div className="scard scard--blue">
      <div className="scard__head">
        <div className="scard__icon scard__icon--blue">📚</div>
        <span className="scard__label">Materias</span>
      </div>
      <div className="scard__count">{total}</div>

      {/* Mini Calendar */}
      <div className="scard__inner">
        <div className="scard__cal-nav">
          <button onClick={prevMonth} className="scard__cal-btn">‹</button>
          <span className="scard__cal-title">
            {MONTH_NAMES[calMonth.month]} {calMonth.year}
          </span>
          <button onClick={nextMonth} className="scard__cal-btn">›</button>
        </div>

        <div className="scard__cal-weekdays">
          {['D','L','M','M','J','V','S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="scard__cal-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const today = isToday(day)
            return (
              <div
                key={i}
                className={`scard__cal-day${today ? ' scard__cal-day--today' : ''}`}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Card 2: Asistencias ─────────────────────────────── */
function CardAsistencias({ total }) {
  return (
    <div className="scard scard--amber">
      <div className="scard__head">
        <div className="scard__icon scard__icon--amber">✨</div>
        <span className="scard__label">Asistencias</span>
      </div>
      <div className="scard__count">{total}</div>

      <div className="scard__inner">
        <p className="scard__inner-title">Control diario</p>
        <p className="scard__inner-sub">Listas actualizadas</p>
        <div className="scard__inner-meta">
          <span>👥 Último registro: Hoy</span>
        </div>
      </div>
    </div>
  )
}

/* ── Card 3: Tareas ──────────────────────── */
function CardTareas({ total }) {
  return (
    <div className="scard scard--violet">
      <div className="scard__head">
        <div className="scard__icon scard__icon--violet">📝</div>
        <span className="scard__label">Tareas</span>
      </div>
      <div className="scard__count">{total}</div>

      <div className="scard__inner">
        <ProgressRow label="Enviadas" value={total} max={total} />
        <ProgressRow label="Pendientes" value={0} max={total} />
      </div>
    </div>
  )
}

function ProgressRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="scard__progress-row">
      <div className="scard__progress-header">
        <span className="scard__progress-label">{label}</span>
        <span className="scard__progress-value">{value}</span>
      </div>
      <div className="scard__progress-track">
        <div className="scard__progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
