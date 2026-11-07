import { dec, toScale } from '../lib/decimal'
import { ZIP_CENTROIDS } from '../../integrations/maps'
import { BUSINESS_UNITS } from './company'

/**
 * Summit's field operation (BUILD-PLAN §5, Phase 1): pure data, safe to import from the onboarding
 * screen. Every name, number and address is fictional (phones 512-555-01xx; households use common consumer
 * email domains, and messaging runs on manual adapters, so nothing is ever sent to them).
 */

type CredentialSeed = { kind: string; trade: string; issuer: string; number: string; licenseClass?: string; epaType?: string; expiresOn?: string; status?: 'verified' | 'pending_verification' }
type TechSeed = { key: string; first: string; last: string; title: string; kind: 'technician' | 'apprentice' | 'sales'; units: string[]; zip: string; phone: string; skills: string[]; credentials: CredentialSeed[]; saturday?: boolean }

const acr = (cls: string, number: string): CredentialSeed => ({ kind: 'state_trade_license', trade: 'hvac', issuer: 'TDLR', number, licenseClass: cls, expiresOn: '2027-06-30' })
const epa = (type: string, number: string): CredentialSeed => ({ kind: 'epa_608', trade: 'hvac', issuer: 'EPA-approved certifying organization', number, epaType: type })
const plb = (cls: string, number: string, extra: Partial<CredentialSeed> = {}): CredentialSeed => ({ kind: 'state_trade_license', trade: 'plumbing', issuer: 'TSBPE', number, licenseClass: cls, expiresOn: '2027-03-31', ...extra })
const ele = (cls: string, number: string, extra: Partial<CredentialSeed> = {}): CredentialSeed => ({ kind: 'state_trade_license', trade: 'electrical', issuer: 'TDLR', number, licenseClass: cls, expiresOn: '2027-09-30', ...extra })

