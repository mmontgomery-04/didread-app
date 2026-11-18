// Checks every exercise, prompt and Word of the Day word in every JSON file in docs/content/
// against docs/SPEC.md section 5.
// Run it with:  npm run check-content
// Prints one plain-English line per problem. Exits with an error code if anything is wrong.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { joinParagraphs } from '../src/content/sentences.ts';
import { countWords, scoreOpenText } from '../src/engine/scoring.ts';
import { countStoryWords, ownWordsScore, STORY_WORDS } from '../supabase/functions/_shared/storyWords.ts';

const CONTENT_DIR = join(import.meta.dirname, '..', 'docs', 'content');

const SKILLS = ['comprehension', 'inference', 'reasoning', 'articulation'];
const BANDS = ['foundation', 'developing', 'advanced', 'deep'];
const RESPONSE_TYPES = ['open_text', 'multiple_choice', 'tap_sentence', 'order', 'six_word_story', 'bad_summary', 'word_sprint'];
/** Fields that belong to each response type. Every other type must leave them null. */
const TYPE_FIELDS: Record<string, string[]> = {
  open_text: ['rubric', 'anchors'],
  six_word_story: ['rubric', 'anchors'],
  multiple_choice: ['options', 'correct_option_id', 'mc_feedback'],
  tap_sentence: ['sentences', 'correct_sentence_index', 'feedback'],
  order: ['order_items', 'order_instruction', 'feedback'],
  bad_summary: ['summaries', 'wrong_summary_id', 'error_type', 'feedback'],
  word_sprint: ['rounds', 'feedback'],
};
const TYPE_NAMES: Record<string, string> = {
  open_text: 'open text',
  multiple_choice: 'multiple choice',
  tap_sentence: 'tap the sentence',
  order: 'put it in order',
  six_word_story: 'six-word story',
  bad_summary: 'Bad Summary',
  word_sprint: 'Word Sprint',
};
const STATUSES = ['draft', 'fact_checked', 'calibrated', 'approved', 'retired'];
const WORD_RANGES: Record<string, [number, number]> = {
  foundation: [120, 220],
  developing: [220, 380],
  advanced: [380, 650],
  deep: [650, 1000],
};
const CRITERION_IDS = ['c1', 'c2', 'c3'];
/** Starter reads (batch 13): foundation only, one paragraph, 60-120 words, one per skill with these types. */
const STARTER_RANGE: [number, number] = [60, 120];
const STARTER_TYPES: Record<string, string> = {
  comprehension: 'multiple_choice',
  inference: 'tap_sentence',
  reasoning: 'order',
  articulation: 'open_text',
};
const BAD_SUMMARY_ERRORS = ['flipped_cause', 'changed_number', 'changed_quantity', 'dropped_not', 'contradicted_detail'];
const SPRINT_ROUNDS = 5;
/** Word of the Day's choice (batch 16): the right meaning plus this many wrong ones. */
const WORD_WRONG_MEANINGS = 2;
const SPRINT_OPTIONS = 4;
const MC_OPTION_COUNT = 4;
const ORDER_ITEMS_MIN = 3;
const ORDER_ITEMS_MAX = 5;
/** Six-word stories: c2 and c3 are word for word the same in every one (SPEC section 5). */
const STORY_STANDARD_CRITERIA: Record<string, Json> = {
  c2: {
    text: 'Shows rather than tells',
    required: false,
    level_0: 'No situation at all: only a string of nouns, a label or an instruction (for example, a list of objects from the passage, or a cooking tip). Any sentence that says something happened scores at least 1.',
    level_1: 'States what happened in plain words, as a flat summary (even one with concrete details, such as \'Library book returned forty years late.\'), or names a feeling or quality outright (such as lonely, sad, grief, kind, secret, surprised, sorry, love, proud).',
    level_2: 'Leaves something for the reader to work out: concrete details set side by side, a contrast or a twist carry the meaning, and no word names a feeling or quality outright (for example, \'Her birds. His robin. Fine forgiven.\').',
  },
  c3: {
    text: 'Uses its own words',
    required: false,
    level_0: 'Copies a run of four or more words in a row from the passage',
    level_1: 'Copies a run of exactly three words in a row from the passage',
    level_2: 'Never uses more than two words in a row from the passage (single words and names are fine)',
  },
};

type Json = Record<string, unknown>;

