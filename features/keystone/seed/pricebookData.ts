import type { ItemInput } from '../services/pricebook'
import type { MarkupTier } from '../domain/pricing'
import { roundMinor } from '../lib/money'
import { dec } from '../lib/decimal'

/*
 * Summit's flat-rate price book (BUILD-PLAN §5, Phase 2): about 300 items across HVAC, plumbing and
 * electrical, with good/better/best ladders for the six replacement sales the shop quotes most.
 * Prices are whole cents (strings); quantities and hours are exact decimal strings. Every item, cost
 * and supplier is fictional. `since` is the price-book version that introduced the row: v1 is the
 * launch catalogue, v2 adds the replacement ladders and indoor air quality, v3 adds EV charging and
 * reprices a set of tasks. v4 is a draft holding a supplier cost import.
 */

/** Whole dollars to cents, as the string the price-book API takes. */
const usd = (dollars: number) => (BigInt(dollars) * 100n).toString()

export const PRICE_BOOK = { name: 'Summit standard price book', code: 'SUMMIT-STD' }
export const SUPPLIER = 'Hill Country Supply'

export const UNITS = [
  { code: 'ea', name: 'Each', kind: 'count', maxDecimals: 0 },
  { code: 'ft', name: 'Foot', kind: 'length', maxDecimals: 2 },
  { code: 'lb', name: 'Pound', kind: 'weight', maxDecimals: 2 },
  { code: 'hr', name: 'Hour', kind: 'time', maxDecimals: 2 },
  { code: 'job', name: 'Job', kind: 'count', maxDecimals: 0 },
  { code: 'pkg', name: 'Package', kind: 'package', maxDecimals: 0 },
] as const

const BU = { hvac: 'seed_bu_hvac_service', install: 'seed_bu_hvac_install', plumbing: 'seed_bu_plumbing_service', electrical: 'seed_bu_electrical' } as const

export const LABOR_RATES = [
  { businessUnitId: null, hourlyMinor: usd(150), afterHoursMultiplier: '1.5' },
  { businessUnitId: BU.hvac, hourlyMinor: usd(158), afterHoursMultiplier: '1.5' },
  { businessUnitId: BU.install, hourlyMinor: usd(135), afterHoursMultiplier: '1.5' },
  { businessUnitId: BU.plumbing, hourlyMinor: usd(148), afterHoursMultiplier: '1.5' },
  { businessUnitId: BU.electrical, hourlyMinor: usd(155), afterHoursMultiplier: '1.5' },
]

const MATERIAL_TIERS: MarkupTier[] = [
  { fromCostMinor: '0', toCostMinor: '1000', multiplier: '2.5' },
  { fromCostMinor: '1000', toCostMinor: '5000', multiplier: '2' },
  { fromCostMinor: '5000', toCostMinor: '20000', multiplier: '1.75' },
  { fromCostMinor: '20000', toCostMinor: '100000', multiplier: '1.5' },
  { fromCostMinor: '100000', toCostMinor: null, multiplier: '1.35' },
]
const EQUIPMENT_TIERS: MarkupTier[] = [
  { fromCostMinor: '0', toCostMinor: '100000', multiplier: '1.6' },
  { fromCostMinor: '100000', toCostMinor: '500000', multiplier: '1.45' },
  { fromCostMinor: '500000', toCostMinor: null, multiplier: '1.35' },
]
export const MARKUP_TABLES = [
  { name: 'Materials', appliesTo: 'material', tiers: MATERIAL_TIERS },
  { name: 'Equipment', appliesTo: 'equipment', tiers: EQUIPMENT_TIERS },
]

export const CATEGORIES = [
  ['hvac-diagnostic', 'HVAC diagnostics', 'hvac'], ['hvac-repair', 'HVAC repairs', 'hvac'], ['hvac-maintenance', 'HVAC maintenance', 'hvac'], ['hvac-ductwork', 'Ductwork', 'hvac'],
  ['hvac-iaq', 'Indoor air quality', 'hvac'], ['hvac-replacement', 'HVAC system replacement', 'hvac'],
  ['plumbing-drain', 'Drains', 'plumbing'], ['plumbing-repair', 'Plumbing repairs', 'plumbing'], ['plumbing-fixtures', 'Fixtures', 'plumbing'], ['plumbing-water-heater', 'Water heaters', 'plumbing'],
  ['plumbing-sewer', 'Sewer', 'plumbing'], ['plumbing-repipe', 'Repiping', 'plumbing'], ['plumbing-gas', 'Gas lines', 'plumbing'], ['plumbing-water-quality', 'Water quality', 'plumbing'],
  ['electrical-diagnostic', 'Electrical diagnostics', 'electrical'], ['electrical-repair', 'Electrical repairs', 'electrical'], ['electrical-panel', 'Panels and service', 'electrical'],
  ['electrical-lighting', 'Lighting and fans', 'electrical'], ['electrical-safety', 'Safety devices', 'electrical'], ['electrical-ev', 'EV charging', 'electrical'],
  ['fees', 'Fees', 'general'], ['materials', 'Materials', 'general'],
].map(([categoryKey, name, trade], sortOrder) => ({ categoryKey, name, trade, sortOrder }))

export type SeedItem = ItemInput & { since: 1 | 2 | 3; v3UnitPriceMinor?: string }

