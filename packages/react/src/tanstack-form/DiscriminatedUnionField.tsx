import React, { useEffect } from "react";
import { useStore } from "@tanstack/react-form";
import { getLabel } from "@autoform/core";
import type { ParsedField } from "@autoform/core";
import { useAutoForm } from "../context";
import { AutoFormField } from "./AutoFormField";
import { useFormContext } from "./hooks";
import { formatTanStackPath } from "./utils";

function getByPath(obj: any, segments: string[]): any {
  return segments.reduce((acc, key) => acc?.[key], obj);
}

export const DiscriminatedUnionField: React.FC<{
  parsedField: ParsedField;
  path: string[];
}> = ({ path, parsedField }) => {
  const { uiComponents } = useAutoForm();
  const form = useFormContext() as any;

  const discriminator = parsedField.discriminator!;
  const branches = parsedField.branches!;
  const branchKeys = Object.keys(branches);
  const discriminatorPath = [...path, discriminator];

  const watched = useStore(form.store, (state: any) =>
    getByPath(state.values, discriminatorPath),
  );
  const current =
    watched != null && watched in branches ? watched : branchKeys[0]!;
  const branchFields = branches[current] ?? [];

  // Seed the active branch's field defaults when they are unset, mirroring how
  // array items get their defaults on append. Never overwrites values already
  // provided by the caller or entered by the user.
  useEffect(() => {
    for (const field of branchFields) {
      if (field.default === undefined) continue;
      const fieldName = formatTanStackPath([...path, field.key]);
      if (form.getFieldValue(fieldName) === undefined) {
        form.setFieldValue(fieldName, field.default);
      }
    }
  }, [current]);

  const discriminatorField: ParsedField = {
    key: discriminator,
    type: "select",
    required: true,
    options: parsedField.options,
  };

  const ObjectWrapper =
    parsedField.fieldConfig?.objectWrapper || uiComponents.ObjectWrapper;

  return (
    <ObjectWrapper label={getLabel(parsedField)} parsedField={parsedField}>
      <AutoFormField
        key={`${path.join(".")}.${discriminator}`}
        parsedField={discriminatorField}
        path={discriminatorPath}
      />
      {branchFields.map((subField) => (
        <AutoFormField
          key={`${path.join(".")}.${current}.${subField.key}`}
          parsedField={subField}
          path={[...path, subField.key]}
        />
      ))}
    </ObjectWrapper>
  );
};
