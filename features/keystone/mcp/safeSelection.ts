/**
 * The generic MCP data tools take a field list from the caller. It was pasted straight into the
 * GraphQL document, so a caller could close the selection and add anything (aliases, filters on
 * hidden fields, extra root fields). Now it is parsed against a strict grammar and rebuilt:
 * names and nested selections only, no arguments, aliases, directives, fragments or strings.
 * Access control still applies on top (it runs as the caller), but nothing the caller types can
 * change the shape of the operation.
 */
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const MAX_FIELDS = 80
const MAX_DEPTH = 4

export class SelectionError extends Error {}

type Node = { name: string; children: Node[] | null }

export function parseSelection(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2000) throw new SelectionError('fields must be a short string of field names, e.g. "id name"')
  const tokens = input.match(/[A-Za-z_][A-Za-z0-9_]*|[{}]|\s+|,|./g) ?? []
  let i = 0
  let count = 0
  const parseSet = (depth: number): Node[] => {
    if (depth > MAX_DEPTH) throw new SelectionError('Selection is nested too deeply')
    const nodes: Node[] = []
    while (i < tokens.length) {
      const t = tokens[i]
      if (/^\s+$/.test(t) || t === ',') { i++; continue }
      if (t === '}') return nodes
      if (t === '{') throw new SelectionError('Unexpected "{"')
      if (!NAME.test(t)) throw new SelectionError(`"${t}" is not allowed in fields; use plain field names only`)
      if (++count > MAX_FIELDS) throw new SelectionError('Too many fields selected')
      i++
      let children: Node[] | null = null
      while (i < tokens.length && /^\s+$/.test(tokens[i])) i++
      if (tokens[i] === '{') {
        i++
        children = parseSet(depth + 1)
        if (tokens[i] !== '}') throw new SelectionError('Unclosed "{" in fields')
        i++
        if (!children.length) throw new SelectionError('Empty selection')
      }
      nodes.push({ name: t, children })
    }
    return nodes
  }
  const nodes = parseSet(1)
  if (i < tokens.length) throw new SelectionError('Unbalanced "}" in fields')
  if (!nodes.length) throw new SelectionError('Select at least one field')
  const render = (list: Node[]): string => list.map(n => (n.children ? `${n.name} { ${render(n.children)} }` : n.name)).join(' ')
  return render(nodes)
}

/** A root query field name: letters and digits only. */
export function parseOperation(input: unknown): string {
  if (typeof input !== 'string' || !NAME.test(input)) throw new SelectionError('operation must be a plain query name such as "jobs"')
  return input
}
