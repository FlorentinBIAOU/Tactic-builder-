import * as S from '@radix-ui/react-switch';
import * as C from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Switch(props: S.SwitchProps) {
  return (
    <S.Root
      {...props}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input/70 bg-surface-2 transition-colors',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50',
        props.className
      )}
    >
      <S.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary-foreground" />
    </S.Root>
  );
}

export function Checkbox(props: C.CheckboxProps) {
  return (
    <C.Root
      {...props}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        props.className
      )}
    >
      <C.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}
