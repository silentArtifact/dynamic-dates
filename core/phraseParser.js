"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phraseToMoment = exports.MONTH_ABBR_DOT = exports.NON_PROPER_WORDS = exports.WEEKDAY_ALIAS = exports.MONTH_ABBR = exports.MONTHS = exports.WEEKDAYS = exports.BASE_WORDS = void 0;
exports.expandMonthName = expandMonthName;
exports.normalizeWeekdayAliases = normalizeWeekdayAliases;
exports.dayDiff = dayDiff;
exports.closestDate = closestDate;
exports.isProperNoun = isProperNoun;
exports.properCase = properCase;
exports.formatWordPart = formatWordPart;
exports.formatWord = formatWord;
exports.needsYearAlias = needsYearAlias;
exports.normalizePhrase = normalizePhrase;
exports.prefixMatch = prefixMatch;
exports.formatTypedPhrase = formatTypedPhrase;
const obsidian_1 = require("obsidian");
const holidays_1 = require("./holidays");
exports.BASE_WORDS = [
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
exports.WEEKDAYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
exports.MONTHS = [
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
exports.MONTH_ABBR = exports.MONTHS.map((m) => m.slice(0, 3));
function expandMonthName(name) {
    const idx = exports.MONTH_ABBR.indexOf(name.slice(0, 3).toLowerCase());
    return idx >= 0 ? exports.MONTHS[idx] : name;
}
exports.WEEKDAY_ALIAS = {
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
function normalizeWeekdayAliases(str) {
    return str.replace(/\b(?:sun|mon|tues?|wed(?:s)?|thu(?:rs)?|thur|fri|sat)\b/g, (m) => exports.WEEKDAY_ALIAS[m] || m);
}
function dayDiff(a, b) {
    if (typeof a.diff === "function")
        return Math.abs(a.diff(b, "day"));
    const da = a.d || a.toDate?.() || new Date(NaN);
    const db = b.d || b.toDate?.() || new Date(NaN);
    return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}
function closestDate(base, now) {
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
exports.NON_PROPER_WORDS = new Set([
    "the",
    "of",
    "and",
    "al",
    "la",
    "le",
    "el",
    "de",
]);
function isProperNoun(word) {
    const w = word.toLowerCase();
    if (exports.NON_PROPER_WORDS.has(w))
        return false;
    if (exports.WEEKDAYS.includes(w) || exports.MONTHS.includes(w) || holidays_1.HOLIDAY_WORDS.has(w))
        return true;
    if (w.includes("-")) {
        return w
            .split("-")
            .some((p) => !exports.NON_PROPER_WORDS.has(p) && holidays_1.HOLIDAY_WORDS.has(p));
    }
    return false;
}
function properCase(word) {
    return word
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join("-");
}
function formatWordPart(word, typed) {
    const lower = word.toLowerCase();
    if (typed) {
        if (typed.length === word.length && typed.toLowerCase() === lower) {
            return isProperNoun(word)
                ? properCase(word)
                : exports.NON_PROPER_WORDS.has(lower)
                    ? typed.toLowerCase()
                    : typed;
        }
        if (word.toLowerCase().startsWith(typed.toLowerCase())) {
            if (isProperNoun(word))
                return properCase(word);
            if (exports.NON_PROPER_WORDS.has(lower))
                return typed.toLowerCase();
            return typed + word.slice(typed.length);
        }
    }
    if (isProperNoun(word))
        return properCase(word);
    if (exports.NON_PROPER_WORDS.has(lower))
        return word.toLowerCase();
    return properCase(word);
}
function formatWord(word, typed) {
    const parts = word.split("-");
    const typedParts = typed ? typed.split("-") : [];
    return parts.map((p, i) => formatWordPart(p, typedParts[i])).join("-");
}
function needsYearAlias(phrase) {
    const lower = phrase.toLowerCase().trim();
    if (/^(?:last|next)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/.test(lower)) {
        return true;
    }
    if (/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4}$/.test(lower)) {
        return true;
    }
    return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*\d{2,4}$/.test(lower);
}
function normalizePhrase(text) {
    return text.toLowerCase().replace(/[\s-]+/g, "");
}
function prefixMatch(candidate, query) {
    return normalizePhrase(candidate).startsWith(normalizePhrase(query));
}
exports.MONTH_ABBR_DOT = ["jan", "feb", "mar", "apr", "aug", "sep", "oct", "nov", "dec"];
function formatTypedPhrase(phrase) {
    return phrase
        .split(/\s+/)
        .map((w) => w
        .split("-")
        .map((p) => {
        const stripped = p.replace(/\./g, "").toLowerCase();
        if (exports.MONTH_ABBR.includes(stripped)) {
            const base = properCase(stripped);
            const dot = exports.MONTH_ABBR_DOT.includes(stripped)
                ? "."
                : p.includes(".")
                    ? "."
                    : "";
            return base + dot;
        }
        return isProperNoun(p) ? properCase(p) : p;
    })
        .join("-"))
        .join(" ");
}
let customDates = {};
function getCustomDates() {
    return customDates;
}
const phraseToMomentBase = (phrase) => {
    const now = (0, obsidian_1.moment)();
    const lower = normalizeWeekdayAliases(phrase.toLowerCase().trim());
    const customMap = getCustomDates();
    if (lower in customMap) {
        const val = customMap[lower];
        const m = (0, obsidian_1.moment)(val, ["MM-DD", "M-D", "MMMM D", "MMM D"], true);
        if (m.isValid()) {
            m.year(now.year());
            return closestDate(m, now);
        }
    }
    for (const [name, def] of Object.entries(holidays_1.HOLIDAYS)) {
        if (!(0, holidays_1.holidayEnabled)(name))
            continue;
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
            if (!m.isBefore(now, "day"))
                m = calc(now.year() - 1);
            return m;
        }
        if (lower === `next ${name}`) {
            let m = calc(now.year());
            if (!m.isAfter(now, "day"))
                m = calc(now.year() + 1);
            return m;
        }
        const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+of)?\\s+(\\d{2,4})$`);
        const matchYear = lower.match(re);
        if (matchYear) {
            let y = parseInt(matchYear[1]);
            if (y < 100)
                y += 2000;
            return calc(y);
        }
    }
    if (lower === "today")
        return now;
    if (lower === "yesterday")
        return now.clone().subtract(1, "day");
    if (lower === "tomorrow")
        return now.clone().add(1, "day");
    const rel = lower.match(/^in (\d+) (day|days|week|weeks)$/);
    if (rel) {
        const n = parseInt(rel[1]);
        if (!isNaN(n))
            return now.clone().add(n * (rel[2].startsWith("week") ? 7 : 1), "day");
    }
    const ago = lower.match(/^(\d+) (day|days|week|weeks) ago$/);
    if (ago) {
        const n = parseInt(ago[1]);
        if (!isNaN(n))
            return now.clone().subtract(n * (ago[2].startsWith("week") ? 7 : 1), "day");
    }
    const mdy = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{2,4})$/i);
    if (mdy) {
        const monthName = expandMonthName(mdy[1]);
        const dayNum = parseInt(mdy[2]);
        let yearNum = parseInt(mdy[3]);
        if (!isNaN(dayNum) && !isNaN(yearNum)) {
            if (yearNum < 100)
                yearNum += 2000;
            const idx = exports.MONTHS.indexOf(monthName.toLowerCase());
            const target = (0, obsidian_1.moment)(new Date(yearNum, idx, dayNum));
            if (!target.isValid())
                return null;
            return target;
        }
    }
    const lastMd = lower.match(/^last\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}\w*)$/i);
    if (lastMd) {
        const monthName = expandMonthName(lastMd[1]);
        const dayNum = parseInt(lastMd[2]);
        if (!isNaN(dayNum)) {
            const target = now.clone().month(monthName).date(dayNum);
            if (!target.isValid())
                return null;
            if (!target.isBefore(now, "day"))
                target.subtract(1, "year");
            return target;
        }
    }
    const justDay = lower.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/);
    if (justDay) {
        const dayNum = parseInt(justDay[1]);
        if (!isNaN(dayNum)) {
            const target = now.clone();
            if (dayNum <= target.date())
                target.add(1, "month");
            target.date(dayNum);
            if (!target.isValid() || target.date() !== dayNum)
                return null;
            return target;
        }
    }
    const beforeWd = lower.match(/^the\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:before|previous)$/);
    if (beforeWd)
        return phraseToMomentBase(`last ${beforeWd[1]}`);
    const nthWd = lower.match(/^(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{2,4}))?/i);
    if (nthWd) {
        const order = nthWd[1];
        const wd = exports.WEEKDAYS.indexOf(nthWd[2]);
        const monthName = expandMonthName(nthWd[3]);
        const yearText = nthWd[4];
        const monthIdx = exports.MONTHS.indexOf(monthName.toLowerCase());
        const map = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
        const parseYear = (y) => (parseInt(y) < 100 ? parseInt(y) + 2000 : parseInt(y));
        const baseYear = yearText ? parseYear(yearText) : now.year();
        const compute = (y) => order === "last"
            ? (0, holidays_1.lastWeekdayOfMonth)(y, monthIdx, wd)
            : (0, holidays_1.nthWeekdayOfMonth)(y, monthIdx, wd, map[order]);
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
        const name = exports.WEEKDAYS[i];
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
            if (!target.isValid())
                return null;
            return closestDate(target, now);
        }
    }
    return null;
};
const phraseToMoment = phraseToMomentBase;
exports.phraseToMoment = phraseToMoment;
Object.defineProperty(phraseToMoment, "customDates", {
    get: () => customDates,
    set: (value) => {
        customDates = value || {};
    },
    enumerable: true,
});
Object.defineProperty(phraseToMoment, "holidayGroups", {
    get: () => (0, holidays_1.getHolidayGroups)(),
    set: (value) => {
        (0, holidays_1.setHolidayGroups)(value || {});
    },
    enumerable: true,
});
Object.defineProperty(phraseToMoment, "holidayOverrides", {
    get: () => (0, holidays_1.getHolidayOverrides)(),
    set: (value) => {
        (0, holidays_1.setHolidayOverrides)(value || {});
    },
    enumerable: true,
});
