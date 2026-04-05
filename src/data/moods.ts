import type { MoodOption, ConstraintOption } from '../types';

export const MOODS: MoodOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Light, fun, low stakes. Something you can half-watch.',
    emoji: '🍿',
  },
  {
    id: 'intense',
    label: 'Intense',
    description: 'Tight, gripping, thriller or dramatic pressure.',
    emoji: '🔥',
  },
  {
    id: 'emotional',
    label: 'Emotional',
    description: "Slow, tender, character-first. You're here to feel.",
    emoji: '💧',
  },
  {
    id: 'weird',
    label: 'Weird',
    description: 'Off-kilter, surreal, a little art-house.',
    emoji: '🌀',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    description: 'Warm, familiar tone. Blanket movie.',
    emoji: '🛋️',
  },
];

export const CONSTRAINTS: ConstraintOption[] = [
  { id: 'short-runtime', label: 'Short runtime', hint: 'Under 100 minutes' },
  { id: 'long-runtime', label: 'Long runtime', hint: 'Over 130 minutes' },
  { id: 'classic', label: 'Classic', hint: 'Before 2000' },
  { id: 'modern', label: 'Modern', hint: '2015 or later' },
  { id: 'no-horror', label: 'No horror' },
  { id: 'no-animation', label: 'No animation' },
  { id: 'no-subtitles', label: 'No subtitles tonight' },
  { id: 'available-tr', label: 'Available tonight in Turkey' },
];
