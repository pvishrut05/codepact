import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
  View,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: 'bg-brand-green',
    text: 'text-black font-semibold',
  },
  secondary: {
    container: 'bg-surface-2 border border-border',
    text: 'text-foreground font-semibold',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-foreground font-semibold',
  },
  destructive: {
    container: 'bg-brand-red',
    text: 'text-white font-semibold',
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'h-9 px-4 rounded-xl', text: 'text-sm' },
  md: { container: 'h-12 px-5 rounded-xl', text: 'text-base' },
  lg: { container: 'h-14 px-6 rounded-2xl', text: 'text-base' },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { container, text } = variantStyles[variant];
  const { container: sizeContainer, text: sizeText } = sizeStyles[size];

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [{ opacity: pressed || isDisabled ? 0.6 : 1 }]}
      className={`items-center justify-center ${container} ${sizeContainer} ${fullWidth ? 'w-full' : 'self-start'}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#000000' : '#F8FAFC'}
        />
      ) : (
        <Text className={`${text} ${sizeText}`} style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
