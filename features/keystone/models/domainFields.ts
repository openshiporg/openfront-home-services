import { bigInt, decimal, integer, select, text } from '@keystone-6/core/fields'

/** Money in integer minor units (SCHEMA G2); field names end in `Minor`. */
export const minor = (options: { required?: boolean; defaultValue?: bigint; description?: string } = {}) =>
  bigInt({
    ...(options.defaultValue !== undefined ? { defaultValue: options.defaultValue } : {}),
    validation: { isRequired: options.required ?? options.defaultValue !== undefined },
    ...(options.description ? { ui: { description: options.description } } : {}),
  })

/** ISO-4217 currency code, default USD. */
export const ccy = () =>
  text({ defaultValue: 'USD', validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'ISO 4217 currency code required' } } })

const exact = (precision: number, scale: number) => (options: { required?: boolean; description?: string } = {}) =>
  decimal({
    precision,
    scale,
    validation: { isRequired: options.required ?? false },
    ...(options.description ? { ui: { description: options.description } } : {}),
  })

/** Quantities (parts, feet, lb, hours, credits): numeric(18,4) (SCHEMA G3). */
export const qty = exact(18, 4)
/** Rates and percentages (markups, commission, tax, discounts, multipliers): numeric(12,6). */
export const rate = exact(12, 6)
/** Latitude / longitude: numeric(9,6) (SCHEMA G12: no floats anywhere). */
export const geo = exact(9, 6)

/** Integer basis points (discount thresholds). */
export const bps = (defaultValue?: number) =>
  integer({ ...(defaultValue !== undefined ? { defaultValue } : {}), validation: { isRequired: defaultValue !== undefined } })

const option = (value: string) => ({ label: value.replaceAll('_', ' ').replaceAll('.', ' · '), value })

/**
 * A lifecycle status. It changes only through transition mutations (SCHEMA G6): never through the
 * generated create/update operations.
 */
export const lifecycle = (values: readonly string[], initial = values[0]) =>
  select({
    type: 'string',
    options: values.map(option),
    defaultValue: initial,
    validation: { isRequired: true },
    access: { create: () => false, update: () => false },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

/** A plain choice that staff may edit. */
export const choice = (values: readonly string[], initial: string | null = values[0]) =>
  select({
    type: 'string',
    options: values.map(option),
    ...(initial !== null ? { defaultValue: initial } : {}),
    validation: { isRequired: initial !== null },
  })

/** Compare-and-set version (SCHEMA G5). Incremented only by server code. */
export const versionField = () =>
  integer({
    defaultValue: 0,
    validation: { isRequired: true },
    access: { create: () => false, update: () => false },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

/** Server-written text that is visible but never edited through the API. */
export const systemText = (options: { indexed?: boolean | 'unique'; required?: boolean } = {}) =>
  text({
    ...(options.indexed ? { isIndexed: options.indexed } : {}),
    validation: { isRequired: options.required ?? false },
    access: { create: () => false, update: () => false },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

export const readOnly = { access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } } }

/** A choice fixed at creation by server code (e.g. a grant scope): visible, never edited. */
export const fixedChoice = (values: readonly string[]) =>
  select({
    type: 'string',
    options: values.map(option),
    validation: { isRequired: true },
    access: { create: () => false, update: () => false },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })
