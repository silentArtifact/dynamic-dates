import {
        App,
        DailyNoteSettings,
        Editor,
        EditorPosition,
        EditorSuggest,
        EditorSuggestContext,
        EditorSuggestTriggerInfo,
        Modal,
        Plugin,
        PluginSettingTab,
        Setting,
        TFile,
        moment,
        normalizePath,
} from "obsidian";

import {
        BASE_WORDS,
        WEEKDAYS,
        formatTypedPhrase,
        formatWord,
        isProperNoun,
        needsYearAlias,
        normalizePhrase,
        phraseToMoment,
        prefixMatch,
        properCase,
        PhraseToMomentFunc,
} from "../core/phraseParser";
import {
        GROUP_HOLIDAYS,
        HOLIDAYS,
        HOLIDAY_PHRASES,
        holidayEnabled,
        isHolidayQualifier,
} from "../core/holidays";

export interface DDSettings {
        /** @deprecated Date format is now taken from the daily notes plugin */
        dateFormat?: string;
        acceptKey: "Enter" | "Tab";
        noAliasWithShift: boolean;
        customDates: Record<string, string>;
        holidayGroups: Record<string, boolean>;
        holidayOverrides: Record<string, boolean>;
}

export interface PluginManifest {
        id: string;
        name: string;
        version: string;
        [key: string]: unknown;
}

export const DEFAULT_SETTINGS: DDSettings = {
        acceptKey: "Tab",
        noAliasWithShift: false,
        customDates: {},
        holidayGroups: Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map((g) => [g, false])),
        holidayOverrides: {},
};

class DDSuggest extends EditorSuggest<string> {
        plugin: DynamicDates;
        private _last: string[] = [];
        constructor(app: App, plugin: DynamicDates) {
                super(app);
                this.plugin = plugin;
        }

        onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile): EditorSuggestTriggerInfo | null {
                const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);

                let fenced = false;
                for (let i = 0; i <= cursor.line; i++) {
                        let line = editor.getLine(i);
                        if (i === cursor.line) line = line.slice(0, cursor.ch);
                        let idx = 0;
                        while ((idx = line.indexOf("```", idx)) !== -1) {
                                fenced = !fenced;
                                idx += 3;
                        }
                }
                if (fenced) return null;

                if ((lineBefore.split("`").length - 1) % 2 === 1) return null;

                const fullLine = editor.getLine(cursor.line);
                const open = fullLine.lastIndexOf("[[", cursor.ch);
                if (open !== -1) {
                        const close = fullLine.indexOf("]]", open + 2);
                        if (close === -1 || close >= cursor.ch) return null;
                }

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

                        if (["l", "la", "las", "last", "n", "ne", "nex", "next"].includes(query)) continue;

                        if (!hasQualifier && query.length < 3) continue;

                        if (!all.some((p) => prefixMatch(p, query)) && !phraseToMoment(query)) continue;

                        return {
                                start: { line: cursor.line, ch: startCh },
                                end: { line: cursor.line, ch: cursor.ch },
                                query: raw,
                        };
                }

                return null;
        }

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
                        : this.plugin.allPhrases().filter((p) => prefixMatch(p, qLower));
                for (const p of phrases) {
                        const dt = (this.plugin as any).momentForPhrase
                                ? (this.plugin as any).momentForPhrase(p)
                                : phraseToMoment(p);
                        if (dt) uniq.add(dt.format(this.plugin.getDateFormat()));
                }
                this._last = [...uniq];
                return this._last;
        }

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

        async selectSuggestion(value: string, ev: KeyboardEvent | MouseEvent) {
                const { editor, start, end, query } = this.context!;
                const { settings } = this.plugin;
                const targetDate = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");

                const candidates = this.plugin.allPhrases().filter(
                        (p) =>
                                prefixMatch(p, query.toLowerCase()) &&
                                phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate,
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
                let final = `[[${value}|${alias}]]`;

                if (ev instanceof KeyboardEvent) {
                        const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
                        if (key && key !== settings.acceptKey) return;
                        if (ev.shiftKey && settings.noAliasWithShift) {
                                final = `[[${value}]]`;
                        }
                        if (typeof ev.preventDefault === "function") ev.preventDefault();
                        if (typeof ev.stopPropagation === "function") ev.stopPropagation();
                }

                editor.replaceRange(final, start, end);

                this.close();
        }

        onKeyDown(ev: KeyboardEvent): boolean {
                if (this.context && ev.key === this.plugin.settings.acceptKey) {
                        if (typeof ev.preventDefault === "function") ev.preventDefault();
                        if (typeof ev.stopPropagation === "function") ev.stopPropagation();
                        const value = this._last[0];
                        if (value) void this.selectSuggestion(value, ev);
                        return true;
                }
                return false;
        }
}