// ── Materials (fixed price = cost × the materials markup) ──────────────────────
type Mat = [key: string, name: string, uom: string, costCents: number, trade: 'hvac' | 'plumbing' | 'electrical' | 'general']
const MATERIALS: Mat[] = [
  ['MAT-CAP-4555', 'Dual run capacitor 45/5 µF 440 V', 'ea', 1850, 'hvac'], ['MAT-CAP-355', 'Dual run capacitor 35/5 µF 440 V', 'ea', 1640, 'hvac'], ['MAT-CAP-10', 'Single run capacitor 10 µF 370 V', 'ea', 920, 'hvac'],
  ['MAT-HARDSTART', 'Hard-start kit', 'ea', 3480, 'hvac'], ['MAT-CONTACTOR', 'Contactor 2-pole 40 A', 'ea', 1590, 'hvac'], ['MAT-FAN-MOTOR-14', 'Condenser fan motor 1/4 hp', 'ea', 11200, 'hvac'],
  ['MAT-FAN-MOTOR-13', 'Condenser fan motor 1/3 hp', 'ea', 12900, 'hvac'], ['MAT-ECM-MOTOR', 'Blower motor ECM 1/2 hp', 'ea', 38500, 'hvac'], ['MAT-PSC-MOTOR', 'Blower motor PSC 1/2 hp', 'ea', 14800, 'hvac'],
  ['MAT-IGNITER', 'Hot surface igniter', 'ea', 2650, 'hvac'], ['MAT-FLAME-SENSOR', 'Flame sensor', 'ea', 1180, 'hvac'], ['MAT-PRESSURE-SW', 'Draft inducer pressure switch', 'ea', 3120, 'hvac'],
  ['MAT-INDUCER', 'Draft inducer motor', 'ea', 18900, 'hvac'], ['MAT-GAS-VALVE', 'Furnace gas valve', 'ea', 14200, 'hvac'], ['MAT-CONTROL-BOARD', 'Furnace control board', 'ea', 21500, 'hvac'],
  ['MAT-TXV', 'Thermal expansion valve', 'ea', 16800, 'hvac'], ['MAT-FILTER-DRIER', 'Liquid line filter drier', 'ea', 1490, 'hvac'], ['MAT-R410A', 'R-410A refrigerant', 'lb', 1650, 'hvac'],
  ['MAT-R454B', 'R-454B refrigerant', 'lb', 2480, 'hvac'], ['MAT-NITROGEN', 'Nitrogen (pressure test)', 'ea', 1200, 'hvac'], ['MAT-FLOAT-SW', 'Condensate float switch', 'ea', 1550, 'hvac'],
  ['MAT-COND-PUMP', 'Condensate pump', 'ea', 5900, 'hvac'], ['MAT-PVC-34', '3/4 in PVC condensate pipe', 'ft', 85, 'hvac'], ['MAT-THERMOSTAT-PROG', 'Programmable thermostat', 'ea', 4800, 'hvac'],
  ['MAT-THERMOSTAT-SMART', 'Wi-Fi smart thermostat', 'ea', 14900, 'hvac'], ['MAT-FILTER-1IN', 'Pleated filter 1 in MERV 8', 'ea', 640, 'hvac'], ['MAT-FILTER-4IN', 'Media filter 4 in MERV 13', 'ea', 3450, 'hvac'],
  ['MAT-FLEX-DUCT-8', 'Insulated flex duct 8 in', 'ft', 310, 'hvac'], ['MAT-FLEX-DUCT-6', 'Insulated flex duct 6 in', 'ft', 260, 'hvac'], ['MAT-DUCT-MASTIC', 'Duct mastic (1 gal)', 'ea', 1850, 'hvac'],
  ['MAT-REGISTER', 'Supply register', 'ea', 1100, 'hvac'], ['MAT-UV-LAMP', 'UV-C coil lamp', 'ea', 9800, 'hvac'], ['MAT-PAD', 'Condenser pad', 'ea', 4200, 'hvac'],
  ['MAT-DISCONNECT', 'AC disconnect 60 A', 'ea', 2900, 'electrical'], ['MAT-WHIP', 'Flexible whip 3/4 in × 6 ft', 'ea', 2100, 'electrical'], ['MAT-LINESET-3T', 'Line set 3/8 × 3/4 × 25 ft', 'ea', 18500, 'hvac'],
  ['MAT-PEX-12', 'PEX-A tubing 1/2 in', 'ft', 62, 'plumbing'], ['MAT-PEX-34', 'PEX-A tubing 3/4 in', 'ft', 108, 'plumbing'], ['MAT-PEX-RING', 'PEX expansion ring', 'ea', 28, 'plumbing'],
  ['MAT-PEX-TEE-12', 'PEX tee 1/2 in', 'ea', 290, 'plumbing'], ['MAT-COPPER-12', 'Type L copper 1/2 in', 'ft', 540, 'plumbing'], ['MAT-COPPER-34', 'Type L copper 3/4 in', 'ft', 860, 'plumbing'],
  ['MAT-SHARKBITE-12', 'Push-fit coupling 1/2 in', 'ea', 880, 'plumbing'], ['MAT-BALL-VALVE-34', 'Full-port ball valve 3/4 in', 'ea', 1790, 'plumbing'], ['MAT-ANGLE-STOP', 'Quarter-turn angle stop', 'ea', 840, 'plumbing'],
  ['MAT-SUPPLY-LINE', 'Braided supply line', 'ea', 690, 'plumbing'], ['MAT-WAX-RING', 'Toilet wax ring and bolts', 'ea', 590, 'plumbing'], ['MAT-FLAPPER', 'Toilet flapper', 'ea', 640, 'plumbing'],
  ['MAT-FILL-VALVE', 'Toilet fill valve', 'ea', 1150, 'plumbing'], ['MAT-PTRAP', 'P-trap 1-1/2 in', 'ea', 720, 'plumbing'], ['MAT-ABS-3', 'ABS drain pipe 3 in', 'ft', 410, 'plumbing'],
  ['MAT-PVC-4', 'PVC sewer pipe 4 in', 'ft', 520, 'plumbing'], ['MAT-CLEANOUT', 'Two-way cleanout 4 in', 'ea', 4800, 'plumbing'], ['MAT-HOSE-BIB', 'Frost-free hose bib', 'ea', 2650, 'plumbing'],
  ['MAT-PRV', 'Pressure reducing valve 3/4 in', 'ea', 11800, 'plumbing'], ['MAT-EXP-TANK', 'Thermal expansion tank 2 gal', 'ea', 4600, 'plumbing'], ['MAT-T-AND-P', 'Temperature and pressure relief valve', 'ea', 2200, 'plumbing'],
  ['MAT-ANODE', 'Water heater anode rod', 'ea', 3100, 'plumbing'], ['MAT-WH-ELEMENT', 'Water heater element 4500 W', 'ea', 2350, 'plumbing'], ['MAT-WH-THERMO', 'Water heater thermostat', 'ea', 2600, 'plumbing'],
  ['MAT-THERMOCOUPLE', 'Thermocouple', 'ea', 1250, 'plumbing'], ['MAT-GAS-FLEX', 'Gas appliance connector', 'ea', 2300, 'plumbing'], ['MAT-CSST-12', 'CSST gas line 1/2 in', 'ft', 480, 'plumbing'],
  ['MAT-DISPOSAL-12', 'Garbage disposal 1/2 hp', 'ea', 9800, 'plumbing'], ['MAT-DISPOSAL-34', 'Garbage disposal 3/4 hp', 'ea', 16500, 'plumbing'], ['MAT-FAUCET-KITCHEN', 'Kitchen faucet (builder grade)', 'ea', 12900, 'plumbing'],
  ['MAT-FAUCET-LAV', 'Lavatory faucet (builder grade)', 'ea', 7400, 'plumbing'], ['MAT-CARTRIDGE', 'Shower valve cartridge', 'ea', 3900, 'plumbing'], ['MAT-TOILET', 'Toilet, elongated, 1.28 gpf', 'ea', 21500, 'plumbing'],
  ['MAT-SUMP-PUMP', 'Sump pump 1/3 hp', 'ea', 14500, 'plumbing'], ['MAT-WATER-FILTER', 'Whole-home sediment filter', 'ea', 18900, 'plumbing'], ['MAT-SOFTENER', 'Water softener 40k grain', 'ea', 78000, 'plumbing'],
  ['MAT-RO', 'Under-sink reverse osmosis system', 'ea', 24500, 'plumbing'],
  ['MAT-GFCI-20A', 'GFCI receptacle 20 A', 'ea', 1890, 'electrical'], ['MAT-AFCI-BRK', 'AFCI/GFCI dual-function breaker', 'ea', 5400, 'electrical'], ['MAT-BRK-20A', 'Breaker 20 A single pole', 'ea', 890, 'electrical'],
  ['MAT-BRK-50A', 'Breaker 50 A double pole', 'ea', 2150, 'electrical'], ['MAT-RECEPT', 'Receptacle 15 A tamper resistant', 'ea', 340, 'electrical'], ['MAT-SWITCH', 'Single-pole switch', 'ea', 290, 'electrical'],
  ['MAT-DIMMER', 'LED dimmer switch', 'ea', 2450, 'electrical'], ['MAT-NM-12', 'NM-B 12/2 cable', 'ft', 105, 'electrical'], ['MAT-NM-6', 'NM-B 6/3 cable', 'ft', 420, 'electrical'],
  ['MAT-BOX', 'Old-work device box', 'ea', 210, 'electrical'], ['MAT-SMOKE-CO', 'Combination smoke/CO alarm (hardwired)', 'ea', 4400, 'electrical'], ['MAT-SURGE', 'Whole-home surge protector', 'ea', 12500, 'electrical'],
  ['MAT-FAN-BOX', 'Fan-rated ceiling box', 'ea', 1450, 'electrical'], ['MAT-LED-CAN', 'LED wafer light 6 in', 'ea', 1650, 'electrical'], ['MAT-EV-RECEPT', 'NEMA 14-50 receptacle', 'ea', 2900, 'electrical'],
  ['MAT-GROUND-ROD', 'Ground rod and clamp', 'ea', 2400, 'electrical'],
]

