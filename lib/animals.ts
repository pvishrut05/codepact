export type Animal = {
  readonly index: number;
  readonly name: string;
  readonly emoji: string;
  readonly requiredFill: number;
};

export type AnimalToastEvent = {
  type: 'fill' | 'unlock';
  animal: Animal;
  fill: number;
  required: number;
  nextAnimal: Animal | null;
};

export const ANIMALS: readonly Animal[] = [
  { index: 0, name: 'Squirrel',  emoji: '🐿',  requiredFill: 5   },
  { index: 1, name: 'Rabbit',    emoji: '🐇',  requiredFill: 10  },
  { index: 2, name: 'Cat',       emoji: '🐈',  requiredFill: 15  },
  { index: 3, name: 'Fox',       emoji: '🦊',  requiredFill: 20  },
  { index: 4, name: 'Owl',       emoji: '🦉',  requiredFill: 25  },
  { index: 5, name: 'Wolf',      emoji: '🐺',  requiredFill: 30  },
  { index: 6, name: 'Bear',      emoji: '🐻',  requiredFill: 40  },
  { index: 7, name: 'Tiger',     emoji: '🐯',  requiredFill: 50  },
  { index: 8, name: 'Elephant',  emoji: '🐘',  requiredFill: 75  },
  { index: 9, name: 'Dragon',    emoji: '🐉',  requiredFill: 100 },
];

export const LAST_ANIMAL_INDEX = 9;

export function currentAnimal(index: number): Animal {
  return ANIMALS[Math.min(Math.max(index, 0), LAST_ANIMAL_INDEX)];
}

export function nextAnimal(index: number): Animal | null {
  return index >= LAST_ANIMAL_INDEX ? null : ANIMALS[index + 1];
}

export function fillRatio(fill: number, required: number): number {
  return required > 0 ? Math.min(fill / required, 1) : 0;
}
