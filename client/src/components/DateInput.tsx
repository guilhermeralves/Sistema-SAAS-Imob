import { Input } from "@/components/ui/input";
import { normalizeDateInput } from "@/lib/date";
import type { ComponentProps } from "react";

type DateInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange" | "maxLength"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function DateInput({
  value,
  onValueChange,
  ...props
}: DateInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      maxLength={10}
      value={value}
      onChange={event => onValueChange(normalizeDateInput(event.target.value))}
    />
  );
}