const problems: string[] = [];
const firstFileForId = new Map<string, string>();
let exerciseCount = 0;
/** Approved starters by skill: never two in one skill. */
const approvedStartersBySkill = new Map<string, string[]>();
/** The test-panel samples (never approved, never served). */
const SAMPLES_FILE = 'exercises-samples.json';
/** Every Word Sprint answer (lowercase, any status, test samples aside): Word of the Day words must be different. */
const sprintAnswers = new Map<string, string>();
/** Word of the Day words already seen (lowercase word -> id), and their sequences. */
const wordsSeen = new Map<string, string>();
const wordSequences = new Map<number, string>();
const wordEntries: { id: string; word: string }[] = [];
/** Six-word stories by skill and band, for the "never two in a row" sequencing rule. */
/** Story series: every chapter seen, by series id. */
const chaptersBySeries = new Map<string, { id: string; chapter: number; band: string; title: string }[]>();
const sequencesByGroup = new Map<string, { id: string; sequence: number; story: boolean }[]>();

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isWholeNumber = (v: unknown): v is number => Number.isInteger(v);
const list = (values: string[]) => values.join(', ');

function checkExercise(file: string, e: unknown, index: number) {
  if (!isObject(e)) {
    problems.push(`${file}, exercise #${index + 1}: isn't an object with fields.`);
    return;
  }
  const name = isText(e.id) ? e.id : `exercise #${index + 1}`;
  const problem = (message: string) => problems.push(`${file} › ${name}: ${message}`);

  // Id: present, right format, used only once across all files.
  if (!isText(e.id)) {
    problem('is missing its id.');
  } else {
    if (!/^[a-z]+-[a-z]+-[0-9]{3}$/.test(e.id)) {
      problem(`the id "${e.id}" should look like skill-band-### (for example inf-f-001).`);
    }
    const earlier = firstFileForId.get(e.id);
    if (earlier) problem(`the id "${e.id}" is already used in ${earlier}. Ids must never repeat.`);
    else firstFileForId.set(e.id, file);
  }

  // Plain text fields.
  const sprint = e.response_type === 'word_sprint';
  for (const field of sprint ? ['title', 'topic', 'question'] : ['title', 'topic', 'passage', 'question']) {
    if (!isText(e[field])) problem(`${field} is missing or empty.`);
  }
  if (sprint && e.passage !== '') problem('Word Sprint has no passage: set passage to "" (and word_count to 0).');
  if (e.editorial_notes != null && typeof e.editorial_notes !== 'string') {
    problem('editorial_notes must be text (or null).');
  }

  // Fields with a fixed list of allowed values.
  const choices: [string, string[]][] = [
    ['skill', SKILLS],
    ['band', BANDS],
    ['response_type', RESPONSE_TYPES],
    ['status', STATUSES],
  ];
  for (const [field, allowed] of choices) {
    if (!allowed.includes(e[field] as string)) {
      problem(`${field} is "${String(e[field] ?? '')}", but it must be one of: ${list(allowed)}.`);
    }
  }

  // Whole numbers.
  if (!isWholeNumber(e.sequence)) problem('sequence must be a whole number.');
  if (!isWholeNumber(e.version) || e.version < 1) problem('version must be a whole number, 1 or more.');

  // Word count: matches the passage, and fits the band's range.
  if (sprint) {
    if (e.word_count !== 0) problem(`word_count says ${String(e.word_count ?? 'nothing')}, but Word Sprint has no passage, so it must be 0.`);
  } else if (isText(e.passage)) {
    const actual = countWords(e.passage);
    if (e.word_count !== actual) {
      problem(`word_count says ${String(e.word_count ?? 'nothing')}, but the passage has ${actual} words.`);
    }
    const range = e.starter === true ? STARTER_RANGE : WORD_RANGES[e.band as string];
    const what = e.starter === true ? 'starter' : String(e.band);
    if (range && (actual < range[0] || actual > range[1])) {
      problem(`the passage is ${actual} words, but ${what} passages must be ${range[0]} to ${range[1]} words.`);
    }
  }

  const type = e.response_type as string;
  if (TYPE_FIELDS[type]) {
    const otherFields = new Set(Object.values(TYPE_FIELDS).flat().filter((f) => !TYPE_FIELDS[type].includes(f)));
    for (const field of otherFields) {
      if (e[field] != null) problem(`${TYPE_NAMES[type]} exercises must have ${field} set to null.`);
    }
  }
  if (e.response_type === 'multiple_choice') checkMultipleChoice(e, problem);
  if (e.response_type === 'tap_sentence') checkTapSentence(e, problem);
  if (e.response_type === 'order') checkOrder(e, problem);
  if (e.response_type === 'open_text' || e.response_type === 'six_word_story') checkOpenText(e, problem);
  if (e.response_type === 'six_word_story') checkSixWordStory(e, problem);
  if (e.response_type === 'bad_summary') checkBadSummary(e, problem);
  if (e.response_type === 'word_sprint') checkWordSprint(e, problem, file);
  if (e.starter != null && typeof e.starter !== 'boolean') problem('starter must be true or false (or left out).');
  if (e.starter === true) checkStarter(e, problem);
  checkSeriesFields(e, problem);
  if (isText(e.id) && isWholeNumber(e.sequence) && e.status !== 'retired') {
    const group = `${String(e.skill)} ${String(e.band)}`;
    const entries = sequencesByGroup.get(group) ?? [];
    entries.push({ id: e.id, sequence: e.sequence, story: e.response_type === 'six_word_story' });
    sequencesByGroup.set(group, entries);
  }
}

