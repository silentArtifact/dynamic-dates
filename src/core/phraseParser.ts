import { moment } from "obsidian";
import {
        HOLIDAYS,
        HOLIDAY_WORDS,
        holidayEnabled,
        getHolidayGroups,
        getHolidayOverrides,
        setHolidayGroups,
        setHolidayOverrides,
        lastWeekdayOfMonth,
        nthWeekdayOfMonth,
} from "./holidays";

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

export const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

export function expandMonthName(name: string): string {
        const idx = MONTH_ABBR.indexOf(name.slice(0, 3).toLowerCase());
        return idx >= 0 ? MONTHS[idx] : name;
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

interface MomentLike {
        diff?: (other: MomentLike, unit: string) => number;
        toDate?: () => Date;
        d?: Date;
}

export function dayDiff(a: MomentLike, b: MomentLike): number {
        if (typeof a.diff === "function") return Math.abs(a.diff(b, "day"));
        const da: Date = a.d || a.toDate?.() || new Date(NaN);
        const db: Date = b.d || b.toDate?.() || new Date(NaN);
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

export function isProperNoun(word: string): boolean {
        const w = word.toLowerCase();
        if (NON_PROPER_WORDS.has(w)) return false;
        if (WEEKDAYS.includes(w) || MONTHS.includes(w) || HOLIDAY_WORDS.has(w)) return true;
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

export function normalizePhrase(text: string): string {
        return text.toLowerCase().replace(/[\s-]+/g, "");
}

export function prefixMatch(candidate: string, query: string): boolean {
        return normalizePhrase(candidate).startsWith(normalizePhrase(query));
}

export const MONTH_ABBR_DOT = ["jan", "feb", "mar", "apr", "aug", "sep", "oct", "nov", "dec"];

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
                                                const dot = MONTH_ABBR_DOT.includes(stripped)
                                                        ? "."
                                                        : p.includes(".")
                                                        ? "."
                                                        : "";
                                                return base + dot;
                                        }
                                        return isProperNoun(p) ? properCase(p) : p;
                                })
                                .join("-")
                )
                .join(" ");
}

export type PhraseToMomentFunc = {
        (phrase: string): moment.Moment | null;
        customDates: Record<string, string>;
        holidayGroups: Record<string, boolean>;
        holidayOverrides: Record<string, boolean>;
};

let customDates: Record<string, string> = {};

function getCustomDates(): Record<string, string> {
        return customDates;
}

const phraseToMomentBase = (phrase: string): moment.Moment | null => {
        const now = moment();
        const lower = normalizeWeekdayAliases(phrase.toLowerCase().trim());

        const customMap = getCustomDates();
        if (lower in customMap) {
                const val = customMap[lower];
                const m = moment(val, ["MM-DD", "M-D", "MMMM D", "MMM D"], true);
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
                if (!isNaN(n)) return now.clone().add(n * (rel[2].startsWith("week") ? 7 : 1), "day");
        }
        const ago = lower.match(/^(\d+) (day|days|week|weeks) ago$/);
        if (ago) {
                const n = parseInt(ago[1]);
                if (!isNaN(n)) return now.clone().subtract(n * (ago[2].startsWith("week") ? 7 : 1), "day");
        }

        const mdy = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{2,4})$/i);
        if (mdy) {
                const monthName = expandMonthName(mdy[1]);
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
                const monthName = expandMonthName(lastMd[1]);
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
        if (beforeWd) return phraseToMomentBase(`last ${beforeWd[1]}`);

        const nthWd = lower.match(/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{2,4}))?/i);
        if (nthWd) {
                const order = nthWd[1];
                const wd = WEEKDAYS.indexOf(nthWd[2]);
                const monthName = expandMonthName(nthWd[3]);
                const yearText = nthWd[4];
                const monthIdx = MONTHS.indexOf(monthName.toLowerCase());
                const map: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
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

        for (let i = 0; i < 7; i++) {
                const name = WEEKDAYS[i];

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

        const md = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}\w*)$/i);
        if (md) {
                const monthName = expandMonthName(md[1]);
                const dayNum = parseInt(md[2]);
                if (!isNaN(dayNum)) {
                        const target = now.clone().month(monthName).date(dayNum);
                        if (!target.isValid()) return null;
                        return closestDate(target, now);
                }
        }
        return null;
};

const phraseToMoment = phraseToMomentBase as PhraseToMomentFunc;

Object.defineProperty(phraseToMoment, "customDates", {
        get: () => customDates,
        set: (value: Record<string, string>) => {
                customDates = value || {};
        },
        enumerable: true,
});

Object.defineProperty(phraseToMoment, "holidayGroups", {
        get: () => getHolidayGroups(),
        set: (value: Record<string, boolean>) => {
                setHolidayGroups(value || {});
        },
        enumerable: true,
});

Object.defineProperty(phraseToMoment, "holidayOverrides", {
        get: () => getHolidayOverrides(),
        set: (value: Record<string, boolean>) => {
                setHolidayOverrides(value || {});
        },
        enumerable: true,
});

export { phraseToMoment };
