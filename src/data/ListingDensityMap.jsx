import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import { supabase } from '../lib/supabase'
import { getMapListings } from '../lib/analyticsApi'
import { CAMPUS_THEMES } from './campusThemes'
import {
  CAMPUS_LOCATIONS,
  getMapCampusKey,
} from './campusLocations'

import './ListingDensityMap.css'

const CATEGORY_ICONS = {
  Textbooks: '📚',
  Electronics: '💻',
  Furniture: '🪑',
  Sports: '⚽',
  Clothing: '👕',
  Services: '🛠️',
  Other: '📦',
}

const ALL_CAMPUS_POSITIONS = Object.values(
  CAMPUS_LOCATIONS,
).map((campus) => campus.position)

const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function normalizeCategory(value) {
  const category = String(value ?? '').trim()
  return category || 'Other'
}

function createListingIcon(campusKey, category) {
  const theme = CAMPUS_THEMES[campusKey]

  const element = document.createElement('div')
  element.className = 'density-pin'
  element.style.backgroundColor = theme.primary
  element.style.color = theme.primaryInk
  element.style.borderColor = theme.accent
  element.textContent = CATEGORY_ICONS[category] ?? '📦'

  return L.divIcon({
    className: 'density-marker',
    html: element,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function createListingPopup(row, campusKey) {
  const container = document.createElement('div')
  container.className = 'density-popup'

  const heading = document.createElement('strong')
  heading.textContent =
    `${CATEGORY_ICONS[row.category] ?? '📦'} ${row.category}`

  const campus = document.createElement('p')
  campus.textContent = CAMPUS_LOCATIONS[campusKey].label

  const locationNote = document.createElement('small')
  locationNote.textContent =
    'Campus reference point, not an exact pickup location.'

  container.append(heading, campus, locationNote)

  if (row.created_at) {
    const date = new Date(row.created_at)

    if (!Number.isNaN(date.getTime())) {
      const added = document.createElement('p')
      added.textContent =
        `Added ${date.toLocaleDateString()}`
      container.append(added)
    }
  }

  return container
}

export default function ListingDensityMap({ campusKey = 'all' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const refreshRef = useRef(null)

  const [rows, setRows] = useState([])
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tileError, setTileError] = useState(false)
  const [connected, setConnected] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  const categories = useMemo(() => {
    const names = new Set(Object.keys(CATEGORY_ICONS))

    rows.forEach((row) => {
      names.add(normalizeCategory(row.category))
    })

    return [...names]
  }, [rows])

  const mappedRows = useMemo(() => {
    return rows
      .map((row) => ({
        ...row,
        category: normalizeCategory(row.category),
        mapCampusKey: getMapCampusKey(row.campus),
      }))
      .filter((row) => row.mapCampusKey !== null)
  }, [rows])

  const visibleRows = useMemo(() => {
    return mappedRows.filter((row) => {
      const campusMatches =
        campusKey === 'all' ||
        row.mapCampusKey === campusKey

      const categoryMatches =
        category === 'all' ||
        row.category === category

      return campusMatches && categoryMatches
    })
  }, [mappedRows, campusKey, category])

  const unmappedCount = rows.length - mappedRows.length

  // Create the Leaflet map once and remove it on unmount.
  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [40.7, -73.98],
      zoom: 10,
      minZoom: 8,
      maxZoom: 19,
      scrollWheelZoom: false,
      zoomControl: true,
    })

    mapRef.current = map

    const tiles = L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    })

    tiles.on('tileerror', () => setTileError(true))
    tiles.addTo(map)

    const clusters = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.6,
      animate: false,

      iconCreateFunction(cluster) {
        const count = cluster.getChildCount()

        return L.divIcon({
          className: 'density-cluster-icon',
          html: `<div class="density-cluster">${count.toLocaleString()}</div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        })
      },
    })

    clusters.addTo(map)
    clusterRef.current = clusters

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false })
    })

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      tiles.off()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  // Fetch rows, subscribe to changes, and periodically reconcile.
  useEffect(() => {
    let active = true
    let fetching = false
    let queued = false
    let debounceTimer = null

    async function refresh() {
      if (!active) return

      if (fetching) {
        queued = true
        return
      }

      fetching = true

      try {
        const data = await getMapListings()

        if (!active) return

        setRows(data)
        setError(null)
        setUpdatedAt(new Date())
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : err?.message || 'Could not load map listings.',
        )
      } finally {
        fetching = false

        if (active) {
          setLoading(false)

          if (queued) {
            queued = false
            void refresh()
          }
        }
      }
    }

    function scheduleRefresh() {
      if (!active) return

      clearTimeout(debounceTimer)

      debounceTimer = setTimeout(() => {
        void refresh()
      }, 250)
    }

    refreshRef.current = refresh
    void refresh()

    const channel = supabase
      .channel(
        `listing-density-map-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings',
        },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (!active) return

        setConnected(status === 'SUBSCRIBED')

        if (status === 'SUBSCRIBED') {
          scheduleRefresh()
        }
      })

    // Reconcile missed events and provide a polling fallback.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, 30000)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      active = false
      clearTimeout(debounceTimer)
      clearInterval(interval)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      refreshRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [])

  // Replace the marker layer whenever the displayed rows change.
  useEffect(() => {
    const clusters = clusterRef.current
    if (!clusters) return

    clusters.clearLayers()

    const markers = visibleRows.map((row) => {
      const location = CAMPUS_LOCATIONS[row.mapCampusKey]

      const marker = L.marker(location.position, {
        icon: createListingIcon(
          row.mapCampusKey,
          row.category,
        ),
        title: `${row.category} · ${location.label}`,
        alt: `${row.category} listing at ${location.label}`,
        keyboard: true,
      })

      marker.bindPopup(
        createListingPopup(row, row.mapCampusKey),
      )

      return marker
    })

    clusters.addLayers(markers)
  }, [visibleRows])

  // Only recenter when the selected campus changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (campusKey === 'all') {
      map.fitBounds(ALL_CAMPUS_POSITIONS, {
        padding: [35, 35],
        maxZoom: 11,
        animate: false,
      })
    } else {
      const location = CAMPUS_LOCATIONS[campusKey]

      if (location) {
        map.setView(location.position, 16, {
          animate: false,
        })
      }
    }
  }, [campusKey])

  function resetView() {
    const map = mapRef.current
    if (!map) return

    if (campusKey === 'all') {
      map.fitBounds(ALL_CAMPUS_POSITIONS, {
        padding: [35, 35],
        maxZoom: 11,
      })
    } else {
      const location = CAMPUS_LOCATIONS[campusKey]

      if (location) {
        map.setView(location.position, 16)
      }
    }
  }

  return (
    <section
      className="analytics-card density-card"
      aria-label="Campus listing density map"
    >
      <div className="density-heading">
        <div>
          <h2>Campus listing map</h2>
          <p>
            Explore listings across NYC. Each pin represents
            one listing at its campus.
          </p>
        </div>

        <span className="density-count">
          {loading
            ? 'Loading…'
            : `${visibleRows.length.toLocaleString()} listings`}
        </span>
      </div>

      <div className="density-toolbar">
        <label className="density-category-label">
          Category

          <select
            className="analytics-select"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
            }}
          >
            <option value="all">All categories</option>

            {categories.map((name) => (
              <option key={name} value={name}>
                {CATEGORY_ICONS[name] ?? '📦'} {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="analytics-button"
          onClick={resetView}
        >
          Reset map view
        </button>

        <button
          type="button"
          className="analytics-button"
          onClick={() => refreshRef.current?.()}
        >
          Refresh listings
        </button>
      </div>

      {error && (
        <p className="density-warning" role="alert">
          Couldn’t refresh listings: {error}
          {updatedAt
            ? ' The map is showing the last successful snapshot.'
            : ''}
        </p>
      )}

      {tileError && (
        <p className="density-warning" role="status">
          Some map tiles could not load. Check your connection
          and reload the page if the background stays blank.
        </p>
      )}

      <div className="density-map-wrapper">
        <div
          ref={containerRef}
          className="density-map"
          aria-label="Interactive NYC campus map"
        />

        {loading && (
          <div className="density-map-notice" role="status">
            Loading listing pins…
          </div>
        )}

        {!loading && !error && visibleRows.length === 0 && (
          <div className="density-map-notice" role="status">
            No listings match this campus and category.
          </div>
        )}
      </div>

      <div className="density-legend" aria-label="Category legend">
        {Object.entries(CATEGORY_ICONS).map(([name, icon]) => (
          <span key={name}>
            <span aria-hidden="true">{icon}</span> {name}
          </span>
        ))}
      </div>

      <div className="density-footer">
        <p>
          Drag to pan. Use + / − or pinch to zoom.
          Click a numbered cluster to explore its listings.
          At maximum zoom, click it to fan out overlapping pins.
        </p>

        <p>
          <span
            className={`density-status-dot${connected ? ' is-connected' : ''}`}
            aria-hidden="true"
          />

          {connected
            ? 'Realtime connected'
            : 'Realtime connecting / unavailable'}

          {' · '}Also checks for updates every 30 seconds
          while this tab is visible.

          {updatedAt && (
            <>
              {' '}Last loaded{' '}
              {updatedAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}.
            </>
          )}
        </p>

        <p>
          Campus reference points only—not exact seller or
          pickup locations. Fanned-out pins are a visual arrangement.
        </p>

        {unmappedCount > 0 && (
          <p className="density-warning">
            {unmappedCount.toLocaleString()} listing(s) have an
            unrecognized or missing campus and are not mapped.
          </p>
        )}
      </div>
    </section>
  )
}