"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
/* ------------------------------------------------------------------ */
/* Phrase helpers                                                     */
/* ------------------------------------------------------------------ */
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
const HOLIDAYS = {
    "new year's day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 0, 1)) },
    "mlk day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 0, 1, 3) },
    "martin luther king jr day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 0, 1, 3) },
    "presidents day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 1, 1, 3) },
    "memorial day": { group: "US Federal Holidays", calc: (y) => lastWeekdayOfMonth(y, 4, 1) },
    "juneteenth": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 5, 19)) },
    "independence day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 6, 4)) },
    "labor day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 8, 1, 1) },
    "columbus day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 9, 1, 2) },
    "veterans day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 10, 11)) },
    "thanksgiving": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 10, 4, 4) },
    "thanksgiving day": { group: "US Federal Holidays", calc: (y) => nthWeekdayOfMonth(y, 10, 4, 4) },
    "christmas": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 11, 25)) },
    "christmas day": { group: "US Federal Holidays", calc: (y) => (0, obsidian_1.moment)(new Date(y, 11, 25)) },
};
const GROUP_HOLIDAYS = {};
for (const [name, def] of Object.entries(HOLIDAYS)) {
    if (!GROUP_HOLIDAYS[def.group])
        GROUP_HOLIDAYS[def.group] = [];
    GROUP_HOLIDAYS[def.group].push(name);
}
const HOLIDAY_PHRASES = Object.keys(HOLIDAYS);
const HOLIDAY_WORDS = Array.from(new Set(HOLIDAY_PHRASES.flatMap((p) => p.split(/\s+/).map((w) => w.toLowerCase()))));
function holidayEnabled(name) {
    const overrides = phraseToMoment.holidayOverrides || {};
    if (name in overrides)
        return overrides[name];
    const groups = phraseToMoment.holidayGroups || {};
    const g = HOLIDAYS[name]?.group;
    if (g && g in groups)
        return groups[g];
    return true;
}
const DEFAULT_SETTINGS = {
    acceptKey: "Tab",
    noAliasWithShift: false,
    customDates: {},
    holidayGroups: Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map(g => [g, true])),
    holidayOverrides: {},
};
function isProperNoun(word) {
    const w = word.toLowerCase();
    return (WEEKDAYS.includes(w) ||
        MONTHS.includes(w) ||
        HOLIDAY_WORDS.includes(w));
}
function properCase(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
function needsYearAlias(phrase) {
    const lower = phrase.toLowerCase().trim();
    if (/^(?:last|next)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/.test(lower)) {
        return true;
    }
    return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*\d{2,4}$/.test(lower);
}
const PHRASES = BASE_WORDS.flatMap((w) => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]).concat(HOLIDAY_PHRASES);
/**
 * Convert a natural-language phrase into a moment date instance.
 *
 * Supported values include "today", "tomorrow", "yesterday",
 * "next Monday", "last Friday" and long month names such as
 * "december 25" or "august 20th".  Abbreviated month names are not
 * recognised.  If the phrase cannot be parsed, `null` is returned.
 */
