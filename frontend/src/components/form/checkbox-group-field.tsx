"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type CheckboxChoice = { value: string; label: string };

type CheckboxGroupFieldProps = {
  legend: string;
  choices: CheckboxChoice[];
  value: string[];
  onChange: (value: string[]) => void;
  hint?: string;
};

export function CheckboxGroupField({
  legend,
  choices,
  value,
  onChange,
  hint,
}: CheckboxGroupFieldProps) {
  function toggle(choice: string, checked: boolean) {
    onChange(checked ? [...value, choice] : value.filter((v) => v !== choice));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      <div className="grid gap-1 sm:grid-cols-2">
        {choices.map((choice) => (
          <Label
            key={choice.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 font-normal hover:bg-accent/50"
          >
            <Checkbox
              checked={value.includes(choice.value)}
              onCheckedChange={(checked) => toggle(choice.value, checked === true)}
            />
            {choice.label}
          </Label>
        ))}
      </div>
    </fieldset>
  );
}
