
export enum LearningProfile {
  ADHD = 'ADHD',
  DYSLEXIA = 'DYSLEXIA',
  AUTISTIC_LOGIC = 'AUTISTIC_LOGIC'
}

export interface ProfileDetails {
  id: LearningProfile;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface ContentSource {
  type: 'text' | 'file' | 'url';
  value: string | File;
  mimeType?: string;
}

export interface AdaptedContent {
  original: string;
  adapted: string;
  profile: LearningProfile;
}
