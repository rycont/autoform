import * as z from "zod/v4/core";

export function getDefaultValueInZodStack(schema: z.$ZodType): any {
  if (schema instanceof z.$ZodDefault) {
    return schema._zod.def.defaultValue;
  }

  if (schema instanceof z.$ZodDiscriminatedUnion) {
    const { discriminator, options } = schema._zod.def;
    const option = options[0] as z.$ZodObject;
    const literal = (option._zod.def.shape[discriminator] as z.$ZodType)._zod
      .def as { values?: unknown[] };
    return { ...getDefaultValues(option), [discriminator]: literal.values?.[0] };
  }

  if (schema instanceof z.$ZodObject) {
    return getDefaultValues(schema);
  }

  if ("innerType" in schema._zod.def) {
    return getDefaultValueInZodStack(schema._zod.def.innerType as z.$ZodType);
  }

  return undefined;
}

export function getDefaultValues(schema: z.$ZodObject): Record<string, any> {
  const shape = schema._zod.def.shape;

  const defaultValues: Record<string, any> = {};

  for (const [key, field] of Object.entries(shape)) {
    const defaultValue = getDefaultValueInZodStack(field as z.$ZodType);
    if (defaultValue !== undefined) {
      defaultValues[key] = defaultValue;
    }
  }

  return defaultValues;
}
