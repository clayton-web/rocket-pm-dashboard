export type Rtb1TextValue = { kind: "text"; value: string };
export type Rtb1CheckboxValue = { kind: "checkbox"; checked: boolean };
export type Rtb1FieldValue = Rtb1TextValue | Rtb1CheckboxValue;

export type Rtb1PdfFieldValues = Record<string, Rtb1FieldValue>;

export function rtb1Text(value: string): Rtb1TextValue {
  return { kind: "text", value };
}

export function rtb1Checkbox(checked: boolean): Rtb1CheckboxValue {
  return { kind: "checkbox", checked };
}
