// Approximate campus reference points.
// These are campus locations, NOT individual sellers' locations.

export const CAMPUS_LOCATIONS = {
  hunter: {
    label: 'Hunter College',
    position: [40.768538, -73.964741],
  },
  baruch: {
    label: 'Baruch College',
    position: [40.740159, -73.98338],
  },
  brooklyn: {
    label: 'Brooklyn College',
    position: [40.6310463, -73.9523602],
  },
  queens: {
    label: 'Queens College',
    position: [40.737, -73.817],
  },
  csi: {
    label: 'College of Staten Island',
    position: [40.6, -74.15],
  },
}

const CAMPUS_ALIASES = {
  hunter: 'hunter',
  'hunter college': 'hunter',

  baruch: 'baruch',
  'baruch college': 'baruch',

  brooklyn: 'brooklyn',
  'brooklyn college': 'brooklyn',

  queens: 'queens',
  'queens college': 'queens',

  csi: 'csi',
  'college of staten island': 'csi',
}

export function getMapCampusKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  return CAMPUS_ALIASES[normalized] ?? null
}