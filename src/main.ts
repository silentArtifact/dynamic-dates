import {
        App,
        Editor,
        EditorPosition,
        EditorSuggest,
        EditorSuggestContext,
        EditorSuggestTriggerInfo,
        moment,
        normalizePath,
        Plugin,
        PluginSettingTab,
        DailyNoteSettings,
        Setting,
        TFile,
} from "obsidian";

// Settings

interface DDSettings {
        /** @deprecated Date format is now taken from the daily notes plugin */
        dateFormat?: string;
        acceptKey: "Enter" | "Tab";
        noAliasWithShift: boolean;
        customDates: Record<string, string>;
        holidayGroups: Record<string, boolean>;
        holidayOverrides: Record<string, boolean>;
}

// Phrase helpers

const BASE_WORDS = [
        "today",
        "yesterday",
        "tomorrow",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
];

const WEEKDAYS = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
];

const MONTHS = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
];

const MONTH_ABBR = MONTHS.map(m => m.slice(0, 3));

function expandMonthName(name: string): string {
        const idx = MONTH_ABBR.indexOf(name.slice(0, 3).toLowerCase());
        return idx >= 0 ? MONTHS[idx] : name;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number) {
        const first = moment(new Date(year, month, 1));
        const diff = (weekday - first.weekday() + 7) % 7;
        return first.add(diff + (n - 1) * 7, "day");
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
        const last = moment(new Date(year, month + 1, 1)).subtract(1, "day");
        const diff = (last.weekday() - weekday + 7) % 7;
        return last.subtract(diff, "day");
}

function weekdayOnOrBefore(year: number, month: number, day: number, weekday: number) {
        const target = moment(new Date(year, month, day));
        const diff = (target.weekday() - weekday + 7) % 7;
        return target.subtract(diff, "day");
}

function dayDiff(a: moment.Moment, b: moment.Moment): number {
       const ma: any = a as any;
       if (typeof ma.diff === "function") return Math.abs(ma.diff(b, "day"));
       const da: Date = ma.d || ma.toDate();
       const db: Date = (b as any).d || (b as any).toDate();
       return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function closestDate(base: moment.Moment, now: moment.Moment): moment.Moment {
       const opts = [base.clone(), base.clone().add(1, "year"), base.clone().subtract(1, "year")];
       let best = opts[0];
       let bestDiff = dayDiff(best, now);
       for (const c of opts.slice(1)) {
               const diff = dayDiff(c, now);
               if (diff < bestDiff) {
                       best = c;
                       bestDiff = diff;
               }
       }
       return best;
}

const WEEKDAY_ALIAS: Record<string, string> = {
        sun: "sunday",
        mon: "monday",
        tue: "tuesday",
        tues: "tuesday",
        wed: "wednesday",
        weds: "wednesday",
        thu: "thursday",
        thur: "thursday",
        thurs: "thursday",
        fri: "friday",
        sat: "saturday",
};

function normalizeWeekdayAliases(str: string): string {
        return str.replace(/\b(?:sun|mon|tues?|wed(?:s)?|thu(?:rs)?|thur|fri|sat)\b/g, (m) => WEEKDAY_ALIAS[m] || m);
}

function islamicDateInYear(gYear: number, iMonth: number, iDay: number): moment.Moment {
        const fmt = new Intl.DateTimeFormat("en-u-ca-islamic", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
        });
        for (let m = 0; m < 12; m++) {
                for (let d = 1; d <= 31; d++) {
                        const date = new Date(gYear, m, d);
                        if (date.getFullYear() !== gYear) continue;
                        const parts = fmt.formatToParts(date);
                        const im = parseInt(parts.find((p) => p.type === "month")?.value || "");
                        const id = parseInt(parts.find((p) => p.type === "day")?.value || "");
                        if (im === iMonth && id === iDay) return moment(date);
                }
        }
        return (moment as any).invalid();
}

function hebrewDateInYear(gYear: number, hMonth: string, hDay: number): moment.Moment {
        const fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", {
                day: "numeric",
                month: "long",
                year: "numeric",
        });
        const target = hMonth.toLowerCase();
        for (let m = 0; m < 12; m++) {
                for (let d = 1; d <= 31; d++) {
                        const date = new Date(gYear, m, d);
                        if (date.getFullYear() !== gYear) continue;
                        const parts = fmt.formatToParts(date);
                        const name = (parts.find((p) => p.type === "month")?.value || "").toLowerCase();
                        const day = parseInt(parts.find((p) => p.type === "day")?.value || "");
                        if (name === target && day === hDay) return moment(date);
                }
        }
        return (moment as any).invalid();
}

function chineseDateInYear(gYear: number, cMonth: number, cDay: number): moment.Moment {
        const fmt = new Intl.DateTimeFormat("en-u-ca-chinese", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
        });
        for (let m = 0; m < 12; m++) {
                for (let d = 1; d <= 31; d++) {
                        const date = new Date(gYear, m, d);
                        if (date.getFullYear() !== gYear) continue;
                        const parts = fmt.formatToParts(date);
                        const cm = parseInt(parts.find((p) => p.type === "month")?.value || "");
                        const cd = parseInt(parts.find((p) => p.type === "day")?.value || "");
                        if (cm === cMonth && cd === cDay) return moment(date);
                }
        }
        return (moment as any).invalid();
}

