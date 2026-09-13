export interface Language {
  code: string;
  name: string;
  nativeName: string;
  category?: "PRIMARY" | "TRIBAL_FUTURE" | "EXTENDED";
  disabled?: boolean;
  badge?: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', category: 'PRIMARY' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ (Ol Chiki)', category: 'PRIMARY' },
  { code: 'en', name: 'English', nativeName: 'English', category: 'PRIMARY' },
  { code: 'hoc', name: 'Ho', nativeName: '𑢹𑣉 (Warang Chiti)', category: 'TRIBAL_FUTURE', disabled: true, badge: 'Soon' },
  { code: 'unr', name: 'Mundari', nativeName: 'Mundari Bani', category: 'TRIBAL_FUTURE', disabled: true, badge: 'Soon' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', category: 'EXTENDED' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', category: 'EXTENDED' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', category: 'EXTENDED' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', category: 'EXTENDED' }
];

export interface NipunOutcome {
  id: string;
  grade: number;
  domain: 'Literacy' | 'Numeracy';
  skill: string;
  outcome: string;
}

export const NIPUN_CURRICULUM: NipunOutcome[] = [
  {
    id: 'lit-1-1',
    grade: 1,
    domain: 'Literacy',
    skill: 'Letter Sounds & Phonics',
    outcome: 'Identify initial letter sounds of common spoken words.'
  },
  {
    id: 'lit-1-2',
    grade: 1,
    domain: 'Literacy',
    skill: 'Vocabulary & Picture Naming',
    outcome: 'Name common animals, fruits, trees, and shapes with clear pronunciation.'
  },
  {
    id: 'num-1-1',
    grade: 1,
    domain: 'Numeracy',
    skill: 'Counting Objects (1-20)',
    outcome: 'Count objects up to 20 and compare quantities (more, less, equal).'
  },
  {
    id: 'num-2-1',
    grade: 2,
    domain: 'Numeracy',
    skill: 'Addition & Subtraction',
    outcome: 'Perform 1-digit and 2-digit visual additions using number lines.'
  },
  {
    id: 'num-3-1',
    grade: 3,
    domain: 'Numeracy',
    skill: 'Shapes & Grouping',
    outcome: 'Identify 2D/3D shapes and calculate repeated addition groups.'
  }
];