/**
 * Story series (SPEC section 5, "Story series"): series_id, series_title and chapter go together;
 * chapter 1 has no `previously`, and every later chapter has one (no blank line). A chapter needs a
 * passage (never Word Sprint) and is never a starter. The recap isn't part of the passage, so it
 * never counts toward the word count. Whole-series rules are in checkSeries().
 */
function checkSeriesFields(e: Json, problem: (message: string) => void) {
  const fields = ['series_id', 'series_title', 'chapter', 'previously'];
  const present = fields.filter((f) => e[f] != null);
  if (present.length === 0) return;
  const core = ['series_id', 'series_title', 'chapter'];
  const missing = core.filter((f) => e[f] == null);
  if (missing.length > 0) {
    problem(`has ${list(present)} but not ${list(missing)}: a chapter needs series_id, series_title and chapter.`);
    return;
  }
  if (!isText(e.series_id) || !/^series-[0-9]{3}$/.test(e.series_id)) {
    problem(`series_id "${String(e.series_id)}" should look like series-### (for example series-001).`);
  }
  if (!isText(e.series_title)) problem('series_title must be text.');
  else if (/[\r\n]/.test(e.series_title)) problem('series_title must be one line.');
  if (!isWholeNumber(e.chapter) || e.chapter < 1) {
    problem('chapter must be a whole number, 1 or more.');
    return;
  }
  if (e.chapter === 1 && e.previously != null) problem('chapter 1 has no "previously" recap: set it to null.');
  if (e.chapter > 1) {
    if (!isText(e.previously)) problem(`chapter ${e.chapter} needs a "previously" recap of the story so far.`);
    else if (/\n\s*\n/.test(e.previously)) problem('the "previously" recap must not have a blank line.');
  }
  if (e.response_type === 'word_sprint') problem('a chapter needs a passage, so it can\'t be a Word Sprint.');
  if (e.starter === true) problem('a starter read can\'t be a chapter.');
  if (isText(e.id) && isText(e.series_id)) {
    const chapters = chaptersBySeries.get(e.series_id) ?? [];
    chapters.push({ id: e.id, chapter: e.chapter, band: String(e.band), title: String(e.series_title) });
    chaptersBySeries.set(e.series_id, chapters);
  }
}

/** Each series: chapters numbered 1, 2, 3… with no gaps or repeats, one band, one title. */
function checkSeries() {
  for (const [seriesId, chapters] of chaptersBySeries) {
    const numbers = chapters.map((c) => c.chapter).sort((a, b) => a - b);
    const expected = numbers.map((_, i) => i + 1);
    if (numbers.join(',') !== expected.join(',')) {
      problems.push(`${seriesId}: chapters are numbered ${numbers.join(', ')}, but they must be 1 to ${numbers.length} with no gaps or repeats.`);
    }
    const bands = [...new Set(chapters.map((c) => c.band))];
    if (bands.length > 1) problems.push(`${seriesId}: every chapter must be the same band (found ${list(bands)}).`);
    const titles = [...new Set(chapters.map((c) => c.title))];
    if (titles.length > 1) problems.push(`${seriesId}: every chapter must have the same series_title (found ${list(titles.map((t) => `"${t}"`))}).`);
  }
}

/** Starter reads (SPEC section 5, batch 13). */
function checkStarter(e: Json, problem: (message: string) => void) {
  if (e.band !== 'foundation') problem(`starter reads must be foundation, not ${String(e.band)}.`);
  if (typeof e.passage === 'string' && /\n\s*\n/.test(e.passage)) problem('a starter read is one paragraph: remove the blank line.');
  const wanted = STARTER_TYPES[e.skill as string];
  if (wanted && e.response_type !== wanted) {
    problem(`the ${String(e.skill)} starter must be ${TYPE_NAMES[wanted]}, not ${TYPE_NAMES[e.response_type as string] ?? String(e.response_type)}.`);
  }
  if (e.status === 'approved' && isText(e.id)) {
    const ids = approvedStartersBySkill.get(e.skill as string) ?? [];
    ids.push(e.id);
    approvedStartersBySkill.set(e.skill as string, ids);
  }
}

