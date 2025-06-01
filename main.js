"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    dateFormat: "YYYY-MM-DD",
    autoCreate: false,
    acceptKey: "Tab",
    noAliasWithShift: false,
    aliasFormat: "capitalize",
    openOnCreate: false,
    customDates: {},
};
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
const PHRASES = BASE_WORDS.flatMap((w) => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]);
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
            const query = prefix.toLowerCase().trim();
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
                query,
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
        const direct = phraseToMoment(q);
        if (direct) {
            return [direct.format(this.plugin.settings.dateFormat)];
        }
        const uniq = new Set();
        for (const p of this.plugin.allPhrases()) {
            if (!p.startsWith(q))
                continue;
            const dt = phraseToMoment(p);
            if (dt)
                uniq.add(dt.format(this.plugin.settings.dateFormat));
        }
        return [...uniq];
    }
    /** Render a single entry in the suggestion dropdown. */
    renderSuggestion(value, el) {
        let phrase = this.context?.query.toLowerCase() || "";
        const target = (0, obsidian_1.moment)(value, this.plugin.settings.dateFormat).format("YYYY-MM-DD");
        const candidates = this.plugin
            .allPhrases()
            .filter((p) => p.startsWith(phrase) &&
            phraseToMoment(p)?.format("YYYY-MM-DD") === target);
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
        }
        el.createDiv({ text: `${value} (${phrase})` });
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
        const targetDate = (0, obsidian_1.moment)(value, settings.dateFormat).format("YYYY-MM-DD");
        const candidates = this.plugin.allPhrases().filter(p => p.startsWith(query.toLowerCase()) &&
            phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate);
        let phrase = query.toLowerCase();
        let alias;
        if (settings.aliasFormat === "keep") {
            alias = query;
        }
        else if (settings.aliasFormat === "date") {
            alias = (0, obsidian_1.moment)(targetDate, "YYYY-MM-DD").format("MMMM Do");
        }
        else {
            if (candidates.length) {
                phrase = candidates.sort((a, b) => a.length - b.length)[0];
                const typedWords = query.split(/\s+/);
                const phraseWords = phrase.split(/\s+/);
                alias = phraseWords
                    .map((w, i) => {
                    const t = typedWords[i];
                    if (t &&
                        t.length === w.length &&
                        t.toLowerCase() === w.toLowerCase() &&
                        ["last", "next"].includes(w.toLowerCase())) {
                        return t;
                    }
                    return w.replace(/\b\w/g, ch => ch.toUpperCase());
                })
                    .join(" ");
            }
            else {
                alias = (0, obsidian_1.moment)(targetDate, "YYYY-MM-DD").format("MMMM Do");
            }
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
        /* ----------------------------------------------------------------
           4. Optional auto-create note
        ----------------------------------------------------------------- */
        if (settings.autoCreate &&
            !this.app.vault.getAbstractFileByPath(linkPath + ".md")) {
            const target = linkPath + ".md";
            const folder = this.plugin.getDailyFolder().trim();
            (async () => {
                if (folder &&
                    !this.app.vault.getAbstractFileByPath(folder)) {
                    await this.app.vault.createFolder(folder);
                }
                let tpl = "";
                const daily = this.app.internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
                if (daily?.template) {
                    const f = this.app.vault.getAbstractFileByPath(daily.template);
                    if (f)
                        tpl = await this.app.vault.read(f);
                }
                await this.app.vault.create(target, tpl);
                if (settings.openOnCreate && this.app.workspace?.openLinkText) {
                    this.app.workspace.openLinkText(target, "", false);
                }
            })();
        }
        this.close();
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
    getDailyFolder() {
        const daily = this.app.internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
        return daily?.folder || "";
    }
    allPhrases() {
        return [...PHRASES, ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase())];
    }
    async onload() {
        await this.loadSettings();
        this.registerEditorSuggest(new DDSuggest(this.app, this));
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
        const daily = this.app.internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
        if (daily && !this.settings.dateFormat)
            this.settings.dateFormat = daily.format;
        if (!this.settings.customDates)
            this.settings.customDates = {};
        phraseToMoment.customDates = Object.fromEntries(Object.entries(this.settings.customDates).map(([k, v]) => [k.toLowerCase(), v]));
    }
    async saveSettings() {
        await this.saveData(this.settings);
        phraseToMoment.customDates = Object.fromEntries(Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]));
    }
    linkForPhrase(phrase) {
        const m = phraseToMoment(phrase);
        if (!m)
            return null;
        const value = m.format(this.settings.dateFormat);
        const targetDate = m.format("YYYY-MM-DD");
        let alias;
        if (this.settings.aliasFormat === "keep") {
            alias = phrase;
        }
        else if (this.settings.aliasFormat === "date") {
            alias = m.format("MMMM Do");
        }
        else {
            const typedWords = phrase.split(/\s+/);
            const phraseWords = phrase.split(/\s+/);
            alias = phraseWords
                .map((w, i) => {
                const t = typedWords[i];
                if (t &&
                    t.length === w.length &&
                    t.toLowerCase() === w.toLowerCase() &&
                    ["last", "next"].includes(w.toLowerCase())) {
                    return t;
                }
                return w.replace(/\b\w/g, ch => ch.toUpperCase());
            })
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
            text = text.replace(re, (m) => this.linkForPhrase(m.toLowerCase()) ?? m);
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
            .setName("Date format")
            .setDesc("Format used when inserting dates")
            .addDropdown((d) => d
            .addOptions({
            "YYYY-MM-DD": "YYYY-MM-DD",
            "DD-MM-YYYY": "DD-MM-YYYY",
            "MM-DD-YYYY": "MM-DD-YYYY",
            "YYYY/MM/DD": "YYYY/MM/DD",
        })
            .setValue(this.plugin.settings.dateFormat)
            .onChange(async (v) => {
            this.plugin.settings.dateFormat = v;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Create note if missing")
            .addToggle((t) => t
            .setValue(this.plugin.settings.autoCreate)
            .onChange(async (v) => {
            this.plugin.settings.autoCreate = v;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Open note on creation")
            .addToggle((t) => t
            .setValue(this.plugin.settings.openOnCreate)
            .onChange(async (v) => {
            this.plugin.settings.openOnCreate = v;
            await this.plugin.saveSettings();
        }));
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
        new obsidian_1.Setting(containerEl)
            .setName("Alias style")
            .setDesc("How the alias part of links is formatted")
            .addDropdown((d) => d
            .addOptions({
            capitalize: "Capitalize phrase",
            keep: "Keep typed text",
            date: "Format as date",
        })
            .setValue(this.plugin.settings.aliasFormat)
            .onChange(async (v) => {
            this.plugin.settings.aliasFormat = v;
            await this.plugin.saveSettings();
        }));
        containerEl.createDiv({ text: "Custom date mappings" });
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
                .addExtraButton(b => b.onClick(async () => {
                delete this.plugin.settings.customDates[phrase];
                await this.plugin.saveSettings();
                this.display();
            }));
        });
        new obsidian_1.Setting(containerEl)
            .addButton(b => b.setButtonText("Add")
            .onClick(() => {
            this.plugin.settings.customDates["New phrase"] = "01-01";
            this.display();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Custom dates (JSON)")
            .addText((t) => t
            .setPlaceholder('{"phrase":"MM-DD"}')
            .setValue(JSON.stringify(this.plugin.settings.customDates))
            .onChange(async (v) => {
            try {
                this.plugin.settings.customDates = JSON.parse(v || '{}');
            }
            catch { }
            await this.plugin.saveSettings();
        }));
    }
}