export const TECHS: TechSeed[] = [
  { key: 'morrison', first: 'Jake', last: 'Morrison', title: 'HVAC Technician', kind: 'technician', units: ['seed_bu_hvac_service'], zip: '78745', phone: '+15125550110', skills: ['hvac_diag', 'heat_pump', 'refrigerant'], credentials: [acr('acr_certified_technician', 'TACLR-CT-104512'), epa('universal', 'EPA608-U-88213'), { kind: 'nate', trade: 'hvac', issuer: 'NATE', number: 'NATE-551204' }], saturday: true },
  { key: 'alvarez', first: 'Sofia', last: 'Alvarez', title: 'HVAC Technician', kind: 'technician', units: ['seed_bu_hvac_service'], zip: '78723', phone: '+15125550111', skills: ['hvac_diag', 'refrigerant'], credentials: [acr('acr_registered_technician', 'TACLR-RT-209331'), epa('type_ii', 'EPA608-II-44120')] },
  { key: 'chu', first: 'Derek', last: 'Chu', title: 'HVAC Install Lead', kind: 'technician', units: ['seed_bu_hvac_service', 'seed_bu_hvac_install'], zip: '78759', phone: '+15125550112', skills: ['hvac_diag', 'install', 'heat_pump', 'refrigerant'], credentials: [acr('acr_certified_technician', 'TACLR-CT-118870'), epa('universal', 'EPA608-U-90157')] },
  { key: 'lee', first: 'Brandon', last: 'Lee', title: 'HVAC Apprentice', kind: 'apprentice', units: ['seed_bu_hvac_service'], zip: '78741', phone: '+15125550113', skills: ['maintenance'], credentials: [acr('acr_registered_technician', 'TACLR-RT-311046'), epa('type_i', 'EPA608-I-12007')], saturday: true },
  { key: 'castillo', first: 'Ray', last: 'Castillo', title: 'Master Plumber', kind: 'technician', units: ['seed_bu_plumbing_service'], zip: '78704', phone: '+15125550114', skills: ['water_heater', 'repipe', 'gas_line', 'drain'], credentials: [plb('master_plumber', 'M-40122')] },
  { key: 'patel', first: 'Nina', last: 'Patel', title: 'Journeyman Plumber', kind: 'technician', units: ['seed_bu_plumbing_service'], zip: '78757', phone: '+15125550115', skills: ['water_heater', 'drain', 'leak_detection'], credentials: [plb('journeyman_plumber', 'J-55418')], saturday: true },
  { key: 'harris', first: 'Cody', last: 'Harris', title: 'Plumber Apprentice', kind: 'apprentice', units: ['seed_bu_plumbing_service'], zip: '78744', phone: '+15125550116', skills: ['drain'], credentials: [plb('plumber_apprentice', 'AP-77310')] },
  { key: 'haddad', first: 'Omar', last: 'Haddad', title: 'Journeyman Plumber (drains)', kind: 'technician', units: ['seed_bu_plumbing_service'], zip: '78660', phone: '+15125550117', skills: ['drain', 'sewer_camera', 'hydro_jet'], credentials: [plb('journeyman_plumber', 'J-58902', { status: 'pending_verification' })] },
  { key: 'bennett', first: 'Grace', last: 'Bennett', title: 'Master Electrician', kind: 'technician', units: ['seed_bu_electrical'], zip: '78703', phone: '+15125550118', skills: ['panel', 'ev_charger', 'troubleshooting'], credentials: [ele('master_electrician', 'ME-21877')] },
  { key: 'dawson', first: 'Luke', last: 'Dawson', title: 'Journeyman Electrician', kind: 'technician', units: ['seed_bu_electrical'], zip: '78681', phone: '+15125550119', skills: ['troubleshooting', 'ev_charger'], credentials: [ele('journeyman_electrician', 'JE-63540')], saturday: true },
  { key: 'ford', first: 'Maya', last: 'Ford', title: 'Residential Wireman', kind: 'technician', units: ['seed_bu_electrical'], zip: '78613', phone: '+15125550120', skills: ['troubleshooting'], credentials: [ele('residential_wireman', 'RW-70215', { expiresOn: '2026-11-30' })] },
  { key: 'turner', first: 'Eli', last: 'Turner', title: 'Electrical Apprentice', kind: 'apprentice', units: ['seed_bu_electrical'], zip: '78748', phone: '+15125550121', skills: [], credentials: [ele('electrical_apprentice', 'EA-90551')] },
]

export const SKILLS = [
  ['hvac_diag', 'HVAC diagnostics', 'hvac'], ['heat_pump', 'Heat pumps', 'hvac'], ['refrigerant', 'Refrigerant recovery and charging', 'hvac'], ['install', 'System installs', 'hvac'], ['maintenance', 'Tune-ups', 'hvac'],
  ['water_heater', 'Water heaters', 'plumbing'], ['repipe', 'Repipes', 'plumbing'], ['gas_line', 'Gas lines', 'plumbing'], ['drain', 'Drain cleaning', 'plumbing'], ['leak_detection', 'Leak detection', 'plumbing'], ['sewer_camera', 'Sewer camera', 'plumbing'], ['hydro_jet', 'Hydro-jetting', 'plumbing'],
  ['panel', 'Panels and services', 'electrical'], ['ev_charger', 'EV chargers', 'electrical'], ['troubleshooting', 'Electrical troubleshooting', 'electrical'],
] as const

export const REQUIREMENTS = [
  { id: 'seed_req_acr_refrigerant', name: 'ACR work with refrigerant', licensingTags: ['acr_service', 'refrigerant_handling'], skills: ['hvac_diag'] },
  { id: 'seed_req_acr', name: 'ACR work, no refrigerant', licensingTags: ['acr_service'], skills: [] },
  { id: 'seed_req_plumbing', name: 'Licensed plumbing', licensingTags: ['plumbing_service'], skills: [] },
  { id: 'seed_req_drain', name: 'Drain and sewer', licensingTags: ['plumbing_service'], skills: ['drain'] },
  { id: 'seed_req_electrical', name: 'Licensed electrical', licensingTags: ['electrical_service'], skills: [] },
  { id: 'seed_req_sales', name: 'Comfort advisor visit (no field work)', licensingTags: [], skills: [] },
] as const