interface HolidayDef {
        group: string;
        calc: (y: number) => moment.Moment;
        aliases?: string[];
}

const HOLIDAY_CACHE: Record<string, moment.Moment> = {};

function easter(y: number): moment.Moment {
        const a = y % 19;
        const b = Math.floor(y / 100);
        const c = y % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return moment(new Date(y, month, day));
}

const HOLIDAY_DEFS: Record<string, HolidayDef> = {
        "new year's day": { group: "US Federal Holidays", calc: (y) => moment(new Date(y, 0, 1)) },
        "martin luther king jr day": {
                group: "US Federal Holidays",
                calc: (y) => nthWeekdayOfMonth(y, 0, 1, 3),
                aliases: ["mlk day", "martin luther king day"],
        },
        "presidents day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 1, 1, 3) },
        "memorial day": { group: "US Federal Holidays", calc: (y) => lastWeekdayOfMonth(y, 4, 1) },
        "juneteenth": { group: "US Federal Holidays", calc: (y) => moment(new Date(y, 5, 19)) },
        "independence day": { group: "US Federal Holidays", calc: (y) => moment(new Date(y, 6, 4)) },
        "labor day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 8, 1, 1) },
        "columbus day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 9, 1, 2) },
        "veterans day": { group: "US Federal Holidays", calc: (y) => moment(new Date(y, 10, 11)) },
        "thanksgiving": {
                group: "US Federal Holidays",
                calc: (y) => nthWeekdayOfMonth(y, 10, 4, 4),
                aliases: ["thanksgiving day"],
        },
        "christmas": {
                group: "US Federal Holidays",
                calc: (y) => moment(new Date(y, 11, 25)),
                aliases: ["christmas day"],
        },

        // US Cultural Holidays
        "valentine's day": { group: "US Cultural Holidays", calc: (y) => moment(new Date(y, 1, 14)) },
        "halloween": { group: "US Cultural Holidays", calc: (y) => moment(new Date(y, 9, 31)) },
        "new year's eve": { group: "US Cultural Holidays", calc: (y) => moment(new Date(y, 11, 31)) },

        // Christian Holidays
        "easter": { group: "Christian Holidays", calc: (y) => easter(y), aliases: ["easter sunday"] },
        "good friday": { group: "Christian Holidays", calc: (y) => easter(y).subtract(2, "day") },
        "ash wednesday": { group: "Christian Holidays", calc: (y) => easter(y).subtract(46, "day") },

        // Islamic Holidays
        "ramadan": { group: "Islamic Holidays", calc: (y) => islamicDateInYear(y, 9, 1) },
        "eid al-fitr": { group: "Islamic Holidays", calc: (y) => islamicDateInYear(y, 10, 1) },
        "eid al-adha": { group: "Islamic Holidays", calc: (y) => islamicDateInYear(y, 12, 10) },

        // Jewish Holidays
        "passover": { group: "Jewish Holidays", calc: (y) => hebrewDateInYear(y, "Nisan", 15) },
        "rosh hashanah": { group: "Jewish Holidays", calc: (y) => hebrewDateInYear(y, "Tishri", 1) },
        "yom kippur": { group: "Jewish Holidays", calc: (y) => hebrewDateInYear(y, "Tishri", 10) },
        "hanukkah": { group: "Jewish Holidays", calc: (y) => hebrewDateInYear(y, "Kislev", 25) },

        // Chinese Holidays
        "chinese new year": {
                group: "Chinese Holidays",
                calc: (y) => chineseDateInYear(y, 1, 1),
                aliases: ["lunar new year"],
        },
        "dragon boat festival": { group: "Chinese Holidays", calc: (y) => chineseDateInYear(y, 5, 5) },
        "mid-autumn festival": { group: "Chinese Holidays", calc: (y) => chineseDateInYear(y, 8, 15) },

        // Canadian Federal Holidays
        "canada day": { group: "Canadian Federal Holidays", calc: (y) => moment(new Date(y, 6, 1)) },
        "victoria day": { group: "Canadian Federal Holidays", calc: (y) => weekdayOnOrBefore(y, 4, 24, 1) },
        "canadian thanksgiving": {
                group: "Canadian Federal Holidays",
                calc: (y) => nthWeekdayOfMonth(y, 9, 1, 2),
                aliases: ["thanksgiving (canada)", "thanksgiving canada"],
        },

        // UK Bank Holidays
        "boxing day": { group: "UK Bank Holidays", calc: (y) => moment(new Date(y, 11, 26)) },
};

for (const [name, def] of Object.entries(HOLIDAY_DEFS)) {
        const orig = def.calc;
        def.calc = (y: number) => {
                const key = `${y}:${name}`;
                let m = HOLIDAY_CACHE[key];
                if (!m) {
                        m = orig(y).clone();
                        HOLIDAY_CACHE[key] = m;
                }
                return m.clone();
        };
}

interface HolidayEntry extends HolidayDef { canonical: string; }

const HOLIDAYS: Record<string, HolidayEntry> = {} as Record<string, HolidayEntry>;
const GROUP_HOLIDAYS: Record<string, string[]> = {};
for (const [canon, def] of Object.entries(HOLIDAY_DEFS)) {
        if (!GROUP_HOLIDAYS[def.group]) GROUP_HOLIDAYS[def.group] = [];
        GROUP_HOLIDAYS[def.group].push(canon);
        HOLIDAYS[canon] = { ...def, canonical: canon };
        for (const a of def.aliases || []) {
                HOLIDAYS[a] = { group: def.group, calc: def.calc, canonical: canon };
        }
}