const materials = MATERIALS.map(([itemKey, name, uom, cost, trade]): SeedItem => {
  const costMinor = BigInt(cost)
  // The same tier lookup as domain/pricing markupFor (kept import-free here: the onboarding card bundles this file).
  const tier = MATERIAL_TIERS.find(t => costMinor >= BigInt(t.fromCostMinor) && (t.toCostMinor === null || costMinor < BigInt(t.toCostMinor)))!
  const price = roundMinor(dec(costMinor).times(dec(tier.multiplier)))
  return { since: 1, itemKey, kind: 'material', categoryKey: 'materials', name, uom, trade, costMinor: costMinor.toString(), unitPriceMinor: price.toString(), taxCategory: 'material', cancellationClassDefault: 'necessary_replacement_parts' }
})

// ── Flat-rate tasks ───────────────────────────────────────────────────────────
type Cls = 'requested_repair' | 'necessary_replacement_parts' | 'additional_goods_services'
type Task = [key: string, name: string, hours: string, dollars: number, cls?: Cls, description?: string, since?: 1 | 2 | 3, v3Dollars?: number]

function tasks(trade: 'hvac' | 'plumbing' | 'electrical' | 'general', businessUnitId: string | null, categoryKey: string, rows: Task[]): SeedItem[] {
  return rows.map(([itemKey, name, laborHours, dollars, cls, description, since, v3], i) => ({
    since: since ?? 1, itemKey, kind: 'service_task', categoryKey, name, trade, businessUnitId, laborHours, uom: 'job', unitPriceMinor: usd(dollars),
    customerDescription: description ?? `${name}. Flat rate, including labour and standard parts.`, taxCategory: 'labor', cancellationClassDefault: cls ?? 'requested_repair', sortOrder: i,
    ...(v3 ? { v3UnitPriceMinor: usd(v3) } : {}),
  }))
}

const P: Cls = 'necessary_replacement_parts'
const ADD: Cls = 'additional_goods_services'

