import { useEffect, useState } from 'react'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

import {
  getStudentsPerCampus,
  getListingsPerCampus,
  getListingsLast14Days,
  getListingsByCategory,
  getSummaryStats,
} from '../lib/analyticsApi'

import {
  CAMPUS_THEMES,
  CAMPUS_ORDER,
} from '../data/campusThemes'

import ListingDensityMap from '../data/ListingDensityMap'
import './AnalyticsDashboard.css'

const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
}

const tooltipProps = {
  contentStyle: {
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    color: 'var(--ink)',
    boxShadow: 'var(--shadow)',
  },
  labelStyle: { color: 'var(--ink)' },
  itemStyle: { color: 'var(--ink)' },
}

function getThemeKey(campusName) {
  const normalized = String(campusName ?? '')
    .trim()
    .toLowerCase()

  return (
    CAMPUS_ORDER.find((key) => {
      const theme = CAMPUS_THEMES[key]

      return [
        theme.key,
        theme.name,
        theme.full,
      ].some((label) => label.toLowerCase() === normalized)
    }) ?? null
  )
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—'

  const number = Number(value)

  return Number.isFinite(number)
    ? number.toLocaleString()
    : '—'
}

function DashboardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 10V5a2 2 0 0 1 2-2h5a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-5 5a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 10Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  )
}

