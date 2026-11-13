import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors duration-fast ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-surface-2 text-foreground border border-border hover:border-input',
        outline: 'border border-input/70 text-foreground hover:bg-surface-2',
        ghost: 'text-foreground hover:bg-surface-2',
        danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
        link: 'text-brand underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-base',
        lg: 'h-11 px-5 text-md',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, type, ...props }, ref) => {
    if (asChild) {
      // Slot needs exactly one child: no spinner in this mode.
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    const Comp = 'button';
    return (
      <Comp
        ref={ref}
        type={type ?? 'button'}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

type IconButtonProps = Omit<ButtonProps, 'children' | 'size'> & {
  /** Required: what the button does, read by screen readers and shown as tooltip. */
  label: string;
  icon: React.ReactNode;
  size?: 'icon' | 'icon-sm';
};

/** Icon-only button. Always has an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = 'ghost', size = 'icon', ...props }, ref) => (
    <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} {...props}>
      <span aria-hidden className="contents">
        {icon}
      </span>
    </Button>
  )
);
IconButton.displayName = 'IconButton';