/** Bad Summary (SPEC section 5, batch 13). */
function checkBadSummary(e: Json, problem: (message: string) => void) {
  if (!['comprehension', 'reasoning'].includes(e.skill as string)) {
    problem(`Bad Summary exercises are comprehension or reasoning, not ${String(e.skill)}.`);
  }
  const summaries = e.summaries;
  const ids: string[] = [];
  if (!Array.isArray(summaries) || summaries.length !== 3) {
    problem('summaries must be a list of exactly 3, each with an id and text.');
  } else {
    const lengths: number[] = [];
    summaries.forEach((item, i) => {
      if (!isObject(item) || !isText(item.id) || !isText(item.text)) {
        problem(`summary #${i + 1} needs both an id and text.`);
        return;
      }
      if (ids.includes(item.id)) problem(`two summaries share the id "${item.id}".`);
      ids.push(item.id);
      if (/[\r\n]/.test(item.text)) problem(`summary "${item.id}" must be one line.`);
      const words = countWords(item.text);
      lengths.push(words);
      if (words < 6 || words > 25) problem(`summary "${item.id}" is ${words} words, but each must be 6 to 25.`);
    });
    if (lengths.length === 3 && Math.max(...lengths) > 1.5 * Math.min(...lengths)) {
      problem(`the summaries are ${lengths.join(', ')} words: the longest may be at most 1.5 times the shortest.`);
    }
  }
  if (!isText(e.wrong_summary_id)) problem('wrong_summary_id is missing.');
  else if (ids.length > 0 && !ids.includes(e.wrong_summary_id)) {
    problem(`wrong_summary_id is "${e.wrong_summary_id}", but the summary ids are: ${list(ids)}.`);
  }
  if (!BAD_SUMMARY_ERRORS.includes(e.error_type as string)) {
    problem(`error_type is "${String(e.error_type ?? '')}", but it must be one of: ${list(BAD_SUMMARY_ERRORS)}.`);
  }
  checkCorrectIncorrectFeedback(e, problem);
}

/** Word Sprint (SPEC section 5, batch 13). */
function checkWordSprint(e: Json, problem: (message: string) => void, file: string) {
  if (e.skill !== 'comprehension') problem(`Word Sprint exercises are comprehension, not ${String(e.skill)}.`);
  checkCorrectIncorrectFeedback(e, problem);
  const rounds = e.rounds;
  if (!Array.isArray(rounds) || rounds.length !== SPRINT_ROUNDS) {
    problem(`rounds must be a list of exactly ${SPRINT_ROUNDS}, each with a definition, options and answer.`);
    return;
  }
  const answers: string[] = [];
  rounds.forEach((r, i) => {
    const where = `round ${i + 1}`;
    if (!isObject(r) || !isText(r.definition) || !isText(r.answer) || !Array.isArray(r.options) || !isText(r.example)) {
      problem(`${where} needs a definition, a list of options, an answer and an example sentence.`);
      return;
    }
    if (/[\r\n]/.test(r.definition)) problem(`${where}: the definition must be one line.`);
    if (/[\r\n]/.test(r.example)) problem(`${where}: the example must be one sentence on one line.`);
    const options = r.options as unknown[];
    if (options.length !== SPRINT_OPTIONS || !options.every(isText)) {
      problem(`${where} needs exactly ${SPRINT_OPTIONS} options, each a word.`);
      return;
    }
    const lower = (options as string[]).map((o) => o.toLowerCase());
    if (new Set(lower).size !== options.length) problem(`${where}: the 4 options must all be different.`);
    const answer = r.answer.toLowerCase();
    if (!lower.includes(answer)) problem(`${where}: the answer "${r.answer}" isn't one of its options.`);
    if (answers.includes(answer)) problem(`${where}: "${r.answer}" is already the answer to another round.`);
    answers.push(answer);
    // Test samples never reach real users, so their answers may also be Word of the Day words.
    if (file !== SAMPLES_FILE && isText(e.id) && !sprintAnswers.has(answer)) sprintAnswers.set(answer, e.id);
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(r.example.toLowerCase())) {
      problem(`${where}: the answer "${r.answer}" doesn't appear in its example sentence as written.`);
    }
    if (r.definition.toLowerCase().includes(answer)) problem(`${where}: the definition contains the answer "${r.answer}".`);
  });
}

/** True when `word` appears in `text` as a whole word, any case (the same rule as Word Sprint's examples). */
function hasWholeWord(text: string, word: string): boolean {
  const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(text.toLowerCase());
}