interface PrefixTrieNode {
        children: Map<string, PrefixTrieNode>;
        phrase: string | null;
}

export class DynamicDates extends Plugin {
        private static makeNode(): PrefixTrieNode {
                return { children: new Map(), phrase: null };
        }

        settings: DDSettings = DEFAULT_SETTINGS;
        customMap: Record<string, string> = {};
        combinedRegex: RegExp | null = null;
        regexPhrases: string[] = [];
        phrasesCache: string[] = [];
        prefixIndex: PrefixTrieNode = DynamicDates.makeNode();
        dateCache: Map<string, moment.Moment> = new Map();

        constructor(app: App = {} as App, manifest: PluginManifest = { id: "", name: "", version: "" }) {
                super(app, manifest);
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
                const holidays = HOLIDAY_PHRASES.filter((p) => holidayEnabled(p));
                const holidayVariants = holidays.flatMap((h) => [h, `last ${h}`, `next ${h}`]);
                this.phrasesCache = [
                        ...BASE_WORDS.flatMap((w) => (WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w])),
                        ...holidayVariants,
                        ...Object.keys(this.settings.customDates || {}).map((p) => p.toLowerCase()),
                ];
                this.buildPrefixIndex();
        }

        private buildPrefixIndex(): void {
                this.prefixIndex = DynamicDates.makeNode();
                for (const phrase of this.phrasesCache) {
                        const norm = normalizePhrase(phrase);
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

        refreshRegexCache(): void {
                const phrases = [...this.phrasesCache].sort((a, b) => b.length - a.length);
                this.regexPhrases = phrases;
                const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
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
                let node = this.prefixIndex;
                for (const ch of key) {
                        const next = node.children.get(ch);
                        if (!next) return [];
                        node = next;
                }
                const out: string[] = [];
                const stack: PrefixTrieNode[] = node ? [node] : [];
                while (stack.length) {
                        const n = stack.pop()!;
                        if (n.phrase) out.push(n.phrase);
                        for (const child of n.children.values()) stack.push(child);
                }
                return out;
        }

        momentForPhrase(phrase: string): moment.Moment | null {
                const key = `${normalizePhrase(phrase)}|${moment().format("YYYY-MM-DD")}`;
                let m = this.dateCache.get(key);
                if (!m) {
                        const calc = phraseToMoment(phrase);
                        if (!calc) return null;
                        m = calc.clone();
                        this.dateCache.set(key, m);
                }
                return m.clone();
        }

        customCanonical(lower: string): string | null {
                return this.customMap[lower.toLowerCase()] || null;
        }

        buildAlias(phrase: string, typed: string): string {
                const canonical = this.customCanonical(phrase);
                if (canonical) return canonical;

                const target = (this as any).momentForPhrase ? (this as any).momentForPhrase(phrase) : phraseToMoment(phrase);
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
                this.registerDomEvent(
                        document,
                        "keydown",
                        (ev: KeyboardEvent) => {
                                sugg.onKeyDown(ev);
                        },
                        { capture: true },
                );
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
                let data: Partial<DDSettings> = {};
                try {
                        data = ((await this.loadData()) as any) || {};
                } catch (e) {
                        console.error("Failed to load settings, using defaults", e);
                }
                this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
                if (!this.settings.customDates) this.settings.customDates = {};
                if (!this.settings.holidayGroups)
                        this.settings.holidayGroups = Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map((g) => [g, false]));
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
                        while (
                                j < text.length &&
                                !text.startsWith("```", j) &&
                                text[j] !== "`" &&
                                !text.startsWith("[[", j)
                        ) {
                                j++;
                        }
                        const seg = text.slice(i, j);
                        parts.push(replace(seg));
                        i = j;
                }

                return parts.join("");
        }
}

