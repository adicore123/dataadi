/**
 * Auto-tag suggestions from the item's file name / title / module —
 * Hebrew keyword families that match the way a personal vault fills up.
 * Pure heuristics, no network, no OCR. Self-contained (no imports) so it
 * also runs directly under node:test type-stripping.
 */

type ModuleType = 'documents' | 'photos' | 'recordings';

interface TagRule {
  tag: string;
  keywords: string[];
  modules?: ModuleType[];
}

const RULES: TagRule[] = [
  { tag: 'קבלות', keywords: ['קבלה', 'קבלות', 'חשבונית', 'חשבוניות', 'invoice', 'receipt'] },
  { tag: 'תעודות', keywords: ['דרכון', 'תעודת זהות', 'תעודה', 'רישיון', 'passport', 'license'], modules: ['documents', 'photos'] },
  { tag: 'חוזים', keywords: ['חוזה', 'חוזים', 'שכירות', 'הסכם', 'contract', 'lease'] },
  { tag: 'ביטוח', keywords: ['ביטוח', 'פוליסה', 'insurance', 'policy'] },
  { tag: 'שכר', keywords: ['תלוש', 'תלושים', 'משכורת', 'שכר', 'payslip', 'salary'] },
  { tag: 'בנק', keywords: ['בנק', 'אוצר', 'חשבון בנק', 'bank', 'leumi', 'poalim', 'discount', 'mizrahi', 'hapoalim'] },
  { tag: 'מס', keywords: ['מס הכנסה', 'החזר מס', 'ביטוח לאומי', 'tax'] },
  { tag: 'רפואה', keywords: ['רופא', 'בדיקה', 'מרשם', 'אסותא', 'קופת חולים', 'מכבי', 'כללית', 'medical'] },
  { tag: 'רכב', keywords: ['רכב', 'מכונית', 'טסט', 'רישיון רכב', 'car', 'vehicle'] },
  { tag: 'בית', keywords: ['חשמל', 'מים', 'גז', 'ארנונה', 'ועד בית', 'bill', 'electric'] },
  { tag: 'עבודה', keywords: ['עבודה', 'מעסיק', 'לקוח', 'פרויקט', 'work'] },
  { tag: 'משפחה', keywords: ['משפחה', 'ילדים', 'בת מצווה', 'ברית', 'יום הולדת'] },
];

/** Suggests up to `limit` tags for a new item based on its text. */
export function suggestTags(
  title: string,
  fileName = '',
  module?: ModuleType,
  limit = 2
): string[] {
  const haystack = `${title} ${fileName}`.toLowerCase();
  const out: string[] = [];
  for (const rule of RULES) {
    if (rule.modules && module && !rule.modules.includes(module)) continue;
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      out.push(rule.tag);
      if (out.length >= limit) break;
    }
  }
  return out;
}