/** Word of the Day words (SPEC section 5, batch 15). */
function checkWord(file: string, w: unknown, index: number) {
  if (!isObject(w)) {
    problems.push(`${file}, word #${index + 1}: isn't an object with fields.`);
    return;
  }
  const name = isText(w.id) ? w.id : `word #${index + 1}`;
  const problem = (message: string) => problems.push(`${file} › ${name}: ${message}`);
  if (!isText(w.id)) problem('is missing its id.');
  else {
    if (!/^word-[0-9]{3}$/.test(w.id)) problem(`the id "${w.id}" should look like word-### (for example word-001).`);
    const earlier = firstFileForId.get(w.id);
    if (earlier) problem(`the id "${w.id}" is already used in ${earlier}. Ids must never repeat.`);
    else firstFileForId.set(w.id, file);
  }
  for (const field of ['word', 'part_of_speech', 'meaning', 'example']) {
    if (!isText(w[field])) problem(`${field} is missing or empty.`);
    else if (/[\r\n]/.test(w[field] as string)) problem(`${field} must be one line.`);
  }
  if (!STATUSES.includes(w.status as string)) {
    problem(`status is "${String(w.status ?? '')}", but it must be one of: ${list(STATUSES)}.`);
  }
  if (w.editorial_notes != null && typeof w.editorial_notes !== 'string') problem('editorial_notes must be text (or null).');
  if (!isWholeNumber(w.sequence)) problem('sequence must be a whole number.');
  else {
    const other = wordSequences.get(w.sequence);
    if (other) problem(`sequence ${w.sequence} is already used by ${other}. Each word needs its own.`);
    else if (isText(w.id)) wordSequences.set(w.sequence, w.id);
  }
  if (!isText(w.word)) return;
  const word = w.word.trim();
  const earlierWord = wordsSeen.get(word.toLowerCase());
  if (earlierWord) problem(`"${word}" is already the word in ${earlierWord}.`);
  else if (isText(w.id)) wordsSeen.set(word.toLowerCase(), w.id);
  if (isText(w.meaning) && hasWholeWord(w.meaning, word)) problem(`the meaning contains the word "${word}".`);
  if (isText(w.example) && !hasWholeWord(w.example, word)) {
    problem(`the word "${word}" doesn't appear in its example sentence as written.`);
  }
  if (isText(w.id)) wordEntries.push({ id: w.id, word: word.toLowerCase() });
  checkWordQuiz(w, word, problem);
}

/**
 * Batch 16: a word's choice (2 wrong meanings, a right line and a wrong line), all or none. Without
 * them the app shows the "Show me" card.
 */
function checkWordQuiz(w: Json, word: string, problem: (message: string) => void) {
  const fields = ['wrong_meanings', 'right_message', 'wrong_message'];
  const present = fields.filter((f) => w[f] != null);
  if (present.length === 0) return;
  if (present.length < fields.length) {
    problem(`has ${list(present)} but not ${list(fields.filter((f) => !present.includes(f)))}: the choice needs all three, or none.`);
  }
  for (const field of ['right_message', 'wrong_message']) {
    if (w[field] == null) continue;
    if (!isText(w[field])) problem(`${field} must be text.`);
    else if (/[\r\n]/.test(w[field] as string)) problem(`${field} must be one line.`);
  }
  const wrong = w.wrong_meanings;
  if (wrong == null) return;
  if (!Array.isArray(wrong) || wrong.length !== WORD_WRONG_MEANINGS || !wrong.every(isText)) {
    problem(`wrong_meanings must be a list of exactly ${WORD_WRONG_MEANINGS} meanings.`);
    return;
  }
  const all = [w.meaning, ...wrong].map((m) => String(m).trim().toLowerCase());
  if (new Set(all).size !== all.length) problem('the meaning and the 2 wrong meanings must all be different.');
  wrong.forEach((m, i) => {
    if (/[\r\n]/.test(m)) problem(`wrong meaning ${i + 1} must be one line.`);
    if (hasWholeWord(m, word)) problem(`wrong meaning ${i + 1} contains the word "${word}".`);
  });
}

/** Word of the Day words are never also Word Sprint answers. */
function checkWordsAgainstSprints() {
  for (const { id, word } of wordEntries) {
    const sprint = sprintAnswers.get(word);
    if (sprint) problems.push(`${id}: "${word}" is already a Word Sprint answer in ${sprint}. Pick a different word.`);
  }
}

/** Never two approved starters in one skill. */
function checkStarterCounts() {
  for (const [skill, ids] of approvedStartersBySkill) {
    if (ids.length > 1) problems.push(`${list(ids)}: there are ${ids.length} approved ${skill} starters, but there may be only one.`);
  }
}

