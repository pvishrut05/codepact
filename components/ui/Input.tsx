import React, { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, secureTextEntry, style, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [secure, setSecure] = useState(secureTextEntry ?? false);

    const borderColor = error ? '#EF4444' : focused ? '#22C55E' : '#334155';

    return (
      <View className="gap-1.5">
        {label && (
          <Text
            className="text-muted text-sm"
            style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
          >
            {label}
          </Text>
        )}

        <View
          className="flex-row items-center bg-surface rounded-xl h-13 px-4"
          style={{ borderWidth: 1.5, borderColor }}
        >
          <TextInput
            ref={ref}
            {...props}
            secureTextEntry={secure}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            placeholderTextColor="#475569"
            className="flex-1 text-foreground text-base"
            style={[{ fontFamily: 'PlusJakartaSans_400Regular', height: 52 }, style]}
          />
          {secureTextEntry && (
            <Pressable
              onPress={() => setSecure((s) => !s)}
              hitSlop={10}
              className="pl-2"
            >
              <Ionicons
                name={secure ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#94A3B8"
              />
            </Pressable>
          )}
        </View>

        {error ? (
          <Text
            className="text-brand-red text-sm"
            style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
          >
            {error}
          </Text>
        ) : hint ? (
          <Text
            className="text-muted text-sm"
            style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';