const HVAC: SeedItem[] = [
  ...tasks('hvac', BU.hvac, 'hvac-diagnostic', [
    ['HVAC-DIAG', 'HVAC diagnostic', '1', 89, undefined, 'Full system diagnosis by a licensed technician; credited toward the repair if you go ahead today.', 1, 99],
    ['HVAC-DIAG-AH', 'HVAC diagnostic, evenings and weekends', '1', 179],
    ['HVAC-SECOND-OPINION', 'Second-opinion system evaluation', '1.5', 129],
    ['HVAC-LEAK-SEARCH', 'Refrigerant leak search (electronic and bubble test)', '2', 395],
    ['HVAC-DYE-TEST', 'Refrigerant UV dye leak test', '1.5', 285],
    ['HVAC-STATIC-TEST', 'Static pressure and airflow test', '1', 149],
    ['HVAC-CO-TEST', 'Combustion and carbon monoxide test', '1', 129],
    ['HVAC-DUCT-LEAK-TEST', 'Duct leakage test', '2', 349],
  ]),
  ...tasks('hvac', BU.hvac, 'hvac-repair', [
    ['HVAC-CAP-DUAL', 'Replace dual run capacitor', '0.5', 245, P, undefined, 1, 259],
    ['HVAC-CAP-SINGLE', 'Replace single run capacitor', '0.5', 195, P],
    ['HVAC-HARDSTART', 'Install hard-start kit', '0.75', 345, P],
    ['HVAC-CONTACTOR', 'Replace contactor', '0.75', 265, P, undefined, 1, 279],
    ['HVAC-COND-FAN', 'Replace condenser fan motor', '1.5', 645, P, undefined, 1, 679],
    ['HVAC-BLOWER-PSC', 'Replace blower motor (PSC)', '2', 795, P],
    ['HVAC-BLOWER-ECM', 'Replace blower motor (ECM, variable speed)', '2.5', 1395, P],
    ['HVAC-IGNITER', 'Replace furnace igniter', '0.75', 285, P, undefined, 1, 299],
    ['HVAC-FLAME-SENSOR', 'Clean or replace flame sensor', '0.5', 175, P],
    ['HVAC-PRESSURE-SW', 'Replace pressure switch', '1', 345, P],
    ['HVAC-INDUCER', 'Replace draft inducer motor', '2', 945, P],
    ['HVAC-GAS-VALVE', 'Replace furnace gas valve', '1.5', 745, P],
    ['HVAC-BOARD', 'Replace furnace control board', '1.5', 895, P, undefined, 1, 945],
    ['HVAC-TXV', 'Replace expansion valve (with recovery and evacuation)', '4', 1495, P],
    ['HVAC-DRIER', 'Replace liquid line filter drier', '1.5', 425, P],
    ['HVAC-RECHARGE-410', 'Refrigerant charge R-410A (per lb)', '0.25', 115, P, 'Refrigerant added after leak check, per pound.'],
    ['HVAC-RECHARGE-454', 'Refrigerant charge R-454B (per lb)', '0.25', 135, P, 'Refrigerant added after leak check, per pound.', 3],
    ['HVAC-LEAK-REPAIR-BRAZE', 'Braze repair of accessible refrigerant leak', '2.5', 695],
    ['HVAC-EVAP-CLEAN', 'Clean evaporator coil (in place)', '2', 395],
    ['HVAC-COND-CLEAN', 'Clean condenser coil (chemical)', '1', 225],
    ['HVAC-DRAIN-CLEAR', 'Clear condensate drain line', '0.75', 185],
    ['HVAC-FLOAT-SW', 'Install condensate safety float switch', '0.75', 215, P],
    ['HVAC-COND-PUMP', 'Replace condensate pump', '1', 395, P],
    ['HVAC-T-STAT-PROG', 'Replace thermostat (programmable)', '1', 295, P],
    ['HVAC-T-STAT-SMART', 'Upgrade to Wi-Fi smart thermostat', '1.25', 495, ADD],
    ['HVAC-DISCONNECT', 'Replace AC disconnect and whip', '1.25', 395, P],
    ['HVAC-COMPRESSOR-WARRANTY', 'Compressor replacement labour (parts under manufacturer warranty)', '6', 1895],
    ['HVAC-COIL-WARRANTY', 'Evaporator coil replacement labour (parts under warranty)', '6', 1795],
    ['HVAC-REFRIG-RECOVERY', 'Refrigerant recovery and disposal', '1', 245],
    ['HVAC-PAD-LEVEL', 'Re-level condenser on new pad', '1', 295, P],
  ]),
  ...tasks('hvac', BU.hvac, 'hvac-maintenance', [
    ['HVAC-TUNE-COOL', 'Cooling tune-up', '1.5', 129, undefined, '21-point cooling tune-up: coil rinse, electrical tightening, refrigerant check and drain flush.', 1, 139],
    ['HVAC-TUNE-HEAT', 'Heating tune-up', '1.5', 129, undefined, 'Furnace safety inspection: burners, heat exchanger, flue, igniter and carbon monoxide test.', 1, 139],
    ['HVAC-TUNE-HP', 'Heat pump tune-up', '1.75', 149],
    ['HVAC-FILTER-CHANGE', 'Replace standard filter', '0.25', 39, P],
    ['HVAC-MEDIA-FILTER', 'Replace 4 in media filter', '0.25', 95, P],
    ['HVAC-TUNE-COMMERCIAL-RTU', 'Rooftop unit preventive maintenance (per unit)', '2', 245],
  ]),
  ...tasks('hvac', BU.hvac, 'hvac-ductwork', [
    ['DUCT-SEAL', 'Seal accessible ductwork with mastic', '4', 895, ADD],
    ['DUCT-RUN-6', 'Add or replace 6 in supply run', '2', 495, ADD],
    ['DUCT-RUN-8', 'Add or replace 8 in supply run', '2.25', 565, ADD],
    ['DUCT-RETURN', 'Add return air drop', '4', 1195, ADD],
    ['DUCT-REPAIR', 'Repair disconnected or crushed duct', '1.5', 345],
    ['DUCT-CLEAN', 'Whole-home duct cleaning (up to 12 vents)', '4', 549, ADD],
    ['DUCT-REPLACE-ATTIC', 'Replace attic duct system (single-storey, up to 2,000 sq ft)', '16', 6495, ADD],
  ]),
  ...tasks('hvac', BU.hvac, 'hvac-iaq', [
    ['IAQ-UV', 'Install UV-C coil purifier', '1.5', 895, ADD, 'Ultraviolet lamp over the indoor coil to keep it free of mould and bacterial growth.', 2],
    ['IAQ-MEDIA-CABINET', 'Install 4 in media filter cabinet', '2', 695, ADD, undefined, 2],
    ['IAQ-ELECTRONIC-AC', 'Install electronic air cleaner', '2.5', 1695, ADD, undefined, 2],
    ['IAQ-HUMIDIFIER', 'Install whole-home bypass humidifier', '3', 1295, ADD, undefined, 2],
    ['IAQ-DEHUMIDIFIER', 'Install whole-home dehumidifier (70 pint)', '4', 2895, ADD, undefined, 2],
    ['IAQ-ERV', 'Install energy recovery ventilator', '6', 3895, ADD, undefined, 2],
    ['IAQ-ZONE-2', 'Add two-zone damper system', '6', 2695, ADD, undefined, 2],
  ]),
]

