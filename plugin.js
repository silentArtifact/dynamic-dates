"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
const obsidian_1 = require("obsidian");
const holidays_1 = require("./holidays");
const suggest_1 = __importDefault(require("./suggest"));
exports.DEFAULT_SETTINGS = {
    acceptKey: "Tab",
    noAliasWithShift: false,
    customDates: {},
    holidayGroups: Object.fromEntries(Object.keys(holidays_1.GROUP_HOLIDAYS).map(g => [g, false])),
    holidayOverrides: {},
};
// Main plugin & settings
/**
 * Main plugin class.  Registers the suggestion box and exposes a
 * settings tab so users can customise how dates are formatted and
 * where daily notes are stored.
 */
class DynamicDates extends obsidian_1.Plugin {
    static makeNode() { return { children: new Map(), phrase: null }; }
    settings = exports.DEFAULT_SETTINGS;
    customMap = {};
    /** Combined regex built from all phrases */
    combinedRegex = null;
    regexPhrases = [];
    phrasesCache = [];
    /** Trie of phrases keyed by normalised prefix */
    prefixIndex = DynamicDates.makeNode();
    /** Cache of phrase -> moment keyed by phrase+date */
    dateCache = new Map();
    constructor(app, manifest) {
        super(app, manifest);
        this.refreshPhrasesCache();
    }
    refreshHolidayMap() {
        holidays_1.phraseToMoment.holidayGroups = { ...this.settings.holidayGroups };
        holidays_1.phraseToMoment.holidayOverrides = { ...this.settings.holidayOverrides };
        this.refreshPhrasesCache();
        this.refreshRegexCache();
    }
    refreshCustomMap() {
        this.customMap = {};
        for (const key of Object.keys(this.settings.customDates || {})) {
            this.customMap[key.toLowerCase()] = key;
        }
        holidays_1.phraseToMoment.customDates = Object.fromEntries(Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]));
        this.refreshPhrasesCache();
        this.refreshRegexCache();
    }
    refreshPhrasesCache() {
        const holidays = holidays_1.HOLIDAY_PHRASES.filter(p => (0, holidays_1.holidayEnabled)(p));
        const holidayVariants = holidays.flatMap(h => [h, `last ${h}`, `next ${h}`]);
        this.phrasesCache = [
            ...holidays_1.BASE_WORDS.flatMap(w => holidays_1.WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]),
            ...holidayVariants,
            ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase()),
        ];
        this.buildPrefixIndex();
    }
    buildPrefixIndex() {
        this.prefixIndex = DynamicDates.makeNode();
        for (const phrase of this.phrasesCache) {
            const norm = (0, holidays_1.normalizePhrase)(phrase);
            let node = this.prefixIndex;
            for (const ch of norm) {
                let child = node.children.get(ch);
                if (!child) {
                    child = DynamicDates.makeNode();
                    node.children.set(ch, child);
                }
                node = child;
            }
            node.phrase = phrase;
        }
    }
    refreshRegexCache() {
        const phrases = [...this.phrasesCache].sort((a, b) => b.length - a.length);
        this.regexPhrases = phrases;
        const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        if (escaped.length) {
            const pattern = `\\b(?:${escaped.join("|")})\\b`;
            this.combinedRegex = new RegExp(pattern, "gi");
        }
        else {
            this.combinedRegex = null;
        }
    }
    getDailySettings() {
        const mc = this.app.metadataCache;
        if (mc && typeof mc.getDailyNoteSettings === "function") {
            try {
                return mc.getDailyNoteSettings();
            }
            catch { }
        }
        const dn = this.app.internalPlugins?.plugins?.["daily-notes"];
        return dn?.instance?.options || dn?.options || {};
    }
    getDailyFolder() {
        const daily = this.getDailySettings();
        if (!daily?.folder)
            return "";
        return (0, obsidian_1.normalizePath)(daily.folder);
    }
    getDateFormat() {
        const daily = this.getDailySettings();
        return daily?.format || "YYYY-MM-DD";
    }
    allPhrases() {
        return this.phrasesCache;
    }
    phrasesForPrefix(query) {
        const key = (0, holidays_1.normalizePhrase)(query);
        let node = this.prefixIndex;
        for (const ch of key) {
            const next = node.children.get(ch);
            if (!next)
                return [];
            node = next;
        }
        const out = [];
        const stack = node ? [node] : [];
        while (stack.length) {
            const n = stack.pop();
            if (n.phrase)
                out.push(n.phrase);
            for (const child of n.children.values())
                stack.push(child);
        }
        return out;
    }
    /** Retrieve a moment for the phrase with caching */
    momentForPhrase(phrase) {
        const key = `${(0, holidays_1.normalizePhrase)(phrase)}|${(0, obsidian_1.moment)().format('YYYY-MM-DD')}`;
        let m = this.dateCache.get(key);
        if (!m) {
            const calc = (0, holidays_1.phraseToMoment)(phrase);
            if (!calc)
                return null;
            m = calc.clone();
            this.dateCache.set(key, m);
        }
        return m.clone();
    }
    /** Return the canonical form for a custom phrase, if any. */
    customCanonical(lower) {
        return this.customMap[lower.toLowerCase()] || null;
    }
    /**
     * Generate the alias text for a wikilink. The `phrase` parameter
     * should be the canonical phrase that maps to the target date and
     * `typed` is the raw text typed by the user.  Pass an empty string
     * for `typed` when no user input should influence casing.
     */
    buildAlias(phrase, typed) {
        const canonical = this.customCanonical(phrase);
        if (canonical)
            return canonical;
        const target = this.momentForPhrase
            ? this.momentForPhrase(phrase)
            : (0, holidays_1.phraseToMoment)(phrase);
        if (!target)
            return typed;
        if (typed) {
            if (typed.toLowerCase() !== phrase) {
                const typedWords = typed.split(/\s+/);
                const phraseWords = phrase.split(/\s+/);
                return phraseWords
                    .map((w, i) => {
                    const t = typedWords[i];
                    if (["last", "next"].includes(w.toLowerCase()) && t)
                        return t;
                    return (0, holidays_1.formatWord)(w, t);
                })
                    .join(" ");
            }
            const typedMoment = this.momentForPhrase
                ? this.momentForPhrase(typed.toLowerCase())
                : (0, holidays_1.phraseToMoment)(typed.toLowerCase());
            if (typedMoment && !(0, holidays_1.needsYearAlias)(typed)) {
                return (0, holidays_1.formatTypedPhrase)(typed);
            }
            if (typedMoment && (0, holidays_1.needsYearAlias)(typed)) {
                return target.format("MMMM Do, YYYY");
            }
        }
        return phrase
            .split(/\s+/)
            .map((w) => ((0, holidays_1.isProperNoun)(w) ? (0, holidays_1.properCase)(w) : w))
            .join(" ");
    }
    async onload() {
        await this.loadSettings();
        const sugg = new suggest_1.default(this.app, this);
        this.registerEditorSuggest(sugg);
        this.registerDomEvent(document, 'keydown', (ev) => {
            sugg.onKeyDown(ev);
        }, { capture: true });
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
        let data = {};
        try {
            data = await this.loadData() || {};
        }
        catch (e) {
            console.error('Failed to load settings, using defaults', e);
        }
        this.settings = Object.assign({}, exports.DEFAULT_SETTINGS, data);
        if (!this.settings.customDates)
            this.settings.customDates = {};
        if (!this.settings.holidayGroups)
            this.settings.holidayGroups = Object.fromEntries(Object.keys(holidays_1.GROUP_HOLIDAYS).map(g => [g, false]));
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
        const m = this.momentForPhrase(phrase);
        if (!m)
            return null;
        const value = m.format(this.getDateFormat());
        const alias = this.buildAlias(phrase, "");
        return `[[${value}|${alias}]]`;
    }
    convertText(text) {
        const phrases = [...this.allPhrases()].sort((a, b) => b.length - a.length);
        if (this.regexPhrases.length !== phrases.length || !this.regexPhrases.every((p, i) => p === phrases[i])) {
            this.refreshRegexCache();
        }
        const regex = this.combinedRegex;
        const replace = (seg) => {
            if (!regex)
                return seg;
            return seg.replace(regex, (m) => this.linkForPhrase(m) ?? m);
        };
        const parts = [];
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
exports.default = DynamicDates;
module.exports = DynamicDates;
module.exports.default = DynamicDates;
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
        containerEl.createEl("h3", { text: "Suggestion keys" });
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
        Object.entries(holidays_1.GROUP_HOLIDAYS).forEach(([g, list]) => {
            const groupSetting = new obsidian_1.Setting(containerEl)
                .setName(g)
                .addToggle(t => t.setValue(this.plugin.settings.holidayGroups[g] ?? false)
                .onChange(async (v) => {
                this.plugin.settings.holidayGroups[g] = v;
                await this.plugin.saveSettings();
                this.display();
            }));
            groupSetting.settingEl.classList.add("dd-holiday-group");
            if (this.plugin.settings.holidayGroups[g] ?? false) {
                list.forEach(h => {
                    const now = (0, obsidian_1.moment)();
                    let m = holidays_1.HOLIDAYS[h].calc(now.year());
                    if (m.isBefore(now, "day"))
                        m = holidays_1.HOLIDAYS[h].calc(now.year() + 1);
                    const label = h.split(/\s+/).map(w => (0, holidays_1.properCase)(w)).join(" ") + ` (${m.format("MMMM Do")})`;
                    const subSetting = new obsidian_1.Setting(containerEl)
                        .setName(label)
                        .addToggle(t => t.setValue(this.plugin.settings.holidayOverrides[h] ?? true)
                        .onChange(async (v) => {
                        this.plugin.settings.holidayOverrides[h] = v;
                        await this.plugin.saveSettings();
                    }));
                    subSetting.settingEl.classList.add("dd-holiday-sub");
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
    }
}
