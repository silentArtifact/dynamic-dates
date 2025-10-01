"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDSuggest = exports.DynamicDates = exports.DEFAULT_SETTINGS = void 0;
const obsidian_1 = require("obsidian");
const phraseParser_1 = require("../core/phraseParser");
const holidays_1 = require("../core/holidays");
exports.DEFAULT_SETTINGS = {
    acceptKey: "Tab",
    noAliasWithShift: false,
    customDates: {},
    holidayGroups: Object.fromEntries(Object.keys(holidays_1.GROUP_HOLIDAYS).map((g) => [g, false])),
    holidayOverrides: {},
};
class DDSuggest extends obsidian_1.EditorSuggest {
    plugin;
    _last = [];
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onTrigger(cursor, editor, _file) {
        const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);
        let fenced = false;
        for (let i = 0; i <= cursor.line; i++) {
            let line = editor.getLine(i);
            if (i === cursor.line)
                line = line.slice(0, cursor.ch);
            let idx = 0;
            while ((idx = line.indexOf("```", idx)) !== -1) {
                fenced = !fenced;
                idx += 3;
            }
        }
        if (fenced)
            return null;
        if ((lineBefore.split("`").length - 1) % 2 === 1)
            return null;
        const fullLine = editor.getLine(cursor.line);
        const open = fullLine.lastIndexOf("[[", cursor.ch);
        if (open !== -1) {
            const close = fullLine.indexOf("]]", open + 2);
            if (close === -1 || close >= cursor.ch)
                return null;
        }
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
            if (["l", "la", "las", "last", "n", "ne", "nex", "next"].includes(query))
                continue;
            if (!hasQualifier && query.length < 3)
                continue;
            if (!all.some((p) => (0, phraseParser_1.prefixMatch)(p, query)) && !(0, phraseParser_1.phraseToMoment)(query))
                continue;
            return {
                start: { line: cursor.line, ch: startCh },
                end: { line: cursor.line, ch: cursor.ch },
                query: raw,
            };
        }
        return null;
    }
    getSuggestions(ctx) {
        const q = ctx.query;
        const qLower = q.toLowerCase();
        const direct = this.plugin.momentForPhrase
            ? this.plugin.momentForPhrase(qLower)
            : (0, phraseParser_1.phraseToMoment)(qLower);
        if (direct) {
            this._last = [direct.format(this.plugin.getDateFormat())];
            return this._last;
        }
        const uniq = new Set();
        const phrases = this.plugin.phrasesForPrefix
            ? this.plugin.phrasesForPrefix(qLower)
            : this.plugin.allPhrases().filter((p) => (0, phraseParser_1.prefixMatch)(p, qLower));
        for (const p of phrases) {
            const dt = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(p)
                : (0, phraseParser_1.phraseToMoment)(p);
            if (dt)
                uniq.add(dt.format(this.plugin.getDateFormat()));
        }
        this._last = [...uniq];
        return this._last;
    }
    renderSuggestion(value, el) {
        const query = this.context?.query || "";
        let phrase = query.toLowerCase();
        const target = (0, obsidian_1.moment)(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
        const candidates = this.plugin
            .allPhrases()
            .filter((p) => {
            const m = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(p)
                : (0, phraseParser_1.phraseToMoment)(p);
            return (0, phraseParser_1.prefixMatch)(p, phrase) && m?.format("YYYY-MM-DD") === target;
        });
        if (!candidates.length && (0, holidays_1.isHolidayQualifier)(phrase)) {
            const m = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(phrase)
                : (0, phraseParser_1.phraseToMoment)(phrase);
            if (m && m.format("YYYY-MM-DD") === target) {
                candidates.push(phrase);
            }
        }
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
        }
        const alias = this.plugin.buildAlias(phrase, query);
        const niceDate = (0, obsidian_1.moment)(target, "YYYY-MM-DD").format("MMMM Do, YYYY");
        el.createDiv({ text: `${niceDate} (${alias})` });
    }
    async selectSuggestion(value, ev) {
        const { editor, start, end, query } = this.context;
        const { settings } = this.plugin;
        const targetDate = (0, obsidian_1.moment)(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
        const candidates = this.plugin.allPhrases().filter((p) => (0, phraseParser_1.prefixMatch)(p, query.toLowerCase()) &&
            (0, phraseParser_1.phraseToMoment)(p)?.format("YYYY-MM-DD") === targetDate);
        if (!candidates.length && (0, holidays_1.isHolidayQualifier)(query.toLowerCase())) {
            const m = (0, phraseParser_1.phraseToMoment)(query.toLowerCase());
            if (m && m.format("YYYY-MM-DD") === targetDate) {
                candidates.push(query.toLowerCase());
            }
        }
        let phrase = query.toLowerCase();
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
        }
        const alias = this.plugin.buildAlias(phrase, query);
        let final = `[[${value}|${alias}]]`;
        if (ev instanceof KeyboardEvent) {
            const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
            if (key && key !== settings.acceptKey)
                return;
            if (ev.shiftKey && settings.noAliasWithShift) {
                final = `[[${value}]]`;
            }
            if (typeof ev.preventDefault === "function")
                ev.preventDefault();
            if (typeof ev.stopPropagation === "function")
                ev.stopPropagation();
        }
        editor.replaceRange(final, start, end);
        this.close();
    }
    onKeyDown(ev) {
        if (this.context && ev.key === this.plugin.settings.acceptKey) {
            if (typeof ev.preventDefault === "function")
                ev.preventDefault();
            if (typeof ev.stopPropagation === "function")
                ev.stopPropagation();
            const value = this._last[0];
            if (value)
                void this.selectSuggestion(value, ev);
            return true;
        }
        return false;
    }
}
exports.DDSuggest = DDSuggest;
class DynamicDates extends obsidian_1.Plugin {
    static makeNode() {
        return { children: new Map(), phrase: null };
    }
    settings = exports.DEFAULT_SETTINGS;
    customMap = {};
    combinedRegex = null;
    regexPhrases = [];
    phrasesCache = [];
    prefixIndex = DynamicDates.makeNode();
    dateCache = new Map();
    constructor(app = {}, manifest = { id: "", name: "", version: "" }) {
        super(app, manifest);
        this.refreshPhrasesCache();
    }
    refreshHolidayMap() {
        phraseParser_1.phraseToMoment.holidayGroups = { ...this.settings.holidayGroups };
        phraseParser_1.phraseToMoment.holidayOverrides = { ...this.settings.holidayOverrides };
        this.refreshPhrasesCache();
        this.refreshRegexCache();
    }
    refreshCustomMap() {
        this.customMap = {};
        for (const key of Object.keys(this.settings.customDates || {})) {
            this.customMap[key.toLowerCase()] = key;
        }
        phraseParser_1.phraseToMoment.customDates = Object.fromEntries(Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]));
        this.refreshPhrasesCache();
        this.refreshRegexCache();
    }
    refreshPhrasesCache() {
        const holidays = holidays_1.HOLIDAY_PHRASES.filter((p) => (0, holidays_1.holidayEnabled)(p));
        const holidayVariants = holidays.flatMap((h) => [h, `last ${h}`, `next ${h}`]);
        this.phrasesCache = [
            ...phraseParser_1.BASE_WORDS.flatMap((w) => (phraseParser_1.WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w])),
            ...holidayVariants,
            ...Object.keys(this.settings.customDates || {}).map((p) => p.toLowerCase()),
        ];
        this.buildPrefixIndex();
    }
    buildPrefixIndex() {
        this.prefixIndex = DynamicDates.makeNode();
        for (const phrase of this.phrasesCache) {
            const norm = (0, phraseParser_1.normalizePhrase)(phrase);
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
        const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
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
        const key = (0, phraseParser_1.normalizePhrase)(query);
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
    momentForPhrase(phrase) {
        const key = `${(0, phraseParser_1.normalizePhrase)(phrase)}|${(0, obsidian_1.moment)().format("YYYY-MM-DD")}`;
        let m = this.dateCache.get(key);
        if (!m) {
            const calc = (0, phraseParser_1.phraseToMoment)(phrase);
            if (!calc)
                return null;
            m = calc.clone();
            this.dateCache.set(key, m);
        }
        return m.clone();
    }
    customCanonical(lower) {
        return this.customMap[lower.toLowerCase()] || null;
    }
    buildAlias(phrase, typed) {
        const canonical = this.customCanonical(phrase);
        if (canonical)
            return canonical;
        const target = this.momentForPhrase ? this.momentForPhrase(phrase) : (0, phraseParser_1.phraseToMoment)(phrase);
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
                    return (0, phraseParser_1.formatWord)(w, t);
                })
                    .join(" ");
            }
            const typedMoment = this.momentForPhrase
                ? this.momentForPhrase(typed.toLowerCase())
                : (0, phraseParser_1.phraseToMoment)(typed.toLowerCase());
            if (typedMoment && !(0, phraseParser_1.needsYearAlias)(typed)) {
                return (0, phraseParser_1.formatTypedPhrase)(typed);
            }
            if (typedMoment && (0, phraseParser_1.needsYearAlias)(typed)) {
                return target.format("MMMM Do, YYYY");
            }
        }
        return phrase
            .split(/\s+/)
            .map((w) => ((0, phraseParser_1.isProperNoun)(w) ? (0, phraseParser_1.properCase)(w) : w))
            .join(" ");
    }
    async onload() {
        await this.loadSettings();
        const sugg = new DDSuggest(this.app, this);
        this.registerEditorSuggest(sugg);
        this.registerDomEvent(document, "keydown", (ev) => {
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
            data = (await this.loadData()) || {};
        }
        catch (e) {
            console.error("Failed to load settings, using defaults", e);
        }
        this.settings = Object.assign({}, exports.DEFAULT_SETTINGS, data);
        if (!this.settings.customDates)
            this.settings.customDates = {};
        if (!this.settings.holidayGroups)
            this.settings.holidayGroups = Object.fromEntries(Object.keys(holidays_1.GROUP_HOLIDAYS).map((g) => [g, false]));
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
exports.DynamicDates = DynamicDates;
function renderHolidaySettings(plugin, containerEl) {
    containerEl.empty();
    containerEl.createEl("h3", { text: "Holiday groups" });
    Object.entries(holidays_1.GROUP_HOLIDAYS).forEach(([g, list]) => {
        const groupSetting = new obsidian_1.Setting(containerEl)
            .setName(g)
            .addToggle((t) => t
            .setValue(plugin.settings.holidayGroups[g] ?? false)
            .onChange(async (v) => {
            plugin.settings.holidayGroups[g] = v;
            await plugin.saveSettings();
            renderHolidaySettings(plugin, containerEl);
        }));
        groupSetting.settingEl.classList.add("dd-holiday-group");
        if (plugin.settings.holidayGroups[g] ?? false) {
            list.forEach((h) => {
                const now = (0, obsidian_1.moment)();
                let m = holidays_1.HOLIDAYS[h].calc(now.year());
                if (m.isBefore(now, "day"))
                    m = holidays_1.HOLIDAYS[h].calc(now.year() + 1);
                const label = h
                    .split(/\s+/)
                    .map((w) => (0, phraseParser_1.properCase)(w))
                    .join(" ") + ` (${m.format("MMMM Do")})`;
                const subSetting = new obsidian_1.Setting(containerEl)
                    .setName(label)
                    .addToggle((t) => t
                    .setValue(plugin.settings.holidayOverrides[h] ?? true)
                    .onChange(async (v) => {
                    plugin.settings.holidayOverrides[h] = v;
                    await plugin.saveSettings();
                }));
                subSetting.settingEl.classList.add("dd-holiday-sub");
            });
        }
    });
}
class HolidaySettingsModal extends obsidian_1.Modal {
    plugin;
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        renderHolidaySettings(this.plugin, contentEl);
    }
}
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
        new obsidian_1.Setting(containerEl)
            .setName("Holiday settings")
            .setDesc("Enable or disable holiday groups")
            .addButton((b) => b.setButtonText("Open").onClick(() => {
            new HolidaySettingsModal(this.app, this.plugin).open();
        }));
        containerEl.createEl("h3", { text: "Custom date mappings" });
        new obsidian_1.Setting(containerEl)
            .setDesc("Map phrases to fixed dates, e.g. 'Mid Year' → '06-01'")
            .addExtraButton((b) => b
            .setIcon("plus")
            .setTooltip("Add mapping")
            .onClick(() => {
            this.plugin.settings.customDates["New phrase"] = "01-01";
            this.display();
        }));
        Object.entries(this.plugin.settings.customDates).forEach(([p, d]) => {
            let phrase = p;
            let date = d;
            new obsidian_1.Setting(containerEl)
                .addText((t) => t
                .setPlaceholder("Phrase")
                .setValue(phrase)
                .onChange(async (v) => {
                const map = { ...this.plugin.settings.customDates };
                delete map[phrase];
                phrase = v;
                map[phrase] = date;
                this.plugin.settings.customDates = map;
                await this.plugin.saveSettings();
            }))
                .addText((t) => t
                .setPlaceholder("MM-DD")
                .setValue(date)
                .onChange(async (v) => {
                date = v;
                this.plugin.settings.customDates[phrase] = v;
                await this.plugin.saveSettings();
            }))
                .addExtraButton((b) => b
                .setIcon("trash")
                .setTooltip("Remove")
                .onClick(async () => {
                delete this.plugin.settings.customDates[phrase];
                await this.plugin.saveSettings();
                this.display();
            }));
        });
    }
}
exports.default = DynamicDates;
