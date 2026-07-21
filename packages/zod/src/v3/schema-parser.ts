import { z } from "zod/v3";
import { inferFieldType } from "./field-type-inference";
import { getDefaultValueInZodStack } from "./default-values";
import { getFieldConfigInZodStack } from "./field-config";
import type { ParsedField, ParsedSchema } from "@autoform/core";
import type { ZodObjectOrWrapped } from "./types";

function parseField(key: string, schema: z.ZodTypeAny): ParsedField {
  const baseSchema = getBaseSchema(schema);
  const fieldConfig = getFieldConfigInZodStack(schema);
  const type = inferFieldType(baseSchema, fieldConfig);
  const defaultValue = getDefaultValueInZodStack(schema);

  // Enums
  const options = baseSchema._def.values;
  let optionValues: [string, string][] = [];
  if (options) {
    if (!Array.isArray(options)) {
      optionValues = Object.entries(options);
    } else {
      optionValues = options.map((value) => [value, value]);
    }
  }

  // Arrays and objects
  let subSchema: ParsedField[] = [];
  if (baseSchema instanceof z.ZodObject) {
    subSchema = Object.entries(baseSchema.shape).map(([key, field]) =>
      parseField(key, field as z.ZodTypeAny),
    );
  }
  if (baseSchema instanceof z.ZodArray) {
    subSchema = [parseField("0", baseSchema._def.type)];
  }

  // Discriminated unions
  let discriminator: string | undefined;
  let branches: Record<string, ParsedField[]> | undefined;
  if (baseSchema instanceof z.ZodDiscriminatedUnion) {
    discriminator = baseSchema._def.discriminator;
    branches = {};
    const branchOptions: [string, string][] = [];
    for (const option of baseSchema._def.options as z.AnyZodObject[]) {
      const shape = option._def.shape();
      const fields = Object.entries(shape)
        .filter(([fieldKey]) => fieldKey !== discriminator)
        .map(([fieldKey, field]) =>
          parseField(fieldKey, field as z.ZodTypeAny),
        );
      for (const value of getDiscriminatorValues(
        shape[discriminator] as z.ZodTypeAny,
      )) {
        branches[value] = fields;
        branchOptions.push([value, value]);
      }
    }
    optionValues = branchOptions;
  }

  return {
    key,
    type,
    required: !schema.isOptional(),
    default: defaultValue,
    description: baseSchema.description,
    fieldConfig,
    options: optionValues,
    schema: subSchema,
    discriminator,
    branches,
  };
}

function getBaseSchema<
  ChildType extends z.ZodAny | z.ZodTypeAny | z.AnyZodObject = z.ZodAny,
>(schema: ChildType | z.ZodEffects<ChildType>): ChildType {
  if ("innerType" in schema._def) {
    return getBaseSchema(schema._def.innerType as ChildType);
  }
  if ("schema" in schema._def) {
    return getBaseSchema(schema._def.schema as ChildType);
  }

  return schema as ChildType;
}

function getDiscriminatorValues(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodLiteral) {
    return [String(schema._def.value)];
  }
  if (schema instanceof z.ZodEnum) {
    return schema._def.values.map(String);
  }
  if (schema instanceof z.ZodNativeEnum) {
    return Object.values(schema._def.values).map(String);
  }
  return [];
}

export function parseSchema(schema: ZodObjectOrWrapped): ParsedSchema {
  const objectSchema =
    schema instanceof z.ZodEffects ? schema.innerType() : schema;
  const shape = objectSchema.shape;

  const fields: ParsedField[] = Object.entries(shape).map(([key, field]) =>
    parseField(key, field as z.ZodTypeAny),
  );

  return { fields };
}