const GAS = { keywords: ['smell gas', 'gas smell', 'smells like gas', 'carbon monoxide', 'co alarm', 'co detector'], script: 'If you smell gas or your CO alarm is going off, leave the house now with everyone, do not switch anything on or off, and call Texas Gas Service or 911 from outside. I am paging our on-call technician.', page: true }
const WATER = { keywords: ['burst pipe', 'pipe burst', 'flooding', 'water everywhere', 'gushing', 'water pouring'], script: 'Please turn off the main water shut-off now; it is usually where the water line enters the house or at the meter box by the street. I am paging our on-call plumber.', page: true }
const SPARKS = { keywords: ['sparking', 'sparks', 'burning smell', 'smoke from', 'panel is hot', 'outlet melted'], script: 'If you see smoke or sparks, stay away from it. If it is safe, switch off the main breaker. If there is fire or smoke, leave and call 911. I am paging our on-call electrician.', page: true }

export const JOB_TYPES = [
  { id: 'seed_jt_ac_diag', code: 'AC-DIAG', name: 'AC not cooling: diagnostic', bu: 'seed_bu_hvac_service', trade: 'hvac', priority: 'urgent', minutes: 90, hours: '2', req: 'seed_req_acr_refrigerant', ai: true, keywords: ['ac', 'air conditioner', 'not cooling', 'warm air', 'hot air', 'compressor', 'refrigerant', 'freon', 'frozen coil', 'ice on', 'thermostat', 'cooling'], emergency: null },
  { id: 'seed_jt_heat_diag', code: 'HEAT-DIAG', name: 'No heat: diagnostic', bu: 'seed_bu_hvac_service', trade: 'hvac', priority: 'urgent', minutes: 90, hours: '2', req: 'seed_req_acr', ai: true, keywords: ['heat', 'heater', 'furnace', 'no heat', 'cold air', 'heat pump', 'pilot'], emergency: GAS },
  { id: 'seed_jt_ac_tune', code: 'AC-TUNE', name: 'Cooling tune-up', bu: 'seed_bu_hvac_service', trade: 'hvac', priority: 'maintenance', minutes: 60, hours: '1.5', req: 'seed_req_acr_refrigerant', ai: true, keywords: ['tune-up', 'tune up', 'maintenance', 'check-up', 'checkup', 'service my ac'], emergency: null },
  { id: 'seed_jt_heat_tune', code: 'HEAT-TUNE', name: 'Heating tune-up', bu: 'seed_bu_hvac_service', trade: 'hvac', priority: 'maintenance', minutes: 60, hours: '1.5', req: 'seed_req_acr', ai: true, keywords: ['furnace tune', 'heating tune', 'heating maintenance', 'safety check'], emergency: null },
  { id: 'seed_jt_hvac_est', code: 'HVAC-EST', name: 'System replacement estimate', bu: 'seed_bu_hvac_install', trade: 'hvac', priority: 'standard', minutes: 75, hours: '1.5', req: 'seed_req_sales', ai: true, keywords: ['replace', 'replacement', 'new system', 'new ac', 'new unit', 'quote', 'estimate', 'old unit'], emergency: null },
  { id: 'seed_jt_drain', code: 'DRAIN-CLR', name: 'Clogged drain', bu: 'seed_bu_plumbing_service', trade: 'plumbing', priority: 'standard', minutes: 60, hours: '1.5', req: 'seed_req_drain', ai: true, keywords: ['clog', 'clogged', 'drain', 'slow drain', 'backed up', 'toilet', 'sink', 'shower'], emergency: null },
  { id: 'seed_jt_leak', code: 'LEAK-REP', name: 'Water leak', bu: 'seed_bu_plumbing_service', trade: 'plumbing', priority: 'urgent', minutes: 90, hours: '2', req: 'seed_req_plumbing', ai: true, keywords: ['leak', 'leaking', 'drip', 'dripping', 'water on floor', 'pipe'], emergency: WATER },
  { id: 'seed_jt_wh_diag', code: 'WH-DIAG', name: 'Water heater not working', bu: 'seed_bu_plumbing_service', trade: 'plumbing', priority: 'urgent', minutes: 90, hours: '2', req: 'seed_req_plumbing', ai: true, keywords: ['water heater', 'hot water', 'no hot water', 'tankless', 'pilot light'], emergency: GAS },
  { id: 'seed_jt_sewer_cam', code: 'SEWER-CAM', name: 'Sewer camera inspection', bu: 'seed_bu_plumbing_service', trade: 'plumbing', priority: 'standard', minutes: 75, hours: '1.5', req: 'seed_req_drain', ai: false, keywords: ['sewer', 'camera', 'main line', 'roots'], emergency: null },
  { id: 'seed_jt_elec_diag', code: 'ELEC-DIAG', name: 'Electrical problem: diagnostic', bu: 'seed_bu_electrical', trade: 'electrical', priority: 'urgent', minutes: 75, hours: '1.5', req: 'seed_req_electrical', ai: true, keywords: ['outlet', 'breaker', 'tripping', 'lights flicker', 'flickering', 'no power', 'switch', 'electrical'], emergency: SPARKS },
  { id: 'seed_jt_panel_est', code: 'PANEL-EST', name: 'Panel upgrade estimate', bu: 'seed_bu_electrical', trade: 'electrical', priority: 'standard', minutes: 60, hours: '1', req: 'seed_req_electrical', ai: true, keywords: ['panel', 'upgrade', '200 amp', 'fuse box', 'service upgrade'], emergency: null },
  { id: 'seed_jt_ev', code: 'EV-CHG', name: 'EV charger install estimate', bu: 'seed_bu_electrical', trade: 'electrical', priority: 'standard', minutes: 60, hours: '1', req: 'seed_req_electrical', ai: true, keywords: ['ev', 'charger', 'tesla', 'level 2', 'car charger'], emergency: null },
] as const

