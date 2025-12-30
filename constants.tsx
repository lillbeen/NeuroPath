
import { LearningProfile, ProfileDetails } from './types';

export const PROFILES: ProfileDetails[] = [
  {
    id: LearningProfile.ADHD,
    name: 'ADHD Focus',
    icon: 'fa-bolt-lightning',
    description: 'Concise summaries, bold key terms, and bulleted lists to maintain engagement.',
    color: 'bg-amber-500',
  },
  {
    id: LearningProfile.DYSLEXIA,
    name: 'Dyslexia Friendly',
    icon: 'fa-eye',
    description: 'High contrast, clean layouts, and simplified sentence structures for readability.',
    color: 'bg-indigo-600',
  },
  {
    id: LearningProfile.AUTISTIC_LOGIC,
    name: 'Logic & Steps',
    icon: 'fa-microchip',
    description: 'Sequential step-by-step breakdowns, objective language, and clear context.',
    color: 'bg-emerald-600',
  },
];