const PLUMBING: SeedItem[] = [
  ...tasks('plumbing', BU.plumbing, 'plumbing-drain', [
    ['DRAIN-SINK', 'Clear sink or lavatory drain', '1', 189, undefined, 'Clear one sink drain by cable from the trap or cleanout.', 1, 199],
    ['DRAIN-TUB', 'Clear tub or shower drain', '1', 199, undefined, undefined, 1, 209],
    ['DRAIN-TOILET', 'Clear toilet (auger)', '0.75', 169],
    ['DRAIN-TOILET-PULL', 'Pull toilet and clear line', '1.5', 329],
    ['DRAIN-MAIN-CLEANOUT', 'Clear main line from accessible cleanout', '1.5', 295, undefined, undefined, 1, 319],
    ['DRAIN-MAIN-ROOF', 'Clear main line through roof vent', '2.5', 495],
    ['DRAIN-LAUNDRY', 'Clear laundry standpipe', '1', 199],
    ['DRAIN-HYDROJET', 'Hydro-jet main line (up to 100 ft)', '3', 695, ADD],
    ['DRAIN-CAMERA', 'Sewer camera inspection with recording', '1', 299],
    ['DRAIN-LOCATE', 'Locate and mark sewer line', '0.75', 175],
    ['DRAIN-ENZYME', 'Monthly enzyme drain treatment (6-month supply)', '0.25', 129, ADD],
    ['DRAIN-PTRAP', 'Replace P-trap', '0.75', 215, P],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-repair', [
    ['PLB-LEAK-LOCATE', 'Locate hidden water leak (acoustic and thermal)', '2', 395],
    ['PLB-SLAB-LEAK-DETECT', 'Slab leak detection', '2.5', 495],
    ['PLB-PIPE-REPAIR-12', 'Repair 1/2 in water line (accessible)', '1.5', 345],
    ['PLB-PIPE-REPAIR-34', 'Repair 3/4 in water line (accessible)', '1.75', 395],
    ['PLB-SLAB-REROUTE', 'Re-route slab leak line through attic (single fixture group)', '8', 2895],
    ['PLB-ANGLE-STOP', 'Replace angle stop and supply line', '0.75', 195, P],
    ['PLB-MAIN-VALVE', 'Replace main shut-off valve', '2', 595, P],
    ['PLB-PRV', 'Replace pressure reducing valve', '2', 745, P, undefined, 1, 785],
    ['PLB-EXP-TANK', 'Install thermal expansion tank', '1', 395, P],
    ['PLB-TOILET-REBUILD', 'Rebuild toilet tank (fill valve and flapper)', '1', 245, P],
    ['PLB-TOILET-RESET', 'Reset toilet with new wax ring', '1', 265, P],
    ['PLB-CARTRIDGE', 'Replace shower valve cartridge', '1', 295, P],
    ['PLB-SHOWER-VALVE', 'Replace shower valve (open wall, tile not included)', '4', 1095],
    ['PLB-DISPOSAL-REPAIR', 'Free jammed disposal and reset', '0.5', 149],
    ['PLB-ICE-LINE', 'Install refrigerator ice-maker line', '1', 245, ADD],
    ['PLB-WASHER-BOX', 'Replace washing machine valve box', '2.5', 645],
    ['PLB-SUMP', 'Replace sump pump', '1.5', 645, P],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-fixtures', [
    ['FIX-FAUCET-KITCHEN', 'Install kitchen faucet (customer or Summit supplied)', '1.25', 295],
    ['FIX-FAUCET-LAV', 'Install lavatory faucet', '1', 245],
    ['FIX-TOILET', 'Install new toilet (1.28 gpf, elongated)', '1.5', 645, ADD],
    ['FIX-DISPOSAL-12', 'Install 1/2 hp garbage disposal', '1', 445, ADD],
    ['FIX-DISPOSAL-34', 'Install 3/4 hp garbage disposal', '1', 595, ADD],
    ['FIX-DISHWASHER', 'Connect dishwasher (water and drain)', '1.5', 295],
    ['FIX-HOSE-BIB-ADD', 'Add new hose bib', '2.5', 495, ADD],
    ['FIX-TUB-SPOUT', 'Replace tub spout', '0.5', 145],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-water-heater', [
    ['WH-FLUSH', 'Flush water heater', '1', 189],
    ['WH-ANODE', 'Replace anode rod', '1', 295, P],
    ['WH-TP-VALVE', 'Replace temperature and pressure relief valve', '0.75', 245, P],
    ['WH-ELEMENT', 'Replace electric element', '1', 295, P],
    ['WH-THERMOSTAT', 'Replace electric thermostat', '1', 295, P],
    ['WH-THERMOCOUPLE', 'Replace gas thermocouple', '0.75', 225, P],
    ['WH-GAS-CONTROL', 'Replace gas control valve', '1.5', 595, P],
    ['WH-TANKLESS-DESCALE', 'Descale tankless water heater', '1.5', 295],
    ['WH-PAN', 'Install drain pan and line', '1.5', 345, ADD],
    ['WH-HAUL', 'Remove and dispose of old water heater', '0.5', 125],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-gas', [
    ['GAS-LEAK-TEST', 'Gas line pressure test', '1.5', 295],
    ['GAS-CONNECTOR', 'Replace appliance gas connector', '0.75', 225, P],
    ['GAS-LINE-RUN', 'Run new gas line (up to 25 ft CSST)', '4', 1095, ADD],
    ['GAS-SHUTOFF', 'Replace gas shut-off valve', '1', 295, P],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-water-quality', [
    ['WQ-TEST', 'Water quality test (hardness, chlorine, TDS)', '0.5', 0, undefined, 'Free water test with any plumbing visit.'],
    ['WQ-SEDIMENT', 'Install whole-home sediment filter', '2.5', 895, ADD],
    ['WQ-SOFTENER', 'Install water softener (40k grain)', '4', 2495, ADD],
    ['WQ-RO', 'Install under-sink reverse osmosis', '2', 895, ADD],
  ]),
]

const ELECTRICAL: SeedItem[] = [
  ...tasks('electrical', BU.electrical, 'electrical-diagnostic', [
    ['ELE-DIAG', 'Electrical diagnostic', '1', 99, undefined, 'Trace and diagnose one electrical problem; credited toward the repair if you go ahead today.'],
    ['ELE-SAFETY-INSPECT', 'Whole-home electrical safety inspection', '2', 199],
    ['ELE-THERMAL-SCAN', 'Panel thermal imaging scan', '0.75', 149],
  ]),
  ...tasks('electrical', BU.electrical, 'electrical-repair', [
    ['ELE-RECEPT', 'Replace receptacle', '0.5', 145, P, undefined, 1, 155],
    ['ELE-SWITCH', 'Replace switch', '0.5', 135, P],
    ['ELE-DIMMER', 'Install LED dimmer', '0.75', 195, ADD],
    ['ELE-BREAKER-20', 'Replace 20 A breaker', '0.75', 225, P],
    ['ELE-BREAKER-50', 'Replace 50 A double-pole breaker', '1', 295, P],
    ['ELE-LOOSE-NEUTRAL', 'Repair loose neutral or connection in panel', '1.5', 345],
    ['ELE-CIRCUIT-TRACE', 'Trace and repair open circuit', '2', 395],
    ['ELE-NEW-CIRCUIT-20', 'Add dedicated 20 A circuit (up to 50 ft)', '3', 695, ADD],
    ['ELE-NEW-OUTLET', 'Add new outlet on existing circuit', '1.5', 295, ADD],
    ['ELE-OUTDOOR-OUTLET', 'Add weather-resistant outdoor outlet', '2', 395, ADD],
    ['ELE-DOORBELL', 'Replace doorbell transformer', '1', 195, P],
    ['ELE-ALUMINUM-PIGTAIL', 'Pigtail aluminum branch wiring (per device)', '0.5', 95],
  ]),
  ...tasks('electrical', BU.electrical, 'electrical-panel', [
    ['PANEL-INSPECT', 'Panel inspection and torque check', '1', 175],
    ['PANEL-SUBPANEL', 'Install 100 A sub-panel', '8', 2495, ADD],
    ['PANEL-METER-BASE', 'Replace meter base (utility coordination)', '6', 1895],
    ['PANEL-GROUNDING', 'Upgrade grounding and bonding', '3', 795],
    ['PANEL-GENERATOR-INLET', 'Install generator inlet and interlock', '4', 1295, ADD],
  ]),
  ...tasks('electrical', BU.electrical, 'electrical-lighting', [
    ['LIGHT-FIXTURE', 'Replace light fixture (customer supplied)', '1', 195],
    ['LIGHT-FAN', 'Install ceiling fan on fan-rated box', '1.5', 295, ADD],
    ['LIGHT-FAN-BOX', 'Install ceiling fan with new fan-rated box', '2', 395, ADD],
    ['LIGHT-CAN-4', 'Install four LED wafer lights', '3', 795, ADD],
    ['LIGHT-CAN-6', 'Install six LED wafer lights', '4', 1095, ADD],
    ['LIGHT-MOTION', 'Install motion security light', '1.25', 295, ADD],
    ['LIGHT-LANDSCAPE-XFMR', 'Replace landscape lighting transformer', '1', 345, P],
  ]),
  ...tasks('electrical', BU.electrical, 'electrical-safety', [
    ['SAFE-GFCI', 'Install GFCI receptacle', '0.75', 225, P],
    ['SAFE-AFCI', 'Install AFCI/GFCI breaker', '0.75', 295, P],
    ['SAFE-SMOKE-CO', 'Replace hardwired smoke/CO alarm', '0.5', 175, P],
    ['SAFE-SURGE', 'Install whole-home surge protector', '1', 495, ADD, 'Type 2 surge protective device at the panel; protects every circuit in the home.', 1, 525],
    ['SAFE-SMOKE-ALL', 'Replace all hardwired smoke/CO alarms (up to 6)', '2', 795, ADD],
  ]),
]