/** Arrival windows per weekday (1 Mon … 6 Sat). Saturday runs at half capacity. */
const SERVICE_WINDOWS = [['08:00', '10:00', '8–10 AM'], ['10:00', '12:00', '10 AM–12 PM'], ['12:00', '14:00', '12–2 PM'], ['14:00', '16:00', '2–4 PM']] as const
const INSTALL_WINDOWS = [['08:00', '12:00', '8 AM–12 PM'], ['12:00', '16:00', '12–4 PM']] as const

export const WINDOW_TEMPLATES = BUSINESS_UNITS.flatMap(bu => {
  const slots = bu.kind === 'install' ? INSTALL_WINDOWS : SERVICE_WINDOWS
  const hours = bu.kind === 'install' ? '3' : '6'
  return [1, 2, 3, 4, 5, 6].flatMap(weekday => slots.map(([start, end, label]) => ({
    id: `seed_awt_${bu.code.toLowerCase().replace(/[^a-z]/g, '')}_${weekday}_${start.replace(':', '')}`,
    businessUnitId: bu.id, weekday, startLocal: start, endLocal: end, label, capacityHours: hours, capacityFactor: weekday === 6 ? '0.5' : null,
  })))
})

export const CAMPAIGNS = [
  { id: 'seed_campaign_lsa', name: 'Google Local Services', channel: 'google_lsa', monthlyCostMinor: 450000n, number: '+15125550190' },
  { id: 'seed_campaign_ads', name: 'Google Ads: AC repair', channel: 'google_ads', monthlyCostMinor: 300000n, number: '+15125550191' },
  { id: 'seed_campaign_yard', name: 'Yard signs', channel: 'yard_sign', monthlyCostMinor: 20000n, number: '+15125550192' },
  { id: 'seed_campaign_truck', name: 'Truck wraps', channel: 'truck_wrap', monthlyCostMinor: 0n, number: '+15125550193' },
] as const