/** Six-word stories (SPEC section 5): on top of the open-text rules. */
function checkSixWordStory(e: Json, problem: (message: string) => void) {
  if (e.skill !== 'articulation') problem(`six-word stories must be articulation, not ${String(e.skill)}.`);
  if (e.band === 'foundation') problem('six-word stories are for developing, advanced and deep, not foundation.');
  if (Array.isArray(e.rubric)) {
    const byId = new Map(e.rubric.filter(isObject).map((c) => [c.id as string, c]));
    if (byId.get('c1')?.required !== true) problem('in a six-word story, c1 must be the required criterion.');
    for (const [id, standard] of Object.entries(STORY_STANDARD_CRITERIA)) {
      const c = byId.get(id);
      const differs = Object.keys(standard).filter((field) => !c || c[field] !== standard[field]);
      if (differs.length > 0) {
        problem(`${id} must use the standard six-word story wording (differs in: ${list(differs)}). See scripts/check-content.ts.`);
      }
    }
  }
  if (Array.isArray(e.anchors) && typeof e.passage === 'string') {
    for (const a of e.anchors) {
      if (!isObject(a) || !isText(a.text)) continue;
      const label = isText(a.label) ? `anchor "${a.label}"` : 'an anchor';
      const words = countStoryWords(a.text);
      if (words !== STORY_WORDS) problem(`${label} is ${words} words, but six-word story anchors must be exactly ${STORY_WORDS}.`);
      const expected = isObject(a.expected_scores) ? a.expected_scores.c3 : undefined;
      const actual = ownWordsScore(a.text, e.passage);
      if (expected !== actual) {
        problem(`${label} expects c3 ${String(expected)}, but its longest run of words copied from the passage gives c3 ${actual}.`);
      }
    }
  }
}

/** Within each skill and band, no two six-word stories sit next to each other in sequence. */
function checkStorySequencing() {
  for (const [group, entries] of sequencesByGroup) {
    const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].story && ordered[i - 1].story) {
        problems.push(
          `${ordered[i - 1].id} and ${ordered[i].id} (${group}): two six-word stories sit next to each other in sequence ` +
            `(${ordered[i - 1].sequence}, ${ordered[i].sequence}). Put a different exercise between them.`,
        );
      }
    }
  }
}

function checkMultipleChoice(e: Json, problem: (message: string) => void) {
  if (!Array.isArray(e.options)) {
    problem('options is missing. Multiple choice needs a list of options, each with an id and text.');
    return;
  }
  if (e.options.length !== MC_OPTION_COUNT) {
    problem(`has ${e.options.length} options, but multiple choice needs exactly ${MC_OPTION_COUNT}.`);
  }
  const ids: string[] = [];
  e.options.forEach((option, i) => {
    if (!isObject(option) || !isText(option.id) || !isText(option.text)) {
      problem(`option #${i + 1} needs both an id and text.`);
    } else {
      if (ids.includes(option.id)) problem(`two options share the id "${option.id}".`);
      ids.push(option.id);
    }
  });

  if (!isText(e.correct_option_id)) {
    problem('correct_option_id is missing.');
  } else if (!ids.includes(e.correct_option_id)) {
    problem(`correct_option_id is "${e.correct_option_id}", but the option ids are: ${list(ids)}.`);
  }

  const feedback = e.mc_feedback;
  if (!isObject(feedback)) {
    problem('mc_feedback is missing. It needs "correct" and "incorrect_by_option".');
    return;
  }
  if (!isText(feedback.correct)) problem('mc_feedback is missing its "correct" text.');
  const byOption = feedback.incorrect_by_option;
  if (!isObject(byOption)) {
    problem('mc_feedback is missing "incorrect_by_option".');
    return;
  }
  for (const id of ids) {
    if (id !== e.correct_option_id && !isText(byOption[id])) {
      problem(`mc_feedback has no feedback for wrong option "${id}".`);
    }
  }
  for (const id of Object.keys(byOption)) {
    if (!ids.includes(id)) problem(`mc_feedback has feedback for "${id}", which isn't an option.`);
    if (id === e.correct_option_id) problem(`mc_feedback has "wrong answer" feedback for the correct option "${id}".`);
  }
}

/** tap_sentence, order, Bad Summary and Word Sprint: feedback is {correct, incorrect}. */
function checkCorrectIncorrectFeedback(e: Json, problem: (message: string) => void) {
  const feedback = e.feedback;
  if (!isObject(feedback)) {
    problem('feedback is missing. It needs "correct" and "incorrect" text.');
    return;
  }
  if (!isText(feedback.correct)) problem('feedback is missing its "correct" text.');
  if (!isText(feedback.incorrect)) problem('feedback is missing its "incorrect" text.');
}