const HOLIDAY_PHRASES = Object.keys(HOLIDAYS);

const NON_PROPER_WORDS = new Set([
        "the",
        "of",
        "and",
        "al",
        "la",
        "le",
        "el",
        "de",
]);

const HOLIDAY_WORDS = new Set(
        HOLIDAY_PHRASES.flatMap((p) =>
                p
                        .split(/\s+/)
                        .flatMap((w) => w.split("-"))
                        .map((w) => w.toLowerCase())
                        .filter((w) => !NON_PROPER_WORDS.has(w)),
        ),
);

function holidayEnabled(name: string): boolean {
        const entry = HOLIDAYS[name];
        if (!entry) return true;
        const canonical = entry.canonical;
        const overrides: Record<string, boolean> = (phraseToMoment as PhraseToMomentFunc).holidayOverrides || {};
        if (canonical in overrides) return overrides[canonical];
        const groups: Record<string, boolean> = (phraseToMoment as PhraseToMomentFunc).holidayGroups || {};
        const g = entry.group;
        if (g && g in groups) return groups[g];
        return true;
}

const DEFAULT_SETTINGS: DDSettings = {
        acceptKey: "Tab",
        noAliasWithShift: false,
        customDates: {},
        holidayGroups: Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map(g => [g, false])),
        holidayOverrides: {},
};

function isProperNoun(word: string): boolean {
        const w = word.toLowerCase();
        if (NON_PROPER_WORDS.has(w)) return false;
        if (WEEKDAYS.includes(w) || MONTHS.includes(w) || HOLIDAY_WORDS.has(w)) return true;
        // check hyphenated parts
        if (w.includes("-")) {
                return w
                        .split("-")
                        .some((p) => !NON_PROPER_WORDS.has(p) && HOLIDAY_WORDS.has(p));
        }
        return false;
}

function properCase(word: string): string {
        return word
                .split("-")
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
                .join("-");
}

function formatWordPart(word: string, typed?: string): string {
        const lower = word.toLowerCase();
        if (typed) {
                if (typed.length === word.length && typed.toLowerCase() === lower) {
                        return isProperNoun(word)
                                ? properCase(word)
                                : NON_PROPER_WORDS.has(lower)
                                ? typed.toLowerCase()
                                : typed;
                }
                if (word.toLowerCase().startsWith(typed.toLowerCase())) {
                        if (isProperNoun(word)) return properCase(word);
                        if (NON_PROPER_WORDS.has(lower)) return typed.toLowerCase();
                        return typed + word.slice(typed.length);
                }
        }
        if (isProperNoun(word)) return properCase(word);
        if (NON_PROPER_WORDS.has(lower)) return word.toLowerCase();
        return properCase(word);
}

function formatWord(word: string, typed?: string): string {
        const parts = word.split("-");
        const typedParts = typed ? typed.split("-") : [];
        return parts.map((p, i) => formatWordPart(p, typedParts[i])).join("-");
}

function needsYearAlias(phrase: string): boolean {
        const lower = phrase.toLowerCase().trim();
        if (/^(?:last|next)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/.test(lower)) {
                return true;
        }
        if (/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4}$/.test(lower)) {
                return true;
        }
        return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*\d{2,4}$/.test(lower);
}

function isHolidayQualifier(lower: string): boolean {
        const m = lower.match(/^(last|next)\s+(.*)$/);
        if (!m) return false;
        return m[2] in HOLIDAYS;
}

function normalizePhrase(text: string): string {
        return text.toLowerCase().replace(/[\s-]+/g, "");
}

function prefixMatch(candidate: string, query: string): boolean {
        return normalizePhrase(candidate).startsWith(normalizePhrase(query));
}

function formatTypedPhrase(phrase: string): string {
        return phrase
                .split(/\s+/)
                .map((w) =>
                        w
                                .split("-")
                                .map((p) => (isProperNoun(p) ? properCase(p) : p))
                                .join("-")
                )
                .join(" ");
}

const PHRASES = BASE_WORDS.flatMap((w) =>
        WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w],
).concat(HOLIDAY_PHRASES);


/**
 * Convert a natural-language phrase into a moment date instance.
 *
 * Supported values include "today", "tomorrow", "yesterday",
 * "next Monday", "last Friday" and long month names such as
 * "december 25" or "august 20th".  Abbreviated month names are not
 * recognised.  If the phrase cannot be parsed, `null` is returned.
 */
type PhraseToMomentFunc = {
        (phrase: string): moment.Moment | null;
        customDates: Record<string, string>;
        holidayGroups: Record<string, boolean>;
        holidayOverrides: Record<string, boolean>;
};

function phraseToMoment(phrase: string): moment.Moment | null {
        const now = moment();
        const lower = normalizeWeekdayAliases(phrase.toLowerCase().trim());

        const customMap: Record<string,string> = (phraseToMoment as PhraseToMomentFunc).customDates || {};
        if (lower in customMap) {
                const val = customMap[lower];
                const m = moment(val, ["MM-DD","M-D","MMMM D","MMM D"], true);
                if (m.isValid()) {
                        m.year(now.year());
                        return closestDate(m, now);
                }
        }

        for (const [name, def] of Object.entries(HOLIDAYS)) {
                if (!holidayEnabled(name)) continue;
                const calc = def.calc;
                if (lower === name) {
                        const base = calc(now.year());
                        const next = calc(now.year() + 1);
                        const prev = calc(now.year() - 1);
                        const opts = [base, next, prev];
                        let best = opts[0];
                        let bestDiff = dayDiff(best, now);
                        for (const c of opts.slice(1)) {
                                const diff = dayDiff(c, now);
                                if (diff < bestDiff) {
                                        best = c;
                                        bestDiff = diff;
                                }
                        }
                        return best;
                }
                if (lower === `last ${name}`) {
                        let m = calc(now.year());
                        if (!m.isBefore(now, "day")) m = calc(now.year() - 1);
                        return m;
                }
                if (lower === `next ${name}`) {
                        let m = calc(now.year());
                        if (!m.isAfter(now, "day")) m = calc(now.year() + 1);
                        return m;
                }
                const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+of)?\\s+(\\d{2,4})$`);
                const matchYear = lower.match(re);
                if (matchYear) {
                        let y = parseInt(matchYear[1]);
                        if (y < 100) y += 2000;
                        return calc(y);
                }
        }

        if (lower === "today") return now;
        if (lower === "yesterday") return now.clone().subtract(1, "day");
        if (lower === "tomorrow") return now.clone().add(1, "day");

        const rel = lower.match(/^in (\d+) (day|days|week|weeks)$/);
        if (rel) {
                const n = parseInt(rel[1]);
                if (!isNaN(n)) return now.clone().add(n * (rel[2].startsWith('week') ? 7 : 1), "day");
        }
        const ago = lower.match(/^(\d+) (day|days|week|weeks) ago$/);
        if (ago) {
                const n = parseInt(ago[1]);
                if (!isNaN(n)) return now.clone().subtract(n * (ago[2].startsWith('week') ? 7 : 1), "day");
        }

        const mdy = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{2,4})$/i);
        if (mdy) {
                let monthName = expandMonthName(mdy[1]);
                const dayNum = parseInt(mdy[2]);
                let yearNum = parseInt(mdy[3]);
                if (!isNaN(dayNum) && !isNaN(yearNum)) {
                        if (yearNum < 100) yearNum += 2000;
                        const idx = MONTHS.indexOf(monthName.toLowerCase());
                        const target = moment(new Date(yearNum, idx, dayNum));
                        if (!target.isValid()) return null;
                        return target;
                }
        }

        const lastMd = lower.match(/^last\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}\w*)$/i);
        if (lastMd) {
                let monthName = expandMonthName(lastMd[1]);
                const dayNum = parseInt(lastMd[2]);
                if (!isNaN(dayNum)) {
                        const target = now.clone().month(monthName).date(dayNum);
                        if (!target.isValid()) return null;
                        if (!target.isBefore(now, "day")) target.subtract(1, "year");
                        return target;
                }
        }

        const justDay = lower.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/);
        if (justDay) {
                const dayNum = parseInt(justDay[1]);
                if (!isNaN(dayNum)) {
                        const target = now.clone();
                        if (dayNum <= target.date()) target.add(1, "month");
                        target.date(dayNum);
                        if (!target.isValid() || target.date() !== dayNum) return null;
                        return target;
                }
        }

        const beforeWd = lower.match(/^the\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:before|previous)$/);
        if (beforeWd) return phraseToMoment(`last ${beforeWd[1]}`);

        const nthWd = lower.match(/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{2,4}))?/i);
        if (nthWd) {
                const order = nthWd[1];
                const wd = WEEKDAYS.indexOf(nthWd[2]);
                const monthName = expandMonthName(nthWd[3]);
                const yearText = nthWd[4];
                const monthIdx = MONTHS.indexOf(monthName.toLowerCase());
                const map: Record<string, number> = { first:1, second:2, third:3, fourth:4, fifth:5 };
                const parseYear = (y: string) => (parseInt(y) < 100 ? parseInt(y) + 2000 : parseInt(y));
                const baseYear = yearText ? parseYear(yearText) : now.year();

                const compute = (y: number) =>
                        order === "last"
                                ? lastWeekdayOfMonth(y, monthIdx, wd)
                                : nthWeekdayOfMonth(y, monthIdx, wd, map[order]);

                let target = compute(baseYear);

                if (!yearText) {
                        const prev = compute(baseYear - 1);
                        const next = compute(baseYear + 1);
                        const opts = [target, next, prev];
                        let best = opts[0];
                        let bestDiff = dayDiff(best, now);
                        for (const o of opts.slice(1)) {
                                const diff = dayDiff(o, now);
                                if (diff < bestDiff) {
                                        best = o;
                                        bestDiff = diff;
                                }
                        }
                        target = best;
                }

                return target;
        }

        const weekdays = WEEKDAYS;

        for (let i = 0; i < 7; i++) {
                const name = weekdays[i];

		if (lower === name) {
			const diff = (i - now.weekday() + 7) % 7;
			return now.clone().add(diff, "day");
		}
		if (lower === `next ${name}`) {
			const diff = (i - now.weekday() + 7) % 7 || 7;
			return now.clone().add(diff, "day");
		}
                if (lower === `last ${name}`) {
                        const diff = (now.weekday() - i + 7) % 7 || 7;
                        return now.clone().subtract(diff, "day");
                }
        }

        // Month + day (e.g., "august 20" or "aug 20th")
        const md = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}\w*)$/i);
        if (md) {
                let monthName = expandMonthName(md[1]);
                const dayNum = parseInt(md[2]);
                if (!isNaN(dayNum)) {
                        const target = now.clone().month(monthName).date(dayNum);
                        if (!target.isValid()) return null;
                        return closestDate(target, now);
                }
        }
        return null;
}

(phraseToMoment as PhraseToMomentFunc).customDates = {};
(phraseToMoment as PhraseToMomentFunc).holidayGroups = {};
(phraseToMoment as PhraseToMomentFunc).holidayOverrides = {};

// Suggest box

/**
 * Suggest box that proposes dates as the user types natural
 * language expressions.  Selecting a suggestion will replace the
 * typed phrase with a wikilink to the appropriate daily note.
 */
class DDSuggest extends EditorSuggest<string> {
        plugin: DynamicDates;
        private _last: string[] = [];
        constructor(app: App, plugin: DynamicDates) {
                super(app);
                this.plugin = plugin;
        }

        /**
         * Decide whether a suggestion popup should appear for the word at the
         * current cursor position.
         */
        onTrigger(
                cursor: EditorPosition,
                editor: Editor,
                _file: TFile,
        ): EditorSuggestTriggerInfo | null {
                const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);

               // Skip suggestions inside code or wiki links
               // inside fenced block?
               let fenced = false;
               const WINDOW = 20;
               const startLine = Math.max(0, cursor.line - WINDOW);
               for (let i = startLine; i <= cursor.line; i++) {
                       let line = editor.getLine(i);
                       if (i === cursor.line) line = line.slice(0, cursor.ch);
                       let idx = 0;
                       while ((idx = line.indexOf("```", idx)) !== -1) {
                               fenced = !fenced;
                               idx += 3;
                       }
               }
               if (fenced) return null;

                // inside inline code?
                if ((lineBefore.split("`").length - 1) % 2 === 1) return null;

                // inside a wiki link?
                const fullLine = editor.getLine(cursor.line);
                const open = fullLine.lastIndexOf("[[", cursor.ch);
                if (open !== -1) {
                        const close = fullLine.indexOf("]]", open + 2);
                        if (close === -1 || close >= cursor.ch) return null;
                }

                // Track word positions so we can look back multiple words
                const words: { word: string; offset: number }[] = [];
                lineBefore.replace(/\S+/g, (w, off) => {
                        words.push({ word: w, offset: off });
                        return "";
                });
                if (words.length === 0) return null;

                const all = this.plugin.allPhrases();
                const MAX = 6;
                for (let k = Math.min(words.length, MAX); k >= 1; k--) {
                        const slice = words.slice(words.length - k);
                        const startCh = slice[0].offset;
                        const prefix = lineBefore.slice(startCh);
                        const raw = prefix.trim();
                        const query = raw.toLowerCase();

                        const hasQualifier = query.startsWith("last ") || query.startsWith("next ");

                        // never pop on bare/partial "last" / "next"
                        if (["l","la","las","last","n","ne","nex","next"].includes(query))
                                continue;

                        // for stand-alone phrases (no qualifier) require ≥3 chars
                        if (!hasQualifier && query.length < 3) continue;

                        // must map to a known phrase or a recognised month/day
                        if (!all.some((p) => prefixMatch(p, query)) && !phraseToMoment(query))
                                continue;

                        return {
                                start: { line: cursor.line, ch: startCh },
                                end:   { line: cursor.line, ch: cursor.ch },
                                query: raw,
                        };
                }

                return null;
        }

        /**
         * Build the list of suggestion strings that should be shown for the
         * given query.
         */
        getSuggestions(ctx: EditorSuggestContext): string[] {
                const q = ctx.query;
                const qLower = q.toLowerCase();

                const direct = (this.plugin as any).momentForPhrase
                        ? (this.plugin as any).momentForPhrase(qLower)
                        : phraseToMoment(qLower);
                if (direct) {
                        this._last = [direct.format(this.plugin.getDateFormat())];
                        return this._last;
                }

               const uniq = new Set<string>();
               const phrases = this.plugin.phrasesForPrefix
                       ? this.plugin.phrasesForPrefix(qLower)
                       : this.plugin.allPhrases().filter(p => prefixMatch(p, qLower));
               for (const p of phrases) {
                       const dt = (this.plugin as any).momentForPhrase
                               ? (this.plugin as any).momentForPhrase(p)
                               : phraseToMoment(p);
                       if (dt) uniq.add(dt.format(this.plugin.getDateFormat()));
               }
               this._last = [...uniq];
               return this._last;
       }

        /** Render a single entry in the suggestion dropdown. */
        renderSuggestion(value: string, el: HTMLElement) {
                const query = this.context?.query || "";
                let phrase = query.toLowerCase();
                const target = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
                const candidates = this.plugin
                        .allPhrases()
                        .filter((p) => {
                                const m = (this.plugin as any).momentForPhrase
                                        ? (this.plugin as any).momentForPhrase(p)
                                        : phraseToMoment(p);
                                return prefixMatch(p, phrase) && m?.format("YYYY-MM-DD") === target;
                        });
                if (!candidates.length && isHolidayQualifier(phrase)) {
                        const m = (this.plugin as any).momentForPhrase
                                ? (this.plugin as any).momentForPhrase(phrase)
                                : phraseToMoment(phrase);
                        if (m && m.format("YYYY-MM-DD") === target) {
                                candidates.push(phrase);
                        }
                }
               if (candidates.length) {
                       phrase = candidates.sort((a, b) => a.length - b.length)[0];
               }

                const alias = this.plugin.buildAlias(phrase, query);
                const niceDate = moment(target, "YYYY-MM-DD").format("MMMM Do, YYYY");
                el.createDiv({ text: `${niceDate} (${alias})` });
        }

        /**
         * Replace the typed phrase with the selected wikilink and optionally
         * create the daily note on disk.
         */
        async selectSuggestion(value: string, ev: KeyboardEvent | MouseEvent) {
                const { editor, start, end, query } = this.context!;
                const { settings } = this.plugin;
                // 1. Find the canonical phrase that maps to this calendar date
                const targetDate = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");

                const candidates = this.plugin.allPhrases().filter(p =>
                        prefixMatch(p, query.toLowerCase()) &&
                        phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate
                );
                if (!candidates.length && isHolidayQualifier(query.toLowerCase())) {
                        const m = phraseToMoment(query.toLowerCase());
                        if (m && m.format("YYYY-MM-DD") === targetDate) {
                                candidates.push(query.toLowerCase());
                        }
                }

	
                let phrase = query.toLowerCase();
                if (candidates.length) {
                        phrase = candidates.sort((a, b) => a.length - b.length)[0];
                }
                const alias = this.plugin.buildAlias(phrase, query);
                // 2. Build the wikilink with alias
                const link = `[[${value}|${alias}]]`;
                // 3. Insert, respecting the Shift-modifier behaviour
                let final = link;
                if (ev instanceof KeyboardEvent) {
                        const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
                        if (key && key !== settings.acceptKey) return;
                       if (ev.shiftKey && settings.noAliasWithShift) {
                               final = `[[${value}]]`;
                       }
                        if (typeof ev.preventDefault === "function") ev.preventDefault();
                        if (typeof ev.stopPropagation === "function") ev.stopPropagation();
                }

                editor.replaceRange(
                        final,
                        start,
                        end,
                );

                this.close();
        }

        onKeyDown(ev: KeyboardEvent): boolean {
                if (this.context && ev.key === this.plugin.settings.acceptKey) {
                        if (typeof ev.preventDefault === 'function') ev.preventDefault();
                        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
                        const value = this._last[0];
                        if (value) void this.selectSuggestion(value, ev);
                        return true;
                }
                return false;
        }


}