function phraseToMoment(phrase) {
    const now = (0, obsidian_1.moment)();
    const lower = phrase.toLowerCase().trim();
    const customMap = phraseToMoment.customDates || {};
    if (lower in customMap) {
        const val = customMap[lower];
        const m = (0, obsidian_1.moment)(val, ["MM-DD", "M-D", "MMMM D", "MMM D"], true);
        if (m.isValid()) {
            m.year(now.year());
            if (m.isBefore(now, "day"))
                m.add(1, "year");
            return m;
        }
    }
    for (const [name, def] of Object.entries(HOLIDAYS)) {
        if (!holidayEnabled(name))
            continue;
        const calc = def.calc;
        if (lower === name) {
            let m = calc(now.year());
            if (m.isBefore(now, "day"))
                m = calc(now.year() + 1);
            return m;
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
            return now.clone().add(n * (rel[2].startsWith('week') ? 7 : 1), "day");
    }
    const ago = lower.match(/^(\d+) (day|days|week|weeks) ago$/);
    if (ago) {
        const n = parseInt(ago[1]);
        if (!isNaN(n))
            return now.clone().subtract(n * (ago[2].startsWith('week') ? 7 : 1), "day");
    }
    const mdy = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{2,4})$/i);
    if (mdy) {
        let monthName = mdy[1];
        if (monthName.length <= 3) {
            const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.slice(0, 3));
            monthName = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][idx];
        }
        const dayNum = parseInt(mdy[2]);
        let yearNum = parseInt(mdy[3]);
        if (!isNaN(dayNum) && !isNaN(yearNum)) {
            if (yearNum < 100)
                yearNum += 2000;
            const idx = MONTHS.indexOf(monthName.toLowerCase());
            const target = (0, obsidian_1.moment)(new Date(yearNum, idx, dayNum));
            if (!target.isValid())
                return null;
            return target;
        }
    }
    const lastMd = lower.match(/^last\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}\w*)$/i);
    if (lastMd) {
        let monthName = lastMd[1];
        if (monthName.length <= 3) {
            const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.slice(0, 3));
            monthName = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][idx];
        }
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
        let monthName = md[1];
        if (monthName.length <= 3) {
            const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.slice(0, 3));
            monthName = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][idx];
        }
        const dayNum = parseInt(md[2]);
        if (!isNaN(dayNum)) {
            const target = now.clone().month(monthName).date(dayNum);
            if (!target.isValid())
                return null;
            if (target.isBefore(now, "day"))
                target.add(1, "year");
            return target;
        }
    }
    return null;
}
phraseToMoment.customDates = {};
/* ------------------------------------------------------------------ */
/* Suggest box                                                        */
/* ------------------------------------------------------------------ */
/**
 * Suggest box that proposes dates as the user types natural
 * language expressions.  Selecting a suggestion will replace the
 * typed phrase with a wikilink to the appropriate daily note.
 */
