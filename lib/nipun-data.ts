export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'en', name: 'English', nativeName: 'English' }
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