// Main plugin & settings

/**
 * Main plugin class.  Registers the suggestion box and exposes a
 * settings tab so users can customise how dates are formatted and
 * where daily notes are stored.
 */
export default class DynamicDates extends Plugin {
        settings: DDSettings = DEFAULT_SETTINGS;
        customMap: Record<string, string> = {};
        /** Combined regex built from all phrases */
        combinedRegex: RegExp | null = null;
        regexPhrases: string[] = [];
        phrasesCache: string[] = [];
        /** Index of phrases keyed by normalised prefix */
        prefixIndex: Map<string, string[]> = new Map();
        /** Cache of phrase -> moment keyed by phrase+date */
        dateCache: Map<string, moment.Moment> = new Map();

       constructor(app?: App, manifest?: any) {
               super(app as any, manifest as any);
               this.refreshPhrasesCache();
       }

       refreshHolidayMap(): void {
               (phraseToMoment as PhraseToMomentFunc).holidayGroups = { ...this.settings.holidayGroups };
               (phraseToMoment as PhraseToMomentFunc).holidayOverrides = { ...this.settings.holidayOverrides };
               this.refreshPhrasesCache();
               this.refreshRegexCache();
       }

       refreshCustomMap(): void {
               this.customMap = {};
               for (const key of Object.keys(this.settings.customDates || {})) {
                       this.customMap[key.toLowerCase()] = key;
               }
               (phraseToMoment as PhraseToMomentFunc).customDates = Object.fromEntries(
                       Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]),
               );
               this.refreshPhrasesCache();
               this.refreshRegexCache();
       }

        refreshPhrasesCache(): void {
                const holidays = HOLIDAY_PHRASES.filter(p => holidayEnabled(p));
                const holidayVariants = holidays.flatMap(h => [h, `last ${h}`, `next ${h}`]);
                this.phrasesCache = [
                        ...BASE_WORDS.flatMap(w => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]),
                        ...holidayVariants,
                        ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase()),
                ];
                this.buildPrefixIndex();
        }

        private buildPrefixIndex(): void {
                this.prefixIndex = new Map();
                for (const phrase of this.phrasesCache) {
                        const norm = normalizePhrase(phrase);
                        for (let i = 1; i <= norm.length; i++) {
                                const key = norm.slice(0, i);
                                let arr = this.prefixIndex.get(key);
                                if (!arr) {
                                        arr = [];
                                        this.prefixIndex.set(key, arr);
                                }
                                arr.push(phrase);
                        }
                }
        }

       refreshRegexCache(): void {
               const phrases = [...this.phrasesCache].sort((a, b) => b.length - a.length);
               this.regexPhrases = phrases;
               const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
               if (escaped.length) {
                       const pattern = `\\b(?:${escaped.join("|")})\\b`;
                       this.combinedRegex = new RegExp(pattern, "gi");
               } else {
                       this.combinedRegex = null;
               }
       }

        getDailySettings(): DailyNoteSettings {
                const mc = (this.app as any).metadataCache;
                if (mc && typeof mc.getDailyNoteSettings === "function") {
                        try {
                                return mc.getDailyNoteSettings();
                        } catch {}
                }
                const dn = (this.app as any).internalPlugins?.plugins?.["daily-notes"];
                return dn?.instance?.options || dn?.options || {};
        }

        getDailyFolder(): string {
                const daily = this.getDailySettings();
                if (!daily?.folder) return "";
                return normalizePath(daily.folder);
        }

        getDateFormat(): string {
                const daily = this.getDailySettings();
                return daily?.format || "YYYY-MM-DD";
        }

       allPhrases(): string[] {
               return this.phrasesCache;
       }

       phrasesForPrefix(query: string): string[] {
               const key = normalizePhrase(query);
               return this.prefixIndex.get(key) || [];
       }

       /** Retrieve a moment for the phrase with caching */
       momentForPhrase(phrase: string): moment.Moment | null {
               const key = `${normalizePhrase(phrase)}|${moment().format('YYYY-MM-DD')}`;
               let m = this.dateCache.get(key);
               if (!m) {
                       const calc = phraseToMoment(phrase);
                       if (!calc) return null;
                       m = calc.clone();
                       this.dateCache.set(key, m);
               }
               return m.clone();
       }

        /** Return the canonical form for a custom phrase, if any. */
        customCanonical(lower: string): string | null {
                return this.customMap[lower.toLowerCase()] || null;
        }

        /**
         * Generate the alias text for a wikilink. The `phrase` parameter
         * should be the canonical phrase that maps to the target date and
         * `typed` is the raw text typed by the user.  Pass an empty string
         * for `typed` when no user input should influence casing.
         */
        buildAlias(phrase: string, typed: string): string {
                const canonical = this.customCanonical(phrase);
                if (canonical) return canonical;

               const target = (this as any).momentForPhrase
                       ? (this as any).momentForPhrase(phrase)
                       : phraseToMoment(phrase);
               if (!target) return typed;

                if (typed) {
                        if (typed.toLowerCase() !== phrase) {
                                const typedWords = typed.split(/\s+/);
                                const phraseWords = phrase.split(/\s+/);
                                return phraseWords
                                        .map((w, i) => {
                                                const t = typedWords[i];
                                                if (["last", "next"].includes(w.toLowerCase()) && t) return t;
                                                return formatWord(w, t);
                                        })
                                        .join(" ");
                        }

                       const typedMoment = (this as any).momentForPhrase
                               ? (this as any).momentForPhrase(typed.toLowerCase())
                               : phraseToMoment(typed.toLowerCase());
                       if (typedMoment && !needsYearAlias(typed)) {
                               return formatTypedPhrase(typed);
                       }

                       if (typedMoment && needsYearAlias(typed)) {
                               return target.format("MMMM Do, YYYY");
                       }
                }

                return phrase
                        .split(/\s+/)
                        .map((w) => (isProperNoun(w) ? properCase(w) : w))
                        .join(" ");
        }

        async onload() {
                await this.loadSettings();
                const sugg = new DDSuggest(this.app, this);
                this.registerEditorSuggest(sugg);
                this.registerDomEvent(document, 'keydown', (ev: KeyboardEvent) => {
                        sugg.onKeyDown(ev);
                }, { capture: true });
                this.addSettingTab(new DDSettingTab(this.app, this));
                this.addCommand({
                        id: "convert-dates",
                        name: "Convert natural-language dates",
                        editorCallback: (editor: Editor) => {
                                const text = (editor as any).getValue();
                                (editor as any).setValue(this.convertText(text));
                        },
                });
                console.log("Dynamic Dates loaded");
        }

	onunload() {
		console.log("Dynamic Dates unloaded");
	}

        async loadSettings() {
                this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
                if (!this.settings.customDates) this.settings.customDates = {};
                if (!this.settings.holidayGroups) this.settings.holidayGroups = Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map(g => [g, false]));
                if (!this.settings.holidayOverrides) this.settings.holidayOverrides = {};
                this.refreshCustomMap();
                this.refreshHolidayMap();
        }
        async saveSettings() {
                await this.saveData(this.settings);
                this.refreshCustomMap();
                this.refreshHolidayMap();
        }

        linkForPhrase(phrase: string): string | null {
                const m = this.momentForPhrase(phrase);
                if (!m) return null;
                const value = m.format(this.getDateFormat());
                const alias = this.buildAlias(phrase, "");
                return `[[${value}|${alias}]]`;
        }

       convertText(text: string): string {
               const phrases = [...this.allPhrases()].sort((a, b) => b.length - a.length);
               if (this.regexPhrases.length !== phrases.length || !this.regexPhrases.every((p, i) => p === phrases[i])) {
                       this.refreshRegexCache();
               }
               const regex = this.combinedRegex;

                const replace = (seg: string) => {
                        if (!regex) return seg;
                        return seg.replace(regex, (m) => this.linkForPhrase(m) ?? m);
                };

                const parts: string[] = [];
                let i = 0;
                while (i < text.length) {
                        if (text.startsWith("```", i)) {
                                const end = text.indexOf("```", i + 3);
                                const endIdx = end === -1 ? text.length : end + 3;
                                parts.push(text.slice(i, endIdx));
                                i = endIdx;
                                continue;
                        }
                        if (text[i] === "`") {
                                const end = text.indexOf("`", i + 1);
                                const endIdx = end === -1 ? text.length : end + 1;
                                parts.push(text.slice(i, endIdx));
                                i = endIdx;
                                continue;
                        }
                        if (text.startsWith("[[", i)) {
                                const end = text.indexOf("]]", i + 2);
                                const endIdx = end === -1 ? text.length : end + 2;
                                parts.push(text.slice(i, endIdx));
                                i = endIdx;
                                continue;
                        }

                        let j = i;
                        while (j < text.length &&
                                !text.startsWith("```", j) &&
                                text[j] !== "`" &&
                                !text.startsWith("[[", j)) {
                                j++;
                        }
                        const seg = text.slice(i, j);
                        parts.push(replace(seg));
                        i = j;
                }

                return parts.join("");
        }
}