const COMMERCIAL: SeedItem[] = [
  ...tasks('hvac', BU.hvac, 'hvac-maintenance', [
    ['COM-RTU-BELT', 'Replace rooftop unit blower belt', '0.75', 165, P],
    ['COM-RTU-FILTERS', 'Replace rooftop unit filters (per unit)', '0.5', 95, P],
    ['COM-RTU-COIL-CLEAN', 'Clean rooftop condenser coil (per unit)', '1.5', 295],
    ['COM-RTU-ECON', 'Economizer inspection and actuator test', '1', 195],
    ['COM-RTU-DIAG', 'Commercial HVAC diagnostic (first hour)', '1', 189],
    ['COM-RTU-HOURLY', 'Commercial HVAC labour (each additional hour)', '1', 165],
    ['COM-MINISPLIT-CLEAN', 'Ductless mini-split deep clean (per head)', '1.5', 245],
    ['COM-ICE-MACHINE-DRAIN', 'Clear ice machine drain and air gap', '1', 215],
  ]),
  ...tasks('plumbing', BU.plumbing, 'plumbing-repair', [
    ['COM-BACKFLOW-TEST', 'Annual backflow prevention assembly test', '0.75', 125],
    ['COM-BACKFLOW-REPAIR', 'Rebuild backflow prevention assembly', '2', 495, P],
    ['COM-GREASE-TRAP-JET', 'Hydro-jet grease line (up to 50 ft)', '2', 545],
    ['COM-FLUSH-VALVE', 'Rebuild commercial flush valve', '0.75', 185, P],
    ['COM-MOP-SINK', 'Replace mop sink faucet', '1.25', 345, P],
    ['COM-PLUMB-HOURLY', 'Commercial plumbing labour (per hour)', '1', 165],
  ]),
  ...tasks('electrical', BU.electrical, 'electrical-repair', [
    ['COM-EXIT-SIGN', 'Replace exit sign with battery backup', '0.75', 195, P],
    ['COM-EMERG-LIGHT', 'Replace emergency light unit', '0.75', 215, P],
    ['COM-LIGHT-RETROFIT', 'LED retrofit of 2×4 troffer (per fixture)', '0.5', 145, ADD],
    ['COM-PARKING-LIGHT', 'Parking lot light repair (lift included)', '2', 595],
    ['COM-ELEC-HOURLY', 'Commercial electrical labour (per hour)', '1', 175],
    ['COM-PANEL-LABEL', 'Trace and label panel directory', '2', 295],
    ['COM-IR-SCAN', 'Commercial switchgear infrared scan', '2', 495],
  ]),
]

const FEES: SeedItem[] = [
  { since: 1, itemKey: 'FEE-TRIP', kind: 'fee', categoryKey: 'fees', name: 'Service call', trade: 'general', uom: 'job', unitPriceMinor: usd(79), taxCategory: 'fee', customerDescription: 'Trip and first look; credited toward any repair done today.', cancellationClassDefault: 'requested_repair' },
  { since: 1, itemKey: 'FEE-AFTER-HOURS', kind: 'fee', categoryKey: 'fees', name: 'After-hours dispatch', trade: 'general', uom: 'job', unitPriceMinor: usd(149), taxCategory: 'fee', customerDescription: 'Evenings, weekends and holidays.', cancellationClassDefault: 'requested_repair' },
  { since: 1, itemKey: 'FEE-PERMIT-MECH', kind: 'fee', categoryKey: 'fees', name: 'Mechanical permit (City of Austin)', trade: 'hvac', uom: 'job', unitPriceMinor: usd(195), costMinor: usd(150), taxCategory: 'permit_passthrough', customerDescription: 'City permit and inspection scheduling.', cancellationClassDefault: 'additional_goods_services' },
  { since: 1, itemKey: 'FEE-PERMIT-PLUMB', kind: 'fee', categoryKey: 'fees', name: 'Plumbing permit (City of Austin)', trade: 'plumbing', uom: 'job', unitPriceMinor: usd(175), costMinor: usd(130), taxCategory: 'permit_passthrough', customerDescription: 'City permit and inspection scheduling.', cancellationClassDefault: 'additional_goods_services' },
  { since: 1, itemKey: 'FEE-PERMIT-ELEC', kind: 'fee', categoryKey: 'fees', name: 'Electrical permit (City of Austin)', trade: 'electrical', uom: 'job', unitPriceMinor: usd(165), costMinor: usd(120), taxCategory: 'permit_passthrough', customerDescription: 'City permit and inspection scheduling.', cancellationClassDefault: 'additional_goods_services' },
  { since: 1, itemKey: 'FEE-DISPOSAL', kind: 'fee', categoryKey: 'fees', name: 'Equipment haul-away and disposal', trade: 'general', uom: 'job', unitPriceMinor: usd(125), costMinor: usd(40), taxCategory: 'disposal', customerDescription: 'Removal and lawful disposal of old equipment, including refrigerant recovery.', cancellationClassDefault: 'additional_goods_services' },
  { since: 1, itemKey: 'FEE-CRANE', kind: 'fee', categoryKey: 'fees', name: 'Crane lift (rooftop equipment)', trade: 'hvac', uom: 'job', unitPriceMinor: usd(1450), costMinor: usd(1100), taxCategory: 'fee', customerDescription: 'Crane and operator for rooftop equipment.', cancellationClassDefault: 'additional_goods_services' },
]