const FIRST = ['Emily', 'Michael', 'Ashley', 'David', 'Jessica', 'Chris', 'Sarah', 'Daniel', 'Laura', 'James', 'Megan', 'Robert', 'Olivia', 'Carlos', 'Hannah', 'Kevin', 'Rebecca', 'Jason', 'Natalie', 'Andrew']
const LAST = ['Garcia', 'Nguyen', 'Johnson', 'Martinez', 'Brown', 'Wilson', 'Lopez', 'Anderson', 'Thomas', 'Hernandez', 'Moore', 'Jackson', 'White', 'Clark', 'Lewis', 'Walker', 'Young', 'Allen', 'King', 'Wright']
const STREETS = ['Shoal Creek Blvd', 'Bluebonnet Ln', 'Oak Hollow Dr', 'Mesquite Trl', 'Pecan Grove Rd', 'Cedar Elm Way', 'Live Oak St', 'Prairie Dawn Dr', 'Limestone Ridge', 'Agave Ct', 'Sycamore Bend', 'Hill Country Dr']
const CITY: Record<string, string> = { '78613': 'Cedar Park', '78660': 'Pflugerville', '78664': 'Round Rock', '78665': 'Round Rock', '78681': 'Round Rock', '78717': 'Austin', '78727': 'Austin', '78728': 'Austin', '78729': 'Austin', '78750': 'Austin' }
export const ZIPS = Object.keys(ZIP_CENTROIDS)

/** Small deterministic offset (±~0.02°) so households don't sit on the ZIP centroid. */
export const jitter = (base: string, i: number, salt: number) => {
  const offsetMicro = ((i * 7919 + salt * 104729) % 4000) - 2000
  return toScale(dec(base).plus(dec(offsetMicro).div(100_000)), 6)
}

const MAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'att.net', 'hotmail.com']

export const HOUSEHOLDS = Array.from({ length: 60 }, (_, i) => {
  const first = FIRST[i % FIRST.length]
  const last = LAST[(i * 7 + 3) % LAST.length]
  const zip = ZIPS[(i * 11) % ZIPS.length]
  const [lat, lng] = ZIP_CENTROIDS[zip]
  const n = String(i + 1).padStart(3, '0')
  return {
    id: `seed_cus_${n}`, ref: `CUS-SEED-${n}`, first, last, displayName: `${first} ${last}`,
    phone: `+1512555${String(130 + i).padStart(4, '0')}`, email: `${first}.${last}${i + 1}@${MAIL_DOMAINS[i % MAIL_DOMAINS.length]}`.toLowerCase(),
    location: { id: `seed_loc_${n}`, ref: `LOC-SEED-${n}`, address1: `${1000 + ((i * 37) % 8900)} ${STREETS[i % STREETS.length]}`, city: CITY[zip] ?? 'Austin', postalCode: zip, lat: jitter(lat, i, 1), lng: jitter(lng, i, 2), propertyType: i % 9 === 4 ? 'townhome' : 'single_family', yearBuilt: 1972 + ((i * 13) % 52) },
    // Three households never agreed to texts; one has opted out by STOP.
    smsConsent: ![7, 23, 41].includes(i), optedOut: i === 52,
  }
})

export const COMMERCIAL = { id: 'seed_cus_hcpm', ref: 'CUS-SEED-HCPM', displayName: 'Hill Country Property Management', first: 'Jordan', last: 'Reese', phone: '+15125550199', email: 'maintenance@hillcountrypm.com', location: { id: 'seed_loc_hcpm_1', ref: 'LOC-SEED-HCPM-1', address1: '2200 Riverside Commons, Bldg C', city: 'Austin', postalCode: '78741', lat: '30.238100', lng: '-97.723300', propertyType: 'multifamily', yearBuilt: 1998 } }

