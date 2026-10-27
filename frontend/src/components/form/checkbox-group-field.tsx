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

/**
 * A set of tick boxes drawn as round pills, so several can be on at once.
 * A pill fills in with the app colour while its box is ticked.
 */
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

      <div className="flex flex-wrap gap-2 pt-1">
        {choices.map((choice) => (
          <Label
            key={choice.value}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 font-normal transition-colors hover:border-primary/40 hover:bg-primary/5 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-checked:font-medium has-data-checked:text-primary"
          >
            <Checkbox
              checked={value.includes(choice.value)}
              onCheckedChange={(checked) => toggle(choice.value, checked === true)}
              className="size-4 rounded-full"
            />
            {choice.label}
          </Label>
        ))}
      </div>
    </fieldset>
  );
}