function checkTapSentence(e: Json, problem: (message: string) => void) {
  const paragraphs = e.sentences;
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    problem('sentences is missing. Tap the sentence needs a list of paragraphs, each a list of sentences.');
    checkCorrectIncorrectFeedback(e, problem);
    return;
  }
  if (paragraphs.every((p) => !Array.isArray(p))) {
    problem(
      'sentences must be a list of paragraphs, each a list of sentences, for example ' +
        '[["First sentence.", "Second sentence."], ["A new paragraph."]].',
    );
    checkCorrectIncorrectFeedback(e, problem);
    return;
  }
  let shapeOk = true;
  let total = 0;
  paragraphs.forEach((paragraph, p) => {
    if (!Array.isArray(paragraph) || paragraph.length === 0) {
      problem(`paragraph #${p + 1} in sentences must be a list of sentences (in square brackets).`);
      shapeOk = false;
      return;
    }
    paragraph.forEach((sentence, i) => {
      total += 1;
      const where = `sentence #${total} (paragraph ${p + 1}, sentence ${i + 1})`;
      if (!isText(sentence)) {
        problem(`${where} is empty or isn't text.`);
        shapeOk = false;
      } else if (sentence !== sentence.trim()) {
        problem(`${where} starts or ends with a space or line break.`);
      }
    });
  });
  if (shapeOk && total < 2) problem('tap the sentence needs at least 2 sentences to choose from.');

  if (shapeOk && typeof e.passage === 'string') {
    const joined = joinParagraphs(paragraphs as string[][]);
    if (joined !== e.passage) {
      let at = 0;
      while (at < joined.length && joined[at] === e.passage[at]) at++;
      const near = (text: string) => JSON.stringify(text.slice(Math.max(0, at - 20), at + 20));
      problem(
        'the sentences must rebuild the passage exactly (single spaces between sentences, a blank line between ' +
          `paragraphs). They first differ at character ${at + 1}: passage ${near(e.passage)}, sentences ${near(joined)}.`,
      );
    }
  }
  if (shapeOk && (!isWholeNumber(e.correct_sentence_index) || e.correct_sentence_index < 0 || e.correct_sentence_index >= total)) {
    problem(
      `correct_sentence_index must be a whole number from 0 to ${total - 1}, counting sentences across the whole ` +
        'passage (the first sentence is 0).',
    );
  }
  checkCorrectIncorrectFeedback(e, problem);
}

function checkOrder(e: Json, problem: (message: string) => void) {
  const items = e.order_items;
  if (!Array.isArray(items)) {
    problem('order_items is missing. Put it in order needs 3 to 5 items, each with an id and text, in the correct order.');
  } else {
    if (items.length < ORDER_ITEMS_MIN || items.length > ORDER_ITEMS_MAX) {
      problem(`has ${items.length} order_items, but it needs ${ORDER_ITEMS_MIN} to ${ORDER_ITEMS_MAX}.`);
    }
    const ids: string[] = [];
    items.forEach((item, i) => {
      if (!isObject(item) || !isText(item.id) || !isText(item.text)) {
        problem(`order item #${i + 1} needs both an id and text.`);
      } else {
        if (ids.includes(item.id)) problem(`two order items share the id "${item.id}".`);
        ids.push(item.id);
      }
    });
  }
  if (!isText(e.order_instruction)) problem('order_instruction is missing or empty.');
  else if (/[\r\n]/.test(e.order_instruction)) problem('order_instruction must be one line.');
  checkCorrectIncorrectFeedback(e, problem);
}