// ── Formula-priced tasks (labour hours × rate + materials × markup, frozen at publish) ──
type FormulaTask = [key: string, name: string, trade: 'hvac' | 'plumbing' | 'electrical', bu: string, category: string, hours: string, mats: [string, string][], cls?: Cls]
const FORMULA: FormulaTask[] = [
  ['F-HOSE-BIB', 'Replace hose bib (frost-free)', 'plumbing', BU.plumbing, 'plumbing-repair', '1.25', [['MAT-HOSE-BIB', '1'], ['MAT-PEX-12', '3'], ['MAT-PEX-RING', '2']], P],
  ['F-SUPPLY-LINES', 'Replace both supply lines and stops at one fixture', 'plumbing', BU.plumbing, 'plumbing-repair', '1', [['MAT-ANGLE-STOP', '2'], ['MAT-SUPPLY-LINE', '2']], P],
  ['F-TOILET-FILL', 'Replace toilet fill valve and flapper', 'plumbing', BU.plumbing, 'plumbing-repair', '0.75', [['MAT-FILL-VALVE', '1'], ['MAT-FLAPPER', '1']], P],
  ['F-PRV-EXP', 'Replace PRV and add expansion tank', 'plumbing', BU.plumbing, 'plumbing-repair', '2.5', [['MAT-PRV', '1'], ['MAT-EXP-TANK', '1'], ['MAT-COPPER-34', '4']], P],
  ['F-GAS-RUN-10', 'Run gas line to new appliance (10 ft)', 'plumbing', BU.plumbing, 'plumbing-gas', '2.5', [['MAT-CSST-12', '10'], ['MAT-GAS-FLEX', '1']], ADD],
  ['F-DISPOSAL-12', 'Replace garbage disposal 1/2 hp (installed)', 'plumbing', BU.plumbing, 'plumbing-fixtures', '1', [['MAT-DISPOSAL-12', '1']], P],
  ['F-DISPOSAL-34', 'Replace garbage disposal 3/4 hp (installed)', 'plumbing', BU.plumbing, 'plumbing-fixtures', '1', [['MAT-DISPOSAL-34', '1']], ADD],
  ['F-CAP-DUAL-45', 'Dual run capacitor 45/5 (installed)', 'hvac', BU.hvac, 'hvac-repair', '0.5', [['MAT-CAP-4555', '1']], P],
  ['F-IGNITER', 'Furnace igniter (installed)', 'hvac', BU.hvac, 'hvac-repair', '0.75', [['MAT-IGNITER', '1']], P],
  ['F-FLOAT-PUMP', 'Condensate pump with float switch (installed)', 'hvac', BU.hvac, 'hvac-repair', '1.25', [['MAT-COND-PUMP', '1'], ['MAT-FLOAT-SW', '1'], ['MAT-PVC-34', '10']], P],
  ['F-SMART-TSTAT', 'Smart thermostat (installed and configured)', 'hvac', BU.hvac, 'hvac-repair', '1.25', [['MAT-THERMOSTAT-SMART', '1']], ADD],
  ['F-DUCT-RUN-8-25', '8 in supply run, 25 ft (installed)', 'hvac', BU.hvac, 'hvac-ductwork', '2', [['MAT-FLEX-DUCT-8', '25'], ['MAT-REGISTER', '1'], ['MAT-DUCT-MASTIC', '1']], ADD],
  ['F-GFCI-2', 'Two GFCI receptacles (installed)', 'electrical', BU.electrical, 'electrical-safety', '1', [['MAT-GFCI-20A', '2']], P],
  ['F-CIRCUIT-20-50', 'Dedicated 20 A circuit, 50 ft (formula)', 'electrical', BU.electrical, 'electrical-repair', '3', [['MAT-BRK-20A', '1'], ['MAT-NM-12', '50'], ['MAT-RECEPT', '1'], ['MAT-BOX', '1']], ADD],
  ['F-SMOKE-CO-4', 'Four hardwired smoke/CO alarms (installed)', 'electrical', BU.electrical, 'electrical-safety', '1.5', [['MAT-SMOKE-CO', '4']], ADD],
  ['F-EV-1450-30', 'NEMA 14-50 EV outlet, 30 ft run', 'electrical', BU.electrical, 'electrical-ev', '3.5', [['MAT-BRK-50A', '1'], ['MAT-NM-6', '30'], ['MAT-EV-RECEPT', '1']], ADD],
]
const formula: SeedItem[] = FORMULA.map(([itemKey, name, trade, businessUnitId, categoryKey, laborHours, mats, cls], i) => ({
  since: itemKey.startsWith('F-EV') ? 3 : 1, itemKey, kind: 'service_task', pricingMethod: 'formula', categoryKey, name, trade, businessUnitId, laborHours, uom: 'job', unitPriceMinor: '0',
  materials: mats.map(([key, quantity]) => ({ itemKey: key, quantity })), customerDescription: `${name}. Price includes labour and the parts listed.`, taxCategory: 'labor', cancellationClassDefault: cls ?? 'requested_repair', sortOrder: 100 + i,
}))

// ── EV charging (v3) ───────────────────────────────────────────────────────────
const EV: SeedItem[] = tasks('electrical', BU.electrical, 'electrical-ev', [
  ['EV-L2-HARDWIRE', 'Install Level 2 charger, hardwired (customer supplied, up to 30 ft)', '4', 1195, ADD, undefined, 3],
  ['EV-L2-OUTLET', 'Install NEMA 14-50 outlet for Level 2 charging (up to 30 ft)', '3.5', 895, ADD, undefined, 3],
  ['EV-LOAD-CALC', 'Load calculation for EV charging', '1', 149, undefined, undefined, 3],
  ['EV-LOAD-MANAGER', 'Install EV load management device', '2', 795, ADD, undefined, 3],
])

// ── Good / better / best ladders (v2) ──────────────────────────────────────────
type Rung = [tier: 'good' | 'better' | 'best', key: string, name: string, description: string, hours: string, costDollars: number, priceDollars: number, warranty: string]
function ladder(ladderKey: string, trade: 'hvac' | 'plumbing' | 'electrical', businessUnitId: string, categoryKey: string, kind: 'equipment' | 'service_task', rungs: Rung[]): SeedItem[] {
  return rungs.map(([tier, itemKey, name, customerDescription, laborHours, cost, price, warrantyText], i) => ({
    since: 2, itemKey, kind, categoryKey, name, trade, businessUnitId, laborHours, uom: 'job', costMinor: usd(cost), unitPriceMinor: usd(price), customerDescription, warrantyText,
    taxCategory: kind === 'equipment' ? 'equipment' : 'labor', cancellationClassDefault: 'additional_goods_services', ladderKey, tier, sortOrder: i,
  }))
}

