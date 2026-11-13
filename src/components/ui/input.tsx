import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded border border-input/70 bg-background px-3 text-base text-foreground placeholder:text-muted/80 ' +
  'transition-colors duration-fast hover:border-input focus-visible:border-ring focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, 'h-9', className)} {...props} />
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(control, 'min-h-24 py-2 leading-relaxed', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

/** Native select styled like the other controls (fine for short lists). */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(control, 'h-9 pr-8', className)} {...props} />
  )
);
NativeSelect.displayName = 'NativeSelect';