class DDSuggest extends obsidian_1.EditorSuggest {
    plugin;
    _last = [];
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    /**
     * Decide whether a suggestion popup should appear for the word at the
     * current cursor position.
     */
    onTrigger(cursor, editor, _file) {
        const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);
        // Track word positions so we can look back multiple words
        const words = [];
        lineBefore.replace(/\S+/g, (w, off) => {
            words.push({ word: w, offset: off });
            return "";
        });
        if (words.length === 0)
            return null;
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
            if (["l", "la", "las", "last", "n", "ne", "nex", "next"].includes(query))
                continue;
            // for stand-alone phrases (no qualifier) require ≥3 chars
            if (!hasQualifier && query.length < 3)
                continue;
            // must map to a known phrase or a recognised month/day
            if (!all.some((p) => p.startsWith(query)) && !phraseToMoment(query))
                continue;
            return {
                start: { line: cursor.line, ch: startCh },
                end: { line: cursor.line, ch: cursor.ch },
                query: raw,
            };
        }
        return null;
    }
    /**
     * Build the list of suggestion strings that should be shown for the
     * given query.
     */
    getSuggestions(ctx) {
        const q = ctx.query;
        const qLower = q.toLowerCase();
        const direct = phraseToMoment(qLower);
        if (direct) {
            this._last = [direct.format(this.plugin.getDateFormat())];
            return this._last;
        }
        const uniq = new Set();
        for (const p of this.plugin.allPhrases()) {
            if (!p.startsWith(qLower))
                continue;
            const dt = phraseToMoment(p);
            if (dt)
                uniq.add(dt.format(this.plugin.getDateFormat()));
        }
        this._last = [...uniq];
        return this._last;
    }
    /** Render a single entry in the suggestion dropdown. */
    renderSuggestion(value, el) {
        const query = this.context?.query || "";
        let phrase = query.toLowerCase();
        const target = (0, obsidian_1.moment)(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
        const candidates = this.plugin
            .allPhrases()
            .filter((p) => p.startsWith(phrase) &&
            phraseToMoment(p)?.format("YYYY-MM-DD") === target);
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
        }
        const custom = this.plugin.customCanonical(phrase);
        let alias;
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
            const canonical = this.plugin.customCanonical(phrase);
            if (canonical) {
                alias = canonical;
            }
            else {
                const typedWords = query.split(/\s+/);
                const phraseWords = phrase.split(/\s+/);
                alias = phraseWords
                    .map((w, i) => {
                    const t = typedWords[i];
                    if (t) {
                        // exact match preserves user casing
                        if (t.length === w.length && t.toLowerCase() === w.toLowerCase()) {
                            return isProperNoun(w) ? properCase(w) : t;
                        }
                        // typed prefix should keep typed characters
                        if (w.toLowerCase().startsWith(t.toLowerCase())) {
                            if (isProperNoun(w)) {
                                return properCase(w);
                            }
                            return t + w.slice(t.length);
                        }
                    }
                    if (isProperNoun(w))
                        return properCase(w);
                    if (["last", "next"].includes(w.toLowerCase()) && t)
                        return t;
                    return w.replace(/\b\w/g, ch => ch.toUpperCase());
                })
                    .join(" ");
            }
        }
        else {
            const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
            alias = (0, obsidian_1.moment)(target, "YYYY-MM-DD").format(fmt);
        }
        const niceDate = (0, obsidian_1.moment)(target, "YYYY-MM-DD").format("MMMM Do, YYYY");
        el.createDiv({ text: `${niceDate} (${alias})` });
    }
    /**
     * Replace the typed phrase with the selected wikilink and optionally
     * create the daily note on disk.
     */
    selectSuggestion(value, ev) {
        const { editor, start, end, query } = this.context;
        const { settings } = this.plugin;
        /* ----------------------------------------------------------------
           1. Find the canonical phrase that maps to this calendar date
        ----------------------------------------------------------------- */
        const targetDate = (0, obsidian_1.moment)(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
        const candidates = this.plugin.allPhrases().filter(p => p.startsWith(query.toLowerCase()) &&
            phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate);
        let phrase = query.toLowerCase();
        let alias;
        const custom = this.plugin.customCanonical(phrase);
        if (custom) {
            alias = custom;
        }
        else if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
            const canonical = this.plugin.customCanonical(phrase);
            if (canonical) {
                alias = canonical;
            }
            else {
                const typedWords = query.split(/\s+/);
                const phraseWords = phrase.split(/\s+/);
                alias = phraseWords
                    .map((w, i) => {
                    const t = typedWords[i];
                    if (t) {
                        // exact match preserves user casing
                        if (t.length === w.length && t.toLowerCase() === w.toLowerCase()) {
                            return isProperNoun(w) ? properCase(w) : t;
                        }
                        // typed prefix should keep typed characters
                        if (w.toLowerCase().startsWith(t.toLowerCase())) {
                            if (isProperNoun(w)) {
                                return properCase(w);
                            }
                            return t + w.slice(t.length);
                        }
                    }
                    if (isProperNoun(w))
                        return properCase(w);
                    if (["last", "next"].includes(w.toLowerCase()) && t)
                        return t;
                    return w.replace(/\b\w/g, ch => ch.toUpperCase());
                })
                    .join(" ");
            }
        }
        else {
            const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
            alias = (0, obsidian_1.moment)(targetDate, "YYYY-MM-DD").format(fmt);
        }
        /* ----------------------------------------------------------------
           2. Build the wikilink with alias
        ----------------------------------------------------------------- */
        const folder = this.plugin.getDailyFolder();
        const linkPath = (folder ? folder + "/" : "") + value;
        const link = `[[${linkPath}|${alias}]]`;
        /* ----------------------------------------------------------------
           3. Insert, respecting the Shift-modifier behaviour
        ----------------------------------------------------------------- */
        let final = link;
        if (ev && ev.key != null) {
            const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
            if (key && key !== settings.acceptKey)
                return;
            if (ev.shiftKey && settings.noAliasWithShift) {
                final = `[[${linkPath}]]`;
            }
            if (typeof ev.preventDefault === "function") {
                ev.preventDefault();
            }
        }
        editor.replaceRange(final, start, end);
        this.close();
    }
    onKeyDown(ev) {
        if (this.context && ev.key === this.plugin.settings.acceptKey) {
            if (typeof ev.preventDefault === 'function')
                ev.preventDefault();
            const value = this._last[0];
            if (value)
                this.selectSuggestion(value, ev);
            return true;
        }
        return false;
    }
}
/* ------------------------------------------------------------------ */
/* Main plugin & settings                                             */
/* ------------------------------------------------------------------ */
/**
 * Main plugin class.  Registers the suggestion box and exposes a
 * settings tab so users can customise how dates are formatted and
 * where daily notes are stored.
 */
