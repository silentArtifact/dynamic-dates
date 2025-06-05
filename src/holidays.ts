import { moment } from "obsidian";
export const BASE_WORDS = [
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

export const WEEKDAYS = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
];

export const MONTHS = [
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

export const MONTH_ABBR = MONTHS.map(m => m.slice(0, 3));

export function expandMonthName(name: string): string {
        const idx = MONTH_ABBR.indexOf(name.slice(0, 3).toLowerCase());
        return idx >= 0 ? MONTHS[idx] : name;
}

export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number) {
        const first = moment(new Date(year, month, 1));
        const diff = (weekday - first.weekday() + 7) % 7;
        return first.add(diff + (n - 1) * 7, "day");
}

export function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
        const last = moment(new Date(year, month + 1, 1)).subtract(1, "day");
        const diff = (last.weekday() - weekday + 7) % 7;
        return last.subtract(diff, "day");
}

export function weekdayOnOrBefore(year: number, month: number, day: number, weekday: number) {
        const target = moment(new Date(year, month, day));
        const diff = (target.weekday() - weekday + 7) % 7;
        return target.subtract(diff, "day");
}

export function dayDiff(a: moment.Moment, b: moment.Moment): number {
       const ma: any = a as any;
       if (typeof ma.diff === "function") return Math.abs(ma.diff(b, "day"));
       const da: Date = ma.d || ma.toDate();
       const db: Date = (b as any).d || (b as any).toDate();
       return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

export function closestDate(base: moment.Moment, now: moment.Moment): moment.Moment {
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

export const WEEKDAY_ALIAS: Record<string, string> = {
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

export function normalizeWeekdayAliases(str: string): string {
        return str.replace(/\b(?:sun|mon|tues?|wed(?:s)?|thu(?:rs)?|thur|fri|sat)\b/g, (m) => WEEKDAY_ALIAS[m] || m);
}

export function islamicDateInYear(gYear: number, iMonth: number, iDay: number): moment.Moment {
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

export function hebrewDateInYear(gYear: number, hMonth: string, hDay: number): moment.Moment {
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

export function chineseDateInYear(gYear: number, cMonth: number, cDay: number): moment.Moment {
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

export interface HolidayDef {
        group: string;
        calc: (y: number) => moment.Moment;
        aliases?: string[];
}

export const HOLIDAY_CACHE: Record<string, moment.Moment> = {};

export function easter(y: number): moment.Moment {
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

export const HOLIDAY_DEFS: Record<string, HolidayDef> = {
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

export interface HolidayEntry extends HolidayDef { canonical: string; }

export const HOLIDAYS: Record<string, HolidayEntry> = {} as Record<string, HolidayEntry>;
export const GROUP_HOLIDAYS: Record<string, string[]> = {};
for (const [canon, def] of Object.entries(HOLIDAY_DEFS)) {
        if (!GROUP_HOLIDAYS[def.group]) GROUP_HOLIDAYS[def.group] = [];
        GROUP_HOLIDAYS[def.group].push(canon);
        HOLIDAYS[canon] = { ...def, canonical: canon };
        for (const a of def.aliases || []) {
                HOLIDAYS[a] = { group: def.group, calc: def.calc, canonical: canon };
        }
}

export const HOLIDAY_PHRASES = Object.keys(HOLIDAYS);

export const NON_PROPER_WORDS = new Set([
        "the",
        "of",
        "and",
        "al",
        "la",
        "le",
        "el",
        "de",
]);

export const HOLIDAY_WORDS = new Set(
        HOLIDAY_PHRASES.flatMap((p) =>
                p
                        .split(/\s+/)
                        .flatMap((w) => w.split("-"))
                        .map((w) => w.toLowerCase())
                        .filter((w) => !NON_PROPER_WORDS.has(w)),
        ),
);

export function holidayEnabled(name: string): boolean {
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

export function isProperNoun(word: string): boolean {
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

export function properCase(word: string): string {
        return word
                .split("-")
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
                .join("-");
}

export function formatWordPart(word: string, typed?: string): string {
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

export function formatWord(word: string, typed?: string): string {
        const parts = word.split("-");
        const typedParts = typed ? typed.split("-") : [];
        return parts.map((p, i) => formatWordPart(p, typedParts[i])).join("-");
}

export function needsYearAlias(phrase: string): boolean {
        const lower = phrase.toLowerCase().trim();
        if (/^(?:last|next)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/.test(lower)) {
                return true;
        }
        if (/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4}$/.test(lower)) {
                return true;
        }
        return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*\d{2,4}$/.test(lower);
}

export function isHolidayQualifier(lower: string): boolean {
        const m = lower.match(/^(last|next)\s+(.*)$/);
        if (!m) return false;
        return m[2] in HOLIDAYS;
}

export function normalizePhrase(text: string): string {
        return text.toLowerCase().replace(/[\s-]+/g, "");
}

export function prefixMatch(candidate: string, query: string): boolean {
        return normalizePhrase(candidate).startsWith(normalizePhrase(query));
}

export const MONTH_ABBR_DOT = [
        "jan", "feb", "mar", "apr", "aug", "sep", "oct", "nov", "dec",
];

export function formatTypedPhrase(phrase: string): string {
        return phrase
                .split(/\s+/)
                .map((w) =>
                        w
                                .split("-")
                                .map((p) => {
                                        const stripped = p.replace(/\./g, "").toLowerCase();
                                        if (MONTH_ABBR.includes(stripped)) {
                                                const base = properCase(stripped);
                                                const dot = MONTH_ABBR_DOT.includes(stripped) ? "." : (p.includes(".") ? "." : "");
                                                return base + dot;
                                        }
                                        return isProperNoun(p) ? properCase(p) : p;
                                })
                                .join("-")
                )
                .join(" ");
}

export const PHRASES = BASE_WORDS.flatMap((w) =>
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
export type PhraseToMomentFunc = {
        (phrase: string): moment.Moment | null;
        customDates: Record<string, string>;
        holidayGroups: Record<string, boolean>;
        holidayOverrides: Record<string, boolean>;
};

export function phraseToMoment(phrase: string): moment.Moment | null {
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