function renderHolidaySettings(plugin: DynamicDates, containerEl: HTMLElement): void {
        containerEl.empty();
        (containerEl as any).createEl("h3", { text: "Holiday groups" });
        Object.entries(GROUP_HOLIDAYS).forEach(([g, list]) => {
                const groupSetting = new Setting(containerEl)
                        .setName(g)
                        .addToggle((t) =>
                                t
                                        .setValue(plugin.settings.holidayGroups[g] ?? false)
                                        .onChange(async (v: boolean) => {
                                                plugin.settings.holidayGroups[g] = v;
                                                await plugin.saveSettings();
                                                renderHolidaySettings(plugin, containerEl);
                                        }),
                        );
                (groupSetting as any).settingEl.classList.add("dd-holiday-group");
                if (plugin.settings.holidayGroups[g] ?? false) {
                        list.forEach((h) => {
                                const now = moment();
                                let m = HOLIDAYS[h].calc(now.year());
                                if (m.isBefore(now, "day")) m = HOLIDAYS[h].calc(now.year() + 1);
                                const label =
                                        h
                                                .split(/\s+/)
                                                .map((w) => properCase(w))
                                                .join(" ") + ` (${m.format("MMMM Do")})`;
                                const subSetting = new Setting(containerEl)
                                        .setName(label)
                                        .addToggle((t) =>
                                                t
                                                        .setValue(plugin.settings.holidayOverrides[h] ?? true)
                                                        .onChange(async (v: boolean) => {
                                                                plugin.settings.holidayOverrides[h] = v;
                                                                await plugin.saveSettings();
                                                        }),
                                        );
                                (subSetting as any).settingEl.classList.add("dd-holiday-sub");
                        });
                }
        });
}

class HolidaySettingsModal extends Modal {
        plugin: DynamicDates;
        constructor(app: App, plugin: DynamicDates) {
                super(app);
                this.plugin = plugin;
        }
        onOpen(): void {
                const { contentEl } = this as any;
                contentEl.empty();
                renderHolidaySettings(this.plugin, contentEl);
        }
}

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

                new Setting(containerEl)
                        .setName("Holiday settings")
                        .setDesc("Enable or disable holiday groups")
                        .addButton((b) =>
                                b.setButtonText("Open").onClick(() => {
                                        new HolidaySettingsModal(this.app, this.plugin).open();
                                }),
                        );

                (containerEl as any).createEl("h3", { text: "Custom date mappings" });
                new Setting(containerEl)
                        .setDesc("Map phrases to fixed dates, e.g. 'Mid Year' → '06-01'")
                        .addExtraButton((b) =>
                                b
                                        .setIcon("plus")
                                        .setTooltip("Add mapping")
                                        .onClick(() => {
                                                this.plugin.settings.customDates["New phrase"] = "01-01";
                                                this.display();
                                        }),
                        );
                Object.entries(this.plugin.settings.customDates).forEach(([p, d]) => {
                        let phrase = p;
                        let date = d;
                        new Setting(containerEl)
                                .addText((t) =>
                                        t
                                                .setPlaceholder("Phrase")
                                                .setValue(phrase)
                                                .onChange(async (v: string) => {
                                                        const map = { ...this.plugin.settings.customDates };
                                                        delete map[phrase];
                                                        phrase = v;
                                                        map[phrase] = date;
                                                        this.plugin.settings.customDates = map;
                                                        await this.plugin.saveSettings();
                                                }),
                                )
                                .addText((t) =>
                                        t
                                                .setPlaceholder("MM-DD")
                                                .setValue(date)
                                                .onChange(async (v: string) => {
                                                        date = v;
                                                        this.plugin.settings.customDates[phrase] = v;
                                                        await this.plugin.saveSettings();
                                                }),
                                )
                                .addExtraButton((b) =>
                                        b
                                                .setIcon("trash")
                                                .setTooltip("Remove")
                                                .onClick(async () => {
                                                        delete this.plugin.settings.customDates[phrase];
                                                        await this.plugin.saveSettings();
                                                        this.display();
                                                }),
                                );
                });
        }
}

export { DDSuggest };
export default DynamicDates;