class DynamicDates extends obsidian_1.Plugin {
    settings = DEFAULT_SETTINGS;
    customMap = {};
    refreshHolidayMap() {
        phraseToMoment.holidayGroups = { ...this.settings.holidayGroups };
        phraseToMoment.holidayOverrides = { ...this.settings.holidayOverrides };
    }
    refreshCustomMap() {
        this.customMap = {};
        for (const key of Object.keys(this.settings.customDates || {})) {
            this.customMap[key.toLowerCase()] = key;
        }
        phraseToMoment.customDates = Object.fromEntries(Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]));
    }
    getDailySettings() {
        const mc = this.app.metadataCache;
        if (mc && typeof mc.getDailyNoteSettings === "function") {
            try {
                return mc.getDailyNoteSettings();
            }
            catch { }
        }
        return this.app.internalPlugins?.plugins?.["daily-notes"]?.instance?.options || {};
    }
    getDailyFolder() {
        const daily = this.getDailySettings();
        return daily?.folder || "";
    }
    getDateFormat() {
        const daily = this.getDailySettings();
        return daily?.format || "YYYY-MM-DD";
    }
    allPhrases() {
        const holidays = HOLIDAY_PHRASES.filter(p => this.isHolidayEnabled(p));
        return [
            ...BASE_WORDS.flatMap(w => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]),
            ...holidays,
            ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase()),
        ];
    }
    isHolidayEnabled(name) {
        const override = this.settings.holidayOverrides?.[name];
        if (typeof override === 'boolean')
            return override;
        const g = HOLIDAYS[name]?.group;
        const grp = this.settings.holidayGroups?.[g];
        return grp !== false;
    }
    /** Return the canonical form for a custom phrase, if any. */
    customCanonical(lower) {
        return this.customMap[lower.toLowerCase()] || null;
    }
    async onload() {
        await this.loadSettings();
        const sugg = new DDSuggest(this.app, this);
        this.registerEditorSuggest(sugg);
        this.registerDomEvent(document, 'keydown', (ev) => {
            sugg.onKeyDown(ev);
        });
        this.addSettingTab(new DDSettingTab(this.app, this));
        this.addCommand({
            id: "convert-dates",
            name: "Convert natural-language dates",
            editorCallback: (editor) => {
                const text = editor.getValue();
                editor.setValue(this.convertText(text));
            },
        });
        console.log("Dynamic Dates loaded");
    }
    onunload() {
        console.log("Dynamic Dates unloaded");
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if (!this.settings.customDates)
            this.settings.customDates = {};
        if (!this.settings.holidayGroups)
            this.settings.holidayGroups = Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map(g => [g, true]));
        if (!this.settings.holidayOverrides)
            this.settings.holidayOverrides = {};
        this.refreshCustomMap();
        this.refreshHolidayMap();
    }
    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshCustomMap();
        this.refreshHolidayMap();
    }
    linkForPhrase(phrase) {
        const m = phraseToMoment(phrase);
        if (!m)
            return null;
        const value = m.format(this.getDateFormat());
        const targetDate = m.format("YYYY-MM-DD");
        const custom = this.customCanonical(phrase);
        let alias;
        if (custom) {
            alias = custom;
        }
        else {
            alias = phrase
                .split(/\s+/)
                .map((w) => (isProperNoun(w) ? properCase(w) : w))
                .join(" ");
        }
        const folder = this.getDailyFolder();
        const linkPath = (folder ? folder + "/" : "") + value;
        return `[[${linkPath}|${alias}]]`;
    }
    convertText(text) {
        const phrases = [...this.allPhrases()].sort((a, b) => b.length - a.length);
        for (const p of phrases) {
            const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`\\b${esc}\\b`, "gi");
            text = text.replace(re, (m) => this.linkForPhrase(m) ?? m);
        }
        return text;
    }
}
exports.default = DynamicDates;
/** UI for the plugin settings displayed in Obsidian's settings pane. */
class DDSettingTab extends obsidian_1.PluginSettingTab {
    plugin;
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian_1.Setting(containerEl)
            .setName("Accept key")
            .setDesc("Key used to accept a suggestion")
            .addDropdown((d) => d
            .addOptions({ Tab: "Tab", Enter: "Enter" })
            .setValue(this.plugin.settings.acceptKey)
            .onChange(async (v) => {
            this.plugin.settings.acceptKey = v;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Shift+<key> inserts plain link")
            .addToggle((t) => t
            .setValue(this.plugin.settings.noAliasWithShift)
            .onChange(async (v) => {
            this.plugin.settings.noAliasWithShift = v;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h3", { text: "Holiday groups" });
        Object.entries(GROUP_HOLIDAYS).forEach(([g, list]) => {
            new obsidian_1.Setting(containerEl)
                .setName(g)
                .addToggle(t => t.setValue(this.plugin.settings.holidayGroups[g] ?? true)
                .onChange(async (v) => {
                this.plugin.settings.holidayGroups[g] = v;
                await this.plugin.saveSettings();
                this.display();
            }));
            if (this.plugin.settings.holidayGroups[g] ?? true) {
                list.forEach(h => {
                    new obsidian_1.Setting(containerEl)
                        .setDesc(h)
                        .addToggle(t => t.setValue(this.plugin.settings.holidayOverrides[h] ?? true)
                        .onChange(async (v) => {
                        this.plugin.settings.holidayOverrides[h] = v;
                        await this.plugin.saveSettings();
                    }));
                });
            }
        });
        containerEl.createEl("h3", { text: "Custom date mappings" });
        new obsidian_1.Setting(containerEl)
            .setDesc("Map phrases to fixed dates, e.g. 'Mid Year' → '06-01'")
            .addExtraButton(b => b.setIcon("plus")
            .setTooltip("Add mapping")
            .onClick(() => {
            this.plugin.settings.customDates["New phrase"] = "01-01";
            this.display();
        }));
        Object.entries(this.plugin.settings.customDates).forEach(([p, d]) => {
            let phrase = p;
            let date = d;
            new obsidian_1.Setting(containerEl)
                .addText(t => t.setPlaceholder("Phrase")
                .setValue(phrase)
                .onChange(async (v) => {
                const map = { ...this.plugin.settings.customDates };
                delete map[phrase];
                phrase = v;
                map[phrase] = date;
                this.plugin.settings.customDates = map;
                await this.plugin.saveSettings();
            }))
                .addText(t => t.setPlaceholder("MM-DD")
                .setValue(date)
                .onChange(async (v) => {
                date = v;
                this.plugin.settings.customDates[phrase] = v;
                await this.plugin.saveSettings();
            }))
                .addExtraButton(b => b.setIcon("trash")
                .setTooltip("Remove")
                .onClick(async () => {
                delete this.plugin.settings.customDates[phrase];
                await this.plugin.saveSettings();
                this.display();
            }));
        });
        // A legacy JSON input for custom dates existed here in early
        // versions of the plugin. It has been removed to simplify the
        // settings UI while retaining support for custom phrases via
        // the individual mapping fields above.
    }
}
