export interface VariableDefinition {
  type: "string" | "number" | "url" | "html";
  required: boolean;
  description: string;
  example: string;
  default?: string;
}

export type VariableRow = { name: string } & VariableDefinition;

export function variableSchemaToRows(
  schema: Record<string, VariableDefinition>,
): VariableRow[] {
  return Object.entries(schema).map(([name, def]) => ({ name, ...def }));
}

export function rowsToVariableSchema(
  rows: VariableRow[],
): Record<string, VariableDefinition> {
  const schema: Record<string, VariableDefinition> = {};
  for (const { name, ...def } of rows) {
    if (name.trim()) schema[name.trim()] = def;
  }
  return schema;
}

export function buildSampleVariables(
  schema: Record<string, VariableDefinition>,
): Record<string, string> {
  const sample: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema)) {
    sample[name] = def.example || `[${name}]`;
  }
  return sample;
}
