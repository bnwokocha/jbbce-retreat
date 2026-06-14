export const TRIP_START = new Date(2026, 5, 29);
export const TRIP_END   = new Date(2026, 6, 11);
export const TRIP_DAYS  = [];
(function() {
  const d = new Date(TRIP_START);
  while (d <= TRIP_END) { TRIP_DAYS.push(new Date(d)); d.setDate(d.getDate() + 1); }
})();
export const TOTAL_NIGHTS = TRIP_DAYS.length - 1;

export const ROOMS = [
  { id: 'room1', name: 'Room 1' },
  { id: 'room2', name: 'Room 2' },
  { id: 'room3', name: 'Room 3' },
];

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
export const MEAL_OPTIONS = [
  { value: 'house',       label: '🏠 House meal',              icon: '🏠' },
  { value: 'ill_cook',    label: "🍳 I'll Cook",               icon: '🍳' },
  { value: 'ill_eat',     label: "😋 I'll eat if someone cooks", icon: '😋' },
  { value: 'eat_out',     label: '🍽️ Eat out',                 icon: '🍽️' },
  { value: 'not_hungry',  label: "😴 I'm not hungry",          icon: '😴' },
  { value: 'whatever',    label: '🤷 Down for whatever',       icon: '🤷' },
  { value: 'group_event', label: '🎉 Group Event',             icon: '🎉' },
];

export const PAYMENT_METHODS = ['Cash', 'Venmo', 'Apple Cash', 'Favors 😈'];

export const TRAVEL_MODES_ARR = [
  'Ferry (Bay State Cruises)',
  'Ferry (City Cruises)',
  'Ferry + Flight',
  'Flight to PVC (Cape Air)',
  'Driving',
];
export const TRAVEL_MODES_DEP = [
  'Ferry (Bay State Cruises)',
  'Ferry (City Cruises)',
  'Ferry + Flight',
  'Flight from PVC (Cape Air)',
  'Driving',
];

export const WEATHER_AVG = [
  {hi:72,lo:60,icon:'☀️'},{hi:73,lo:61,icon:'⛅'},{hi:71,lo:60,icon:'☁️'},
  {hi:74,lo:62,icon:'☀️'},{hi:75,lo:63,icon:'☀️'},{hi:73,lo:62,icon:'⛅'},
  {hi:72,lo:61,icon:'🌦️'},{hi:74,lo:62,icon:'☀️'},{hi:76,lo:64,icon:'☀️'},
  {hi:77,lo:65,icon:'☀️'},{hi:75,lo:63,icon:'⛅'},{hi:74,lo:62,icon:'☁️'},
  {hi:76,lo:64,icon:'☀️'},
];

export const PTOWN_LOCATIONS = [
  'Boatslip Resort, 161 Commercial St',
  'Crown & Anchor, 247 Commercial St',
  'MacMillan Pier',
  'Herring Cove Beach',
  'Race Point Beach',
  "Scott's Cakes, 353 Commercial St",
  'The Red Inn, 15 Commercial St',
  '5-7 Point St #3 (the house)',
  'Commercial Street, Provincetown',
  'Post Office Cabaret',
];

// Curated P-Town restaurant list for group meal voting.
// Verify hours/status before the trip — some spots have seasonal closures.
export const PTOWN_RESTAURANTS = [
  { id: 'lobster-pot',       name: 'The Lobster Pot',        vibe: 'P-Town landmark — clam chowder, lobster, harbor views, always packed', price: '$$' },
  { id: 'fanizzis',          name: "Fanizzi's by the Sea",   vibe: 'Local favorite with water views, comfort food and great brunch', price: '$$' },
  { id: 'mews',              name: 'Mews Restaurant & Café', vibe: 'Upscale American bistro with harbor views, two floors of vibe', price: '$$$' },
  { id: 'red-inn',           name: 'The Red Inn',            vibe: 'Romantic upscale waterfront dining, intimate and special', price: '$$$$' },
  { id: 'napis',             name: "Napi's Restaurant",      vibe: 'Beloved local institution, eclectic global menu, wonderfully quirky décor', price: '$$' },
  { id: 'canteen',           name: 'The Canteen',            vibe: 'Casual counter-service — excellent lobster rolls, salads, sandwiches', price: '$' },
  { id: 'jimmys',            name: "Jimmy's Hideaway",       vibe: 'Hearty Italian-American classics tucked off the main drag', price: '$$' },
  { id: 'squealing-pig',     name: 'The Squealing Pig',      vibe: 'Laid-back gastropub with craft beer, burgers, and a fun crowd', price: '$' },
  { id: 'ross-grill',        name: "Ross' Grill",            vibe: 'Sophisticated American, excellent wine list, upstairs harbor view', price: '$$$' },
  { id: 'sals-place',        name: "Sal's Place",            vibe: 'Waterfront Italian with a patio and old-school charm', price: '$$' },
  { id: 'strangers-saints',  name: 'Strangers & Saints',     vibe: 'Cocktail-forward American small plates, refined and lively', price: '$$$' },
  { id: 'spiritus',          name: 'Spiritus Pizza',         vibe: 'The legendary late-night spot — a P-Town institution after midnight', price: '$' },
  { id: 'pepes-wharf',       name: "Pepe's Wharf",          vibe: 'Casual seafood right on the water, fried clams and lobster rolls', price: '$$' },
  { id: 'cafe-heaven',       name: 'Café Heaven',            vibe: 'Beloved breakfast/brunch spot, homey and sweet, long lines worth it', price: '$' },
  { id: 'governor-bradford', name: 'Governor Bradford',      vibe: 'Dive bar with cheap drinks, pool tables, and no-frills pub food', price: '$' },
  { id: 'post-office',       name: 'Post Office Café',       vibe: 'Dinner + cabaret entertainment later — fun night-out option', price: '$$' },
  { id: 'victors',           name: "Victor's Restaurant",    vibe: 'Italian-American with a romantic patio, good pastas', price: '$$' },
  { id: 'bayside-betsys',    name: "Bayside Betsy's",       vibe: 'Casual waterfront seafood, unpretentious and reliably good', price: '$$' },
  { id: 'connies-bakery',    name: "Connie's Bakery",       vibe: 'Portuguese pastries and coffee — perfect quick breakfast on Commercial St', price: '$' },
  { id: 'local-186',         name: 'Local 186',              vibe: 'Casual neighborhood bar and grill, solid American comfort food', price: '$' },
];

export function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,'0')} ${ap}`;
}
export function fmtDOW(dt) { return ['SUN','MON','TUE','WED','THU','FRI','SAT'][dt.getDay()]; }
export function fmtMon(dt) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]; }
export function fmtFull(dt) { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()]+', '+fmtMon(dt)+' '+dt.getDate(); }
export function dayKey(dt) { return dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate(); }
export function isoDate(i) {
  const d = TRIP_DAYS[i];
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function money(n) { return '$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}
// Only allow real web links into href (blocks javascript: etc.)
export function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }
// Is an event a "night" event? After 4pm or explicitly typed night
export function isNightEvent(ev) {
  if (ev.type === 'night') return true;
  if (!ev.time) return false;
  const h = parseInt(ev.time.split(':')[0], 10);
  return h >= 16;
}

export const COLORS = ['#1a6b8a','#d4715a','#6b8c5a','#c8a84b','#8a5aaa','#b5772a','#477c7c','#a44a6e','#3a8c6e'];