/** UI for the plugin settings displayed in Obsidian's settings pane. */
class DDSettingTab extends PluginSettingTab {
        plugin: DynamicDates;
	constructor(app: App, plugin: DynamicDates) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
                const { containerEl } = this;
                containerEl.empty();

                (containerEl as any).createEl("h3", { text: "Suggestion keys" });

                new Setting(containerEl)
                        .setName("Accept key")
                        .setDesc("Key used to accept a suggestion")
                        .addDropdown((d) =>
                                d
                                        .addOptions({ Tab: "Tab", Enter: "Enter" })
                                        .setValue(this.plugin.settings.acceptKey)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.acceptKey = v as any;
                                                await this.plugin.saveSettings();
                                        }),
                        );

                new Setting(containerEl)
                        .setName("Shift+<key> inserts plain link")
                        .addToggle((t) =>
                                t
                                        .setValue(this.plugin.settings.noAliasWithShift)
                                        .onChange(async (v: boolean) => {
                                                this.plugin.settings.noAliasWithShift = v;
                                                await this.plugin.saveSettings();
                                        }),
                        );

                (containerEl as any).createEl("h3", { text: "Holiday groups" });
                Object.entries(GROUP_HOLIDAYS).forEach(([g, list]) => {
                        const groupSetting = new Setting(containerEl)
                                .setName(g)
                                .addToggle(t =>
                                        t.setValue(this.plugin.settings.holidayGroups[g] ?? false)
                                         .onChange(async (v:boolean) => {
                                                 this.plugin.settings.holidayGroups[g] = v;
                                                 await this.plugin.saveSettings();
                                                 this.display();
                                         }));
                        (groupSetting as any).settingEl.classList.add("dd-holiday-group");
                        if (this.plugin.settings.holidayGroups[g] ?? false) {
                                list.forEach(h => {
                                        const now = moment();
                                        let m = HOLIDAYS[h].calc(now.year());
                                        if (m.isBefore(now, "day")) m = HOLIDAYS[h].calc(now.year() + 1);
                                        const label = h.split(/\s+/).map(w => properCase(w)).join(" ") + ` (${m.format("MMMM Do")})`;
                                        const subSetting = new Setting(containerEl)
                                                .setName(label)
                                                .addToggle(t =>
                                                        t.setValue(this.plugin.settings.holidayOverrides[h] ?? true)
                                                         .onChange(async (v:boolean) => {
                                                                 this.plugin.settings.holidayOverrides[h] = v;
                                                                 await this.plugin.saveSettings();
                                                         }));
                                        (subSetting as any).settingEl.classList.add("dd-holiday-sub");
                                });
                        }
                });

                (containerEl as any).createEl("h3", { text: "Custom date mappings" });
                new Setting(containerEl)
                        .setDesc("Map phrases to fixed dates, e.g. 'Mid Year' → '06-01'")
                        .addExtraButton(b =>
                                b.setIcon("plus")
                                 .setTooltip("Add mapping")
                                 .onClick(() => {
                                         this.plugin.settings.customDates["New phrase"] = "01-01";
                                         this.display();
                                 }));
                Object.entries(this.plugin.settings.customDates).forEach(([p, d]) => {
                        let phrase = p;
                        let date = d;
                        new Setting(containerEl)
                                .addText(t =>
                                        t.setPlaceholder("Phrase")
                                         .setValue(phrase)
                                         .onChange(async (v: string) => {
                                                 const map = { ...this.plugin.settings.customDates };
                                                 delete map[phrase];
                                                 phrase = v;
                                                 map[phrase] = date;
                                                 this.plugin.settings.customDates = map;
                                                 await this.plugin.saveSettings();
                                         }))
                                .addText(t =>
                                        t.setPlaceholder("MM-DD")
                                         .setValue(date)
                                         .onChange(async (v: string) => {
                                                 date = v;
                                                 this.plugin.settings.customDates[phrase] = v;
                                                 await this.plugin.saveSettings();
                                         }))
                                .addExtraButton(b =>
                                        b.setIcon("trash")
                                         .setTooltip("Remove")
                                         .onClick(async () => {
                                                 delete this.plugin.settings.customDates[phrase];
                                                 await this.plugin.saveSettings();
                                                 this.display();
                                         }));
                });


        }
}
