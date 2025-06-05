import { App, Editor, moment, normalizePath, Plugin, PluginSettingTab, DailyNoteSettings, Setting } from "obsidian";
import { BASE_WORDS, WEEKDAYS, HOLIDAY_PHRASES, holidayEnabled, normalizePhrase, phraseToMoment, needsYearAlias, isProperNoun, properCase, formatWord, formatTypedPhrase, PhraseToMomentFunc, HOLIDAYS, GROUP_HOLIDAYS } from "./holidays";
import DDSuggest, { PrefixTrieNode } from "./suggest";

interface DDSettings {
    /** @deprecated Date format is now taken from the daily notes plugin */
    dateFormat?: string;
    acceptKey: "Enter" | "Tab";
    noAliasWithShift: boolean;
    customDates: Record<string, string>;
    holidayGroups: Record<string, boolean>;
    holidayOverrides: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: DDSettings = {
    acceptKey: "Tab",
    noAliasWithShift: false,
    customDates: {},
    holidayGroups: Object.fromEntries(Object.keys(GROUP_HOLIDAYS).map(g => [g, false])),
    holidayOverrides: {},
};


// Main plugin & settings

/**
 * Main plugin class.  Registers the suggestion box and exposes a
 * settings tab so users can customise how dates are formatted and
 * where daily notes are stored.
 */
export default class DynamicDates extends Plugin {
        private static makeNode(): PrefixTrieNode { return { children: new Map(), phrase: null }; }
        settings: DDSettings = DEFAULT_SETTINGS;
        customMap: Record<string, string> = {};
        /** Combined regex built from all phrases */
        combinedRegex: RegExp | null = null;
        regexPhrases: string[] = [];
        phrasesCache: string[] = [];
        /** Trie of phrases keyed by normalised prefix */
        prefixIndex: PrefixTrieNode = DynamicDates.makeNode();
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