const LADDERS: SeedItem[] = [
  ...ladder('AC-FURNACE-3T', 'hvac', BU.install, 'hvac-replacement', 'equipment', [
    ['good', 'SYS-ACF-3T-GOOD', '3-ton AC and 80% furnace, single stage', '14.3 SEER2 air conditioner, 80% AFUE single-stage furnace, matched coil, new line set, pad, disconnect, programmable thermostat, permit and haul-away.', '12', 4850, 9895, '10-year parts, 2-year labour (with registration).'],
    ['better', 'SYS-ACF-3T-BETTER', '3-ton AC and 96% furnace, two stage', '16 SEER2 two-stage air conditioner, 96% AFUE two-stage variable-speed furnace, matched coil, new line set, media filter cabinet, smart thermostat, permit and haul-away.', '14', 6900, 13495, '10-year parts, 5-year labour (with registration).'],
    ['best', 'SYS-ACF-3T-BEST', '3-ton variable-speed AC and modulating furnace', '20 SEER2 variable-speed inverter air conditioner, 97% modulating furnace, communicating thermostat, UV-C coil purifier, permit and haul-away.', '16', 9800, 18995, '12-year parts, 10-year labour, 10-year unit replacement (with registration).'],
  ]),
  ...ladder('HEAT-PUMP-3T', 'hvac', BU.install, 'hvac-replacement', 'equipment', [
    ['good', 'SYS-HP-3T-GOOD', '3-ton heat pump split, single stage', '15 SEER2 / 7.8 HSPF2 heat pump, matched air handler with 10 kW heat strip, new line set, programmable thermostat, permit and haul-away.', '12', 5200, 10495, '10-year parts, 2-year labour (with registration).'],
    ['better', 'SYS-HP-3T-BETTER', '3-ton heat pump split, two stage', '16.5 SEER2 / 8.5 HSPF2 two-stage heat pump, variable-speed air handler, smart thermostat, media filter cabinet, permit and haul-away.', '14', 7300, 14295, '10-year parts, 5-year labour (with registration).'],
    ['best', 'SYS-HP-3T-BEST', '3-ton inverter heat pump, cold-climate rated', '21 SEER2 / 10 HSPF2 inverter heat pump, communicating air handler and thermostat, UV-C coil purifier, permit and haul-away.', '16', 10400, 19995, '12-year parts, 10-year labour, 10-year unit replacement (with registration).'],
  ]),
  ...ladder('WATER-HEATER', 'plumbing', BU.plumbing, 'plumbing-water-heater', 'equipment', [
    ['good', 'WH-50G-GAS-6', '50-gallon gas water heater, 6-year', 'Atmospheric-vent 40,000 BTU tank, new gas connector, T&P valve and discharge, drain pan, expansion tank, permit and haul-away.', '4', 780, 2195, '6-year tank and parts, 1-year labour.'],
    ['better', 'WH-50G-GAS-12', '50-gallon gas water heater, 12-year', 'Commercial-grade 50,000 BTU tank with dual anodes, new gas connector, T&P valve, drain pan, expansion tank, permit and haul-away.', '4.5', 1180, 2895, '12-year tank and parts, 3-year labour.'],
    ['best', 'WH-TANKLESS-199', 'Tankless gas water heater, 199,000 BTU', 'Condensing tankless water heater with recirculation-ready controls, new venting, gas line upsizing up to 20 ft, isolation valves, permit and haul-away of the old tank.', '9', 2150, 5495, '15-year heat exchanger, 5-year parts, 3-year labour.'],
  ]),
  ...ladder('PANEL-200A', 'electrical', BU.electrical, 'electrical-panel', 'service_task', [
    ['good', 'PANEL-200A-GOOD', '200 A panel replacement', 'Replace main panel with a 200 A 40-space panel, new breakers for existing circuits, grounding and bonding to code, permit and utility coordination.', '10', 1100, 3895, '5-year workmanship; manufacturer warranty on panel and breakers.'],
    ['better', 'PANEL-200A-BETTER', '200 A panel with surge and AFCI/GFCI protection', 'Everything in the 200 A panel replacement plus whole-home surge protector and AFCI/GFCI breakers where code requires them.', '12', 1650, 5295, '10-year workmanship; manufacturer warranty on panel and breakers.'],
    ['best', 'PANEL-200A-BEST', '200 A smart panel with EV-ready circuit', 'Smart panel with per-circuit monitoring and load management, whole-home surge protector, AFCI/GFCI protection, and a 50 A EV-ready circuit.', '14', 3900, 8995, '10-year workmanship; manufacturer warranty on panel and breakers.'],
  ]),
  ...ladder('SEWER-LINE', 'plumbing', BU.plumbing, 'plumbing-sewer', 'service_task', [
    ['good', 'SEWER-SPOT-REPAIR', 'Sewer spot repair (up to 10 ft, open trench)', 'Excavate and replace up to 10 ft of the damaged section with SDR-35 PVC, camera verification, backfill and permit.', '12', 650, 3495, '2-year workmanship on the repaired section.'],
    ['better', 'SEWER-TRENCHLESS-LINER', 'Trenchless sewer lining (up to 60 ft)', 'Hydro-jet, then cured-in-place liner from cleanout to tap, new two-way cleanout, camera verification and permit.', '16', 3200, 9995, '10-year workmanship on the lined section.'],
    ['best', 'SEWER-REPLACE-FULL', 'Full sewer line replacement (up to 60 ft)', 'Replace the building sewer from foundation to tap with SDR-35 PVC by pipe-bursting or trench, new cleanout, camera verification and permit.', '24', 4200, 14995, '25-year workmanship on the new line.'],
  ]),
  ...ladder('REPIPE', 'plumbing', BU.plumbing, 'plumbing-repipe', 'service_task', [
    ['good', 'REPIPE-PEX-2BA', 'Whole-home PEX repipe (up to 2 bathrooms)', 'Replace supply piping with PEX-A home runs through the attic, new stops at every fixture, pressure test and permit; drywall patches ready for paint.', '28', 1800, 6995, '10-year workmanship; 25-year manufacturer warranty on PEX-A.'],
    ['better', 'REPIPE-PEX-2BA-MANIFOLD', 'PEX repipe with manifold and new main valve (up to 2 bathrooms)', 'PEX-A repipe with a central manifold, new main shut-off, PRV and expansion tank, pressure test and permit; drywall repaired and textured.', '32', 2600, 8995, '15-year workmanship; 25-year manufacturer warranty on PEX-A.'],
    ['best', 'REPIPE-COPPER-2BA', 'Whole-home Type L copper repipe (up to 2 bathrooms)', 'Type L copper supply throughout with new main shut-off, PRV, expansion tank and stops, pressure test and permit; drywall repaired, textured and painted.', '40', 5200, 13995, '20-year workmanship.'],
  ]),
]

export const CATALOG: SeedItem[] = [...materials, ...HVAC, ...PLUMBING, ...ELECTRICAL, ...COMMERCIAL, ...FEES, ...formula, ...EV, ...LADDERS]

/** The rows a version adds (its `since`), and in v3 the rows it reprices. */
export const itemsFor = (version: 1 | 2 | 3) => {
  const strip = ({ since: _s, v3UnitPriceMinor: _v, ...item }: SeedItem): ItemInput => item
  const added = CATALOG.filter(i => i.since === version).map(strip)
  const repriced = version === 3 ? CATALOG.filter(i => i.since < 3 && i.v3UnitPriceMinor).map(i => ({ ...strip(i), unitPriceMinor: i.v3UnitPriceMinor! })) : []
  return [...added, ...repriced]
}

/** The supplier's new costs for the v4 draft: +6% on HVAC parts, +4% on copper and PEX, -3% on breakers. */
export function supplierCosts(): { itemKey: string; costMinor: string }[] {
  const pct = (key: string) => key.startsWith('MAT-COPPER') || key.startsWith('MAT-PEX') ? 400 : key.startsWith('MAT-BRK') ? -300 : 600
  return MATERIALS.filter(([key, , , , trade]) => trade === 'hvac' || key.startsWith('MAT-COPPER') || key.startsWith('MAT-PEX') || key.startsWith('MAT-BRK'))
    .map(([itemKey, , , cost]) => ({ itemKey, costMinor: roundMinor(dec(cost).times(dec(10_000 + pct(itemKey))).div(10_000)).toString() }))
}

export const VERSION_LABELS = { 1: 'Launch 2026', 2: 'Spring 2026: replacement ladders and IAQ', 3: 'Fall 2026: EV charging and price review' } as const
