import { supabase } from './supabase'

export const CAMPUSES = ['Hunter', 'Baruch', 'Brooklyn', 'Queens', 'CSI']
export const CATEGORIES = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Other']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Counts rows in a table without downloading them.
// `head: true` means "just give me the count, not the rows".
// Pass a filter like { column: 'campus', value: 'Hunter' } to count only matching rows.
async function countRows(table, filter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) query = query.eq(filter.column, filter.value)

  const { count, error } = await query
  if (error) throw error
  return count
}

// Midnight (local time) `daysAgo` days before today.
function startOfDay(daysAgo) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date
}

// ---------------------------------------------------------------------------
// Chart 1: students per campus → [{ campus: 'Hunter', students: 560 }, ...]
// ---------------------------------------------------------------------------
export async function getStudentsPerCampus() {
  // Promise.all runs the 5 count queries at the same time instead of one after another.
  const counts = await Promise.all(
    CAMPUSES.map((campus) => countRows('students', { column: 'campus', value: campus }))
  )
  return CAMPUSES.map((campus, i) => ({ campus, students: counts[i] })).sort(
    (a, b) => b.students - a.students // biggest first
  )
}

// ---------------------------------------------------------------------------
// Chart 2: listings per campus → [{ campus: 'Baruch', listings: 130 }, ...]
// ---------------------------------------------------------------------------
export async function getListingsPerCampus() {
  const counts = await Promise.all(
    CAMPUSES.map((campus) => countRows('listings', { column: 'campus', value: campus }))
  )
  return CAMPUSES.map((campus, i) => ({ campus, listings: counts[i] })).sort(
    (a, b) => b.listings - a.listings
  )
}

// ---------------------------------------------------------------------------
// Chart 3: last 14 days, this week vs last week
// → [{ day: 'Tue', lastWeek: 12, thisWeek: 15 }, ...]  (7 rows, ending today)
// ---------------------------------------------------------------------------
export async function getListingsLast14Days() {
  const start = startOfDay(13) // 13 days ago + today = 14 days

  const { data, error } = await supabase
    .from('listings')
    .select('created_at')
    .gte('created_at', start.toISOString())
  if (error) throw error

  // Count listings per calendar day, e.g. { 'Mon Sep 22 2026': 8, ... }
  const countByDay = {}
  for (const row of data) {
    const dayKey = new Date(row.created_at).toDateString()
    countByDay[dayKey] = (countByDay[dayKey] || 0) + 1
  }

  // Build 7 rows. Each row pairs a day this week with the same weekday last week.
  const result = []
  for (let i = 6; i >= 0; i--) {
    const thisWeekDay = startOfDay(i)
    const lastWeekDay = startOfDay(i + 7)
    result.push({
      day: thisWeekDay.toLocaleDateString('en-US', { weekday: 'short' }),
      lastWeek: countByDay[lastWeekDay.toDateString()] || 0,
      thisWeek: countByDay[thisWeekDay.toDateString()] || 0,
    })
  }
  return result
}

// ---------------------------------------------------------------------------
// Chart 4: listings by category → [{ category: 'Textbooks', listings: 140 }, ...]
// ---------------------------------------------------------------------------
export async function getListingsByCategory() {
  const counts = await Promise.all(
    CATEGORIES.map((category) => countRows('listings', { column: 'category', value: category }))
  )
  return CATEGORIES.map((category, i) => ({ category, listings: counts[i] }))
}

// ---------------------------------------------------------------------------
// Stat cards → { totalListings, registeredStudents, newThisWeek }
// ---------------------------------------------------------------------------
export async function getSummaryStats() {
  const weekStart = startOfDay(6).toISOString() // same 7 days as "This week" in the line chart

  const [totalListings, registeredStudents, newThisWeekResult] = await Promise.all([
    countRows('listings'),
    countRows('students'),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart),
  ])
  if (newThisWeekResult.error) throw newThisWeekResult.error

  return { totalListings, registeredStudents, newThisWeek: newThisWeekResult.count }
}






// ---------------------------------------------------------------------------
// listing queries
// 
// Map: fetch the existing listing rows using only confirmed columns.
// Pagination avoids stopping at Supabase's default response limit.

export async function getMapListings() {
  const pageSize = 500
  const rows = []
  let offset = 0

  while (true) {
    const { data, count, error } = await supabase
      .from('listings')
      .select('campus, category, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: true })
      .order('campus', { ascending: true })
      .order('category', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const page = data ?? []

    if (page.length === 0) break

    rows.push(...page)
    offset += page.length

    if (count !== null && offset >= count) break
  }

  return rows
}