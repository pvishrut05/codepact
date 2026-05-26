import React from 'react';
import { Text } from 'react-native';
import { currentAnimal } from '@/lib/animals';

type Props = {
  animalIndex: number;
  animalFill: number;
};

export function AnimalMiniChip({ animalIndex, animalFill }: Props) {
  const animal = currentAnimal(animalIndex);
  return (
    <Text
      style={{ color: '#475569', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 }}
      accessibilityLabel={`${animal.name} ${animalFill} of ${animal.requiredFill}`}
      numberOfLines={1}
    >
      {animal.emoji} {animalFill}/{animal.requiredFill}
    </Text>
  );
}
