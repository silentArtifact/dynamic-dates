"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOLIDAY_DEFS = exports.MONTHS = exports.WEEKDAYS = void 0;
exports.nthWeekdayOfMonth = nthWeekdayOfMonth;
exports.lastWeekdayOfMonth = lastWeekdayOfMonth;
const obsidian_1 = require("obsidian");
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
// Helper functions for holiday calculations
function nthWeekdayOfMonth(year, month, weekday, n) {
    const first = (0, obsidian_1.moment)(new Date(year, month, 1));
    const diff = (weekday - first.weekday() + 7) % 7;
    return first.add(diff + (n - 1) * 7, "day");
}
function lastWeekdayOfMonth(year, month, weekday) {
    const last = (0, obsidian_1.moment)(new Date(year, month + 1, 1)).subtract(1, "day");
    const diff = (last.weekday() - weekday + 7) % 7;
    return last.subtract(diff, "day");
}
function weekdayOnOrBefore(year, month, day, weekday) {
    const target = (0, obsidian_1.moment)(new Date(year, month, day));
    const diff = (target.weekday() - weekday + 7) % 7;
    return target.subtract(diff, "day");
}
function islamicDateInYear(gYear, iMonth, iDay) {
    const fmt = new Intl.DateTimeFormat("en-u-ca-islamic", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
    });
    for (let m = 0; m < 12; m++) {
        for (let d = 1; d <= 31; d++) {
            const date = new Date(gYear, m, d);
            if (date.getFullYear() !== gYear)
                continue;
            const parts = fmt.formatToParts(date);
            const im = parseInt(parts.find((p) => p.type === "month")?.value || "");
            const id = parseInt(parts.find((p) => p.type === "day")?.value || "");
            if (im === iMonth && id === iDay)
                return (0, obsidian_1.moment)(date);
        }
    }
    return obsidian_1.moment.invalid();
}
function hebrewDateInYear(gYear, hMonth, hDay) {
    const fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const target = hMonth.toLowerCase();
    for (let m = 0; m < 12; m++) {
        for (let d = 1; d <= 31; d++) {
            const date = new Date(gYear, m, d);
            if (date.getFullYear() !== gYear)
                continue;
            const parts = fmt.formatToParts(date);
            const name = (parts.find((p) => p.type === "month")?.value || "").toLowerCase();
            const day = parseInt(parts.find((p) => p.type === "day")?.value || "");
            if (name === target && day === hDay)
                return (0, obsidian_1.moment)(date);
        }
    }
    return obsidian_1.moment.invalid();
}
function chineseDateInYear(gYear, cMonth, cDay) {
    const fmt = new Intl.DateTimeFormat("en-u-ca-chinese", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
    });
    for (let m = 0; m < 12; m++) {
        for (let d = 1; d <= 31; d++) {
            const date = new Date(gYear, m, d);
            if (date.getFullYear() !== gYear)
                continue;
            const parts = fmt.formatToParts(date);
            const cm = parseInt(parts.find((p) => p.type === "month")?.value || "");
            const cd = parseInt(parts.find((p) => p.type === "day")?.value || "");
            if (cm === cMonth && cd === cDay)
                return (0, obsidian_1.moment)(date);
        }
    }
    return obsidian_1.moment.invalid();
}
function easter(y) {
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
    return (0, obsidian_1.moment)(new Date(y, month, day));
}
exports.HOLIDAY_DEFS = {
    "new year's day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 0, 1)) },
    "martin luther king jr day": {
        group: "US Federal Holidays",
        calc: (y) => nthWeekdayOfMonth(y, 0, 1, 3),
        aliases: ["mlk day", "martin luther king day"],
    },
    "presidents day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 1, 1, 3) },
    "memorial day": { group: "US Federal Holidays", calc: (y) => lastWeekdayOfMonth(y, 4, 1) },
    "juneteenth": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 5, 19)) },
    "independence day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 6, 4)) },
    "labor day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 8, 1, 1) },
    "columbus day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 9, 1, 2) },
    "veterans day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 10, 11)) },
    "thanksgiving": {
        group: "US Federal Holidays",
        calc: (y) => nthWeekdayOfMonth(y, 10, 4, 4),
        aliases: ["thanksgiving day"],
    },
    "christmas": {
        group: "US Federal Holidays",
        calc: (y) => (0, obsidian_1.moment)(new Date(y, 11, 25)),
        aliases: ["christmas day"],
    },
    // US Cultural Holidays
    "valentine's day": { group: "US Cultural Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 1, 14)) },
    "halloween": { group: "US Cultural Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 9, 31)) },
    "new year's eve": { group: "US Cultural Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 11, 31)) },
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
    "canada day": { group: "Canadian Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 6, 1)) },
    "victoria day": { group: "Canadian Federal Holidays", calc: (y) => weekdayOnOrBefore(y, 4, 24, 1) },
    "canadian thanksgiving": {
        group: "Canadian Federal Holidays",
        calc: (y) => nthWeekdayOfMonth(y, 9, 1, 2),
        aliases: ["thanksgiving (canada)", "thanksgiving canada"],
    },
    // UK Bank Holidays
    "boxing day": { group: "UK Bank Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 11, 26)) },
};
