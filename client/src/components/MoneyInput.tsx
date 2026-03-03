import { Input } from "@/components/ui/input";
import { formatMoneyFromCentsInput, normalizeMoneyCentsInput } from "@/lib/money";
import type { ClipboardEvent, ComponentProps, KeyboardEvent } from "react";

type MoneyInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function MoneyInput({
  value,
  onValueChange,
  ...props
}: MoneyInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event);

    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      onValueChange(normalizeMoneyCentsInput(`${value}${event.key}`));
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      onValueChange(value.slice(0, -1));
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      onValueChange("");
      return;
    }

    const allowedKeys = ["Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    props.onPaste?.(event);
    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    onValueChange(normalizeMoneyCentsInput(event.clipboardData.getData("text")));
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatMoneyFromCentsInput(value)}
      onChange={() => undefined}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
}