function checkOpenText(e: Json, problem: (message: string) => void) {
  // Rubric: exactly 3 criteria, ids c1-c3, exactly one required.
  const rubric = e.rubric;
  const problemsBeforeRubric = problems.length;
  let rubricOk = false;
  if (!Array.isArray(rubric)) {
    problem('rubric is missing. Open text needs 3 criteria.');
  } else {
    if (rubric.length !== 3) problem(`the rubric has ${rubric.length} criteria, but it needs exactly 3.`);
    rubric.forEach((c, i) => {
      const fields = ['id', 'text', 'level_0', 'level_1', 'level_2'];
      const missing = isObject(c) ? fields.filter((f) => !isText(c[f])) : fields;
      if (missing.length > 0) problem(`rubric criterion #${i + 1} is missing: ${list(missing)}.`);
      if (!isObject(c) || typeof c.required !== 'boolean') {
        problem(`rubric criterion #${i + 1} needs "required" set to true or false.`);
      }
    });
    const ids = rubric.map((c) => (isObject(c) ? c.id : undefined));
    if ([...ids].sort().join() !== CRITERION_IDS.join()) {
      problem(`the rubric's criterion ids must be c1, c2 and c3 (found: ${list(ids.map(String))}).`);
    }
    const required = rubric.filter((c) => isObject(c) && c.required === true).length;
    if (required !== 1) problem(`exactly one rubric criterion must be required (found ${required}).`);
    rubricOk = problems.length === problemsBeforeRubric;
  }

  // Anchors: exactly 3, each with scores that match the rubric's ids.
  const anchors = e.anchors;
  if (!Array.isArray(anchors)) {
    problem('anchors is missing. Open text needs 3 anchors.');
    return;
  }
  if (anchors.length !== 3) problem(`has ${anchors.length} anchors, but it needs exactly 3.`);
  anchors.forEach((a, i) => {
    const label = isObject(a) && isText(a.label) ? `anchor "${a.label}"` : `anchor #${i + 1}`;
    if (!isObject(a)) {
      problem(`${label} isn't an object with fields.`);
      return;
    }
    if (!isText(a.label)) problem(`${label} is missing its label.`);
    if (!isText(a.text)) problem(`${label} is missing its text.`);
    if (typeof a.expected_pass !== 'boolean') problem(`${label} needs expected_pass set to true or false.`);
    const scores = a.expected_scores;
    if (!isObject(scores)) {
      problem(`${label} is missing expected_scores (a score for c1, c2 and c3).`);
      return;
    }
    const badScores = CRITERION_IDS.filter((id) => ![0, 1, 2].includes(scores[id] as number));
    if (badScores.length > 0) problem(`${label} needs a score of 0, 1 or 2 for: ${list(badScores)}.`);
    const extra = Object.keys(scores).filter((id) => !CRITERION_IDS.includes(id));
    if (extra.length > 0) problem(`${label} has scores for criteria that don't exist: ${list(extra)}.`);

    // expected_pass must agree with the pass rule (at least 4 of 6, required criterion at least 1).
    if (rubricOk && badScores.length === 0 && extra.length === 0 && typeof a.expected_pass === 'boolean') {
      const criteria = CRITERION_IDS.map((id) => ({ id, score: scores[id] as number }));
      const flags = { off_topic: false, not_an_answer: false };
      const passes = scoreOpenText(rubric as { id: string; required: boolean }[], criteria, flags).result === 'pass';
      if (passes !== a.expected_pass) {
        problem(
          `${label} has expected_pass ${a.expected_pass}, but its expected_scores would ${passes ? 'pass' : 'fail'} ` +
            '(pass = at least 4 of 6 and the required criterion at least 1).',
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------

// Exercise files are exercises-*.json; "Say it your way" prompt files are prompts-*.json.
const files = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
let promptCount = 0;
let wordCount = 0;
const firstFileForPromptId = new Map<string, string>();

function checkPrompt(file: string, p: unknown, index: number) {
  if (!isObject(p)) {
    problems.push(`${file}, prompt #${index + 1}: isn't an object with fields.`);
    return;
  }
  const name = isText(p.id) ? p.id : `prompt #${index + 1}`;
  const problem = (message: string) => problems.push(`${file} › ${name}: ${message}`);
  if (!isText(p.id)) {
    problem('is missing its id.');
  } else {
    const earlier = firstFileForPromptId.get(p.id);
    if (earlier) problem(`the id "${p.id}" is already used in ${earlier}. Ids must never repeat.`);
    else firstFileForPromptId.set(p.id, file);
  }
  if (!isText(p.text)) problem('text is missing or empty.');
  if (!STATUSES.includes(p.status as string)) {
    problem(`status is "${String(p.status ?? '')}", but it must be one of: ${list(STATUSES)}.`);
  }
}

for (const file of files) {
  const kind = file.startsWith('exercises-')
    ? 'exercises'
    : file.startsWith('prompts-')
      ? 'prompts'
      : file.startsWith('words-')
        ? 'words'
        : null;
  if (!kind) {
    problems.push(`${file}: file names must start with "exercises-", "prompts-" or "words-", so this file wasn't checked.`);
    continue;
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));
  } catch (error) {
    problems.push(`${file}: isn't valid JSON, so nothing in it was checked. (${(error as Error).message})`);
    continue;
  }
  const items = isObject(data) ? data[kind] : undefined;
  if (!Array.isArray(items)) {
    problems.push(`${file}: needs a "${kind}" list at the top level.`);
    continue;
  }
  items.forEach((item, i) => {
    if (kind === 'exercises') {
      checkExercise(file, item, i);
      exerciseCount += 1;
    } else if (kind === 'words') {
      checkWord(file, item, i);
      wordCount += 1;
    } else {
      checkPrompt(file, item, i);
      promptCount += 1;
    }
  });
}

checkStorySequencing();
checkStarterCounts();
checkWordsAgainstSprints();
checkSeries();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const summary =
  `Checked ${plural(exerciseCount, 'exercise', 'exercises')}, ${plural(promptCount, 'prompt', 'prompts')} ` +
  `and ${plural(wordCount, 'word', 'words')} ` +
  `in ${plural(files.length, 'file', 'files')} in docs/content/.`;
if (problems.length === 0) {
  console.log(`${summary} Everything matches SPEC section 5.`);
} else {
  for (const p of problems) console.log(`✗ ${p}`);
  console.log(`\n${summary} Found ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}.`);
  process.exitCode = 1;
}
