// Validates parsed JSON against the same Gemini responseSchema object we send.
// Supports the subset we use: OBJECT/ARRAY/STRING/INTEGER/NUMBER/BOOLEAN,
// properties, required, items, enum, minItems/maxItems.
// Returns null when valid, otherwise a short description of the first problem.

export function validate(value, schema, path = '$') {
  const t = (schema.type || '').toUpperCase();
  switch (t) {
    case 'OBJECT': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return `${path} should be an object`;
      for (const key of schema.required || []) {
        if (!(key in value) || value[key] === null || value[key] === undefined) return `${path}.${key} is missing`;
      }
      for (const [key, sub] of Object.entries(schema.properties || {})) {
        if (value[key] === undefined || value[key] === null) continue;
        const err = validate(value[key], sub, `${path}.${key}`);
        if (err) return err;
      }
      return null;
    }
    case 'ARRAY': {
      if (!Array.isArray(value)) return `${path} should be an array`;
      if (schema.minItems != null && value.length < Number(schema.minItems)) return `${path} has too few items`;
      for (let i = 0; i < value.length; i++) {
        const err = validate(value[i], schema.items || {}, `${path}[${i}]`);
        if (err) return err;
      }
      return null;
    }
    case 'STRING':
      if (typeof value !== 'string') return `${path} should be a string`;
      if (schema.enum && !schema.enum.includes(value)) return `${path} has unexpected value "${value}"`;
      return null;
    case 'INTEGER':
      return Number.isInteger(value) ? null : `${path} should be an integer`;
    case 'NUMBER':
      return typeof value === 'number' && Number.isFinite(value) ? null : `${path} should be a number`;
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : `${path} should be true/false`;
    default:
      return null;
  }
}