function ModeIcon({ darkMode }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {darkMode ? (
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  )
}

function StatCard({ label, value, note, accent = false }) {
  return (
    <article
      className={`analytics-stat${accent ? ' is-accent' : ''}`}
    >
      <p className="analytics-stat-label">{label}</p>
      <p className="analytics-stat-value">
        {formatNumber(value)}
      </p>
      <p className="analytics-stat-note">{note}</p>
    </article>
  )
}

function ChartCard({ title, subtitle, empty, children }) {
  return (
    <section className="analytics-card">
      <div className="analytics-chart-heading">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="analytics-chart-body">
        {empty ? (
          <div className="analytics-empty">
            No data available for this selection.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

function legendFormatter(value) {
  return (
    <span style={{ color: 'var(--muted)' }}>
      {value}
    </span>
  )
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(null)
  const [studentsPerCampus, setStudentsPerCampus] = useState([])
  const [listingsPerCampus, setListingsPerCampus] = useState([])
  const [last14Days, setLast14Days] = useState([])
  const [byCategory, setByCategory] = useState([])

  const [campusKey, setCampusKey] = useState('all')
  const [darkMode, setDarkMode] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  const theme = CAMPUS_THEMES[campusKey]

  const seriesColors = [
    theme.primary,
    theme.accent,
    '#c98537',
    '#8271ad',
    '#ca7285',
    '#607d8b',
    '#8d806d',
  ]

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [
          summary,
          students,
          listings,
          trend,
          categories,
        ] = await Promise.all([
          getSummaryStats(),
          getStudentsPerCampus(),
          getListingsPerCampus(),
          getListingsLast14Days(),
          getListingsByCategory(),
        ])

        if (!active) return

        if (!summary) {
          throw new Error('Summary data was not returned.')
        }

        setStats(summary)
        setStudentsPerCampus(students ?? [])
        setListingsPerCampus(listings ?? [])
        setLast14Days(trend ?? [])
        setByCategory(categories ?? [])
        setLoadedAt(new Date())
      } catch (err) {
        if (!active) return

        console.error(err)

        setError(
          err instanceof Error
            ? err.message
            : err?.message || 'Unknown error',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  const visibleStudents =
    campusKey === 'all'
      ? studentsPerCampus
      : studentsPerCampus.filter(
          (entry) => getThemeKey(entry.campus) === campusKey,
        )

  const visibleListings =
    campusKey === 'all'
      ? listingsPerCampus
      : listingsPerCampus.filter(
          (entry) => getThemeKey(entry.campus) === campusKey,
        )

  const campusSubtitle =
    campusKey === 'all'
      ? 'All campuses'
      : theme.full

  return (
    <div
      className={`analytics-app${darkMode ? ' is-dark' : ''}`}
      style={{
        '--primary': theme.primary,
        '--primary-ink': theme.primaryInk,
        '--accent': theme.accent,
        '--accent-ink': theme.accentInk,
        '--primary-soft': `${theme.primary}12`,
      }}
    >
      <header className="analytics-topbar">
        <div className="analytics-topbar-inner">
          <div className="analytics-brand">
            <div className="analytics-brand-row">
              <TagIcon />

              <span>
                CUNY{' '}
                <span className="analytics-brand-accent">
                  MarketPlace
                </span>
              </span>
            </div>

            <div className="analytics-brand-underline" />
          </div>

          <div className="analytics-header-controls">
            <label className="analytics-campus-picker">
              <span className="analytics-sr-only">
                Choose campus and school colors
              </span>

              <select
                value={campusKey}
                onChange={(event) => {
                  setCampusKey(event.target.value)
                }}
              >
                {CAMPUS_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {CAMPUS_THEMES[key].full}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="analytics-mode-button"
              aria-label={
                darkMode
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              aria-pressed={darkMode}
              onClick={() => {
                setDarkMode((current) => !current)
              }}
            >
              <ModeIcon darkMode={darkMode} />
            </button>
          </div>
        </div>
      </header>

      <aside
        className="analytics-rail"
        aria-label="Dashboard identity"
      >
        <div className="analytics-rail-logo" aria-label="CUNY">
          CU<br />NY
        </div>

        <div
          className="analytics-rail-active"
          title="Analytics dashboard"
        >
          <DashboardIcon />
        </div>

        <span className="analytics-rail-caption">DATA</span>
      </aside>

      <main className="analytics-workspace">
        <header className="analytics-page-heading">
          <p className="analytics-eyebrow">
            {campusKey === 'all' ? 'All CUNY' : theme.full}
            {' '}MarketPlace
          </p>

          <h1>Campus & Listings Analytics</h1>

          <p className="analytics-description">
            Explore your campus community through marketplace data.
          </p>
        </header>

        {loading ? (
          <div
            className="analytics-card analytics-message"
            role="status"
          >
            Loading analytics…
          </div>
        ) : error ? (
          <div
            className="analytics-card analytics-message"
            role="alert"
          >
            <h2>Couldn’t load analytics</h2>
            <p>{error}</p>

            <button
              type="button"
              className="analytics-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="analytics-dashboard">
            <div className="analytics-content">
              <section
                className="analytics-stats"
                aria-label="Marketplace-wide summary metrics"
              >
                <StatCard
                  label="Total listings"
                  value={stats.totalListings}
                  note="Marketplace-wide"
                />

                <StatCard
                  label="Registered students"
                  value={stats.registeredStudents}
                  note="Marketplace-wide"
                />

                <StatCard
                  label="New this week"
                  value={stats.newThisWeek}
                  note="Marketplace-wide"
                  accent
                />
              </section>

              <ListingDensityMap campusKey={campusKey} />

              <div className="analytics-chart-grid">
                <ChartCard
                  title="New listing trends"
                  subtitle="This week compared with last week · all campuses"
                  empty={!last14Days.length}
                >
                  <LineChart
                    data={last14Days}
                    margin={{ right: 16, top: 8 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--line)"
                    />

                    <XAxis dataKey="day" {...axisProps} />

                    <YAxis
                      {...axisProps}
                      width={40}
                      allowDecimals={false}
                    />

                    <Tooltip
                      {...tooltipProps}
                      cursor={{ stroke: 'var(--muted)' }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        paddingTop: 12,
                      }}
                      formatter={legendFormatter}
                    />

                    <Line
                      type="monotone"
                      dataKey="thisWeek"
                      name="This week"
                      stroke="var(--accent)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="lastWeek"
                      name="Last week"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartCard>

                <ChartCard
                  title="Listings per campus"
                  subtitle={campusSubtitle}
                  empty={!visibleListings.length}
                >
                  <BarChart
                    data={visibleListings}
                    margin={{ right: 8, top: 8 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--line)"
                    />

                    <XAxis
                      dataKey="campus"
                      {...axisProps}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={65}
                    />

                    <YAxis
                      {...axisProps}
                      width={40}
                      allowDecimals={false}
                    />

                    <Tooltip
                      {...tooltipProps}
                      cursor={{ fill: 'var(--primary-soft)' }}
                    />

                    <Bar
                      dataKey="listings"
                      name="Listings"
                      fill="var(--primary)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ChartCard>

                <ChartCard
                  title="Registered students per campus"
                  subtitle={campusSubtitle}
                  empty={!visibleStudents.length}
                >
                  <BarChart
                    data={visibleStudents}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--line)"
                    />

                    <XAxis
                      type="number"
                      {...axisProps}
                      allowDecimals={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="campus"
                      width={90}
                      {...axisProps}
                    />

                    <Tooltip
                      {...tooltipProps}
                      cursor={{ fill: 'var(--primary-soft)' }}
                    />

                    <Bar
                      dataKey="students"
                      name="Students"
                      fill="var(--primary)"
                      radius={[0, 5, 5, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ChartCard>

                <ChartCard
                  title="Listings by category"
                  subtitle="Category distribution · all campuses"
                  empty={!byCategory.length}
                >
                  <PieChart>
                    <Tooltip {...tooltipProps} />

                    <Pie
                      data={byCategory}
                      dataKey="listings"
                      nameKey="category"
                      innerRadius="45%"
                      outerRadius="70%"
                      stroke="var(--card)"
                      strokeWidth={3}
                      paddingAngle={2}
                    >
                      {byCategory.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={
                            seriesColors[index % seriesColors.length]
                          }
                        />
                      ))}
                    </Pie>

                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={legendFormatter}
                    />
                  </PieChart>
                </ChartCard>
              </div>
            </div>

            <aside className="analytics-card analytics-sidebar">
              <section>
                <h2>Filter campus charts</h2>

                <label
                  className="analytics-filter-label"
                  htmlFor="campus-filter"
                >
                  Campus
                </label>

                <select
                  id="campus-filter"
                  className="analytics-select"
                  value={campusKey}
                  onChange={(event) => {
                    setCampusKey(event.target.value)
                  }}
                >
                  {CAMPUS_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {CAMPUS_THEMES[key].full}
                    </option>
                  ))}
                </select>

                <p className="analytics-sidebar-note">
                  Selecting a campus changes its school colors and
                  filters the map and two campus charts. Summary
                  totals, weekly trends, and categories remain
                  marketplace-wide.
                </p>

                <button
                  type="button"
                  className="analytics-button"
                  onClick={() => setCampusKey('all')}
                  disabled={campusKey === 'all'}
                >
                  Reset campus filter
                </button>
              </section>

              <section className="analytics-sidebar-section">
                <h2>School colors</h2>

                <p className="analytics-sidebar-note">
                  {theme.full}
                  {theme.borough ? ` · ${theme.borough}` : ''}
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: theme.primary,
                      color: theme.primaryInk,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Primary
                  </span>

                  <span
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: theme.accent,
                      color: theme.accentInk,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Accent
                  </span>
                </div>
              </section>

              <section className="analytics-sidebar-section">
                <h2>Data coverage</h2>

                <ul className="analytics-coverage">
                  {[
                    'Registered students',
                    'Listings by campus',
                    'Weekly listing trends',
                    'Category distribution',
                    'Campus listing map',
                  ].map((label) => (
                    <li key={label}>
                      <span className="analytics-dot" />
                      {label}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="analytics-sidebar-section">
                <h2>Snapshot</h2>

                <p className="analytics-sidebar-note">
                  Charts loaded at{' '}
                  {loadedAt?.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}.
                  {' '}Reload the page to refresh charts.
                  The map refreshes separately.
                </p>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}