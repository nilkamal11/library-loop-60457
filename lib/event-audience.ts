export type AudienceDecision = {
  include: boolean;
  ages: string;
  teenOnly: boolean;
  family: boolean;
};

export type AudienceOptions = {
  curatedFamilyGuide?: boolean;
  curatedNatureProgram?: boolean;
  curatedPublicEvent?: boolean;
};

type AgeCandidate = {
  min: number;
  max: number;
  label: string;
  kind: 'age' | 'grade';
};

export function explicitAge(text: string, structuredLabels = '') {
  const candidates: AgeCandidate[] = [];
  for (const bounded of text.matchAll(/\bat least\s+(\d{1,2})(?:\s+years?(?:\s+\d{1,2}\s+months?)?)?\s+but\s+less\s+than\s+(\d{1,2})\b/gi)) {
    const maximum = Math.max(Number(bounded[1]), Number(bounded[2]) - 1);
    candidates.push({ min: Number(bounded[1]), max: maximum, label: `Ages ${bounded[1]}–${maximum}`, kind: 'age' });
  }
  for (const exactYears of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*(?:yrs?|years?)\b/gi)) {
    candidates.push({ min: Number(exactYears[1]), max: Number(exactYears[2]), label: `Ages ${exactYears[1]}–${exactYears[2]}`, kind: 'age' });
  }
  for (const statedYears of text.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*years?\b/gi)) {
    candidates.push({ min: Number(statedYears[1]), max: Number(statedYears[2]), label: `Ages ${statedYears[1]}–${statedYears[2]}`, kind: 'age' });
  }
  for (const exact of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\b/gi)) {
    candidates.push({ min: Number(exact[1]), max: Number(exact[2]), label: `Ages ${exact[1]}–${exact[2]}`, kind: 'age' });
  }
  for (const plus of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)(?=\s|[.,;:)]|$)/gi)) {
    candidates.push({ min: Number(plus[1]), max: 99, label: `Ages ${plus[1]}+`, kind: 'age' });
  }
  // Some feeds publish a bare audience label such as "10 and up". Keep that
  // loose form out of descriptions so prices such as "$12+" cannot become ages.
  for (const plus of structuredLabels.matchAll(/\b(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)(?=\s|[.,;:)]|$)/gi)) {
    candidates.push({ min: Number(plus[1]), max: 99, label: `Ages ${plus[1]}+`, kind: 'age' });
  }
  for (const grade of text.matchAll(/\bgrades?\s*:?\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\s*(?:[-–—]|to|through)\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const gradeNumber = (entry: string) => entry.toLowerCase() === 'k' ? 0 : Number(entry);
    candidates.push({ min: gradeNumber(grade[1]) + 5, max: gradeNumber(grade[2]) + 6, label: `Grades ${grade[1].toUpperCase()}–${grade[2].toUpperCase()}`, kind: 'grade' });
  }
  if (candidates.length) {
    const matching = candidates.filter((candidate) => candidate.min <= 16 && candidate.max >= 7);
    const selected = matching.find((candidate) => candidate.min < 13) ?? matching[0] ?? candidates[0];
    return {
      ...selected,
      includesNine: matching.some((candidate) => candidate.min <= 9 && candidate.max >= 9),
      teenOnly: matching.length > 0 && matching.every((candidate) => candidate.min >= 13),
    };
  }
  const single = text.match(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\b/i);
  if (single) {
    const value = Number(single[1]);
    return { min: value, max: value, label: `Age ${single[1]}`, kind: 'age' as const, includesNine: value === 9, teenOnly: value >= 13 };
  }
  return null;
}

export function deriveAudience(title: string, description: string, labels: string[], options: AudienceOptions = {}): AudienceDecision {
  const text = `${title} ${description} ${labels.join(' ')}`;
  const lower = text.toLowerCase();
  const age = explicitAge(text, labels.join(' '));
  const broadAudienceLabel = labels.some((label) => /^(all|everyone|all ages)$/i.test(label.trim()));
  const family = broadAudienceLabel || /\bfamil(?:y|ies)\b|all ages|all-ages|caregiver|parent(?:s)? and child/.test(lower);
  const familyNamed = broadAudienceLabel || /\bfamil(?:y|ies)\b|caregiver|parent(?:s)? and child/.test(lower);
  const namedAudience = `${title} ${labels.join(' ')}`.toLowerCase();
  const namedTeen = /\bteens?|teenagers?|high school|young adults?\b/.test(namedAudience)
    || namedAudience.includes('diversiteen')
    || namedAudience.includes('volunteen')
    || /\b(?:for teens?|teens? only|high school students?)\b/.test(lower);
  const namedYoungerAudience = /\bchildren|kids?|youth|elementary|school[- ]age\b/.test(namedAudience);
  const teenOnly = age
    ? Boolean(age.teenOnly) || (age.kind === 'grade' && !age.includesNine && namedTeen)
    : namedTeen && !namedYoungerAudience;
  const adultOnly = /\badults? only\b|\b18\s*(?:\+|and (?:up|older))|\b21\s*\+|\bseniors?\b|\b55\s*\+/.test(lower);
  const youngOnly = /\b(?:bab(?:y|ies)|toddlers?|tots?|preschool(?:ers)?|birth\s*(?:-|to|through)\s*5)\b/.test(lower);
  const administrative = /\b(board|committee|commission) meetings?\b|public hearing|bid opening|meeting minutes/.test(lower);
  const teen = /\bteens?|tweens?|middle school|high school|grades?\b/.test(lower);
  const youth = /\bchildren|child(?:ren)?|kids?|youth|school[- ]age|homeschool/.test(lower);
  const adultActivity = /\b(bodypump|cycle|cycling|spin|nia|foam rolling|werq|zumba|pilates|barre|yoga|cardio|aerobics|fitness class|workout|strength training|pickleball|golf league|softball league)\b/.test(lower);
  const adultProgram = /\b(adults?|lapidary|lunch\s*(?:&|and)\s*learn|independent housing|retirement|medicare|matinee|provider training|staff training|certification|forest bathing|forest therapy|restoration workday|volunteer workday)\b/.test(lower);
  const notAnEvent = /\b(?:library|branch|pool|office|village hall|facility|building)\s+(?:is\s+)?closed\b|\bclosed\s+(?:on|for|august|september|october|november|december|january|february|march|april|may|june|july)|delayed opening|holiday hours/.test(lower);
  if (administrative || notAnEvent || (adultOnly && !age) || ((adultActivity || adultProgram) && !age && !teen && !youth && !familyNamed)) {
    return { include: false, ages: '', teenOnly: false, family: false };
  }
  if (age) return { include: age.min <= 16 && age.max >= 7, ages: age.label, teenOnly, family };
  if (teen) return { include: true, ages: labels.find((label) => /teen|tween/i.test(label)) ?? 'Teens / tweens', teenOnly: teenOnly || (!family && !youth && /\bteens?|high school\b/.test(lower)), family };
  if (youngOnly) return { include: false, ages: '', teenOnly: false, family: false };
  if (family) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (youth) return { include: true, ages: labels.find((label) => /child|kid|youth/i.test(label)) ?? 'Kids / youth', teenOnly: false, family };
  if (options.curatedNatureProgram
    && labels.some((label) => /education|family|children|youth/i.test(label))
    && /\b(?:animal|birds?|butterfl(?:y|ies)|wings|wildlife|frogs?|turtles?|insects?|bugs?|owls?|eagles?|monarchs?|pollinators?|story|craft|scavenger|feeding|migration)\b/.test(lower)) {
    return { include: true, ages: 'Family nature program — verify age', teenOnly: false, family: true };
  }
  if (options.curatedFamilyGuide) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (options.curatedPublicEvent) return { include: true, ages: 'Family event — verify age', teenOnly: false, family: true };
  return { include: false, ages: '', teenOnly: false, family: false };
}
