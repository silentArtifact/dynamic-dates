import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	moment,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

interface DDSettings {
        /** @deprecated Date format is now taken from the daily notes plugin */
        dateFormat?: string;
        acceptKey: "Enter" | "Tab";
        noAliasWithShift: boolean;
        aliasFormat: "capitalize" | "keep" | "date";
        customDates: Record<string, string>;
}

const DEFAULT_SETTINGS: DDSettings = {
        acceptKey: "Tab",
        noAliasWithShift: false,
        aliasFormat: "capitalize",
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

function isProperNoun(word: string): boolean {
        const w = word.toLowerCase();
        return WEEKDAYS.includes(w) || MONTHS.includes(w);
}

function properCase(word: string): string {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function needsYearAlias(phrase: string): boolean {
        const lower = phrase.toLowerCase().trim();
        if (/^(?:last|next)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/.test(lower)) {
                return true;
        }
        return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*\d{2,4}$/.test(lower);
}

const PHRASES = BASE_WORDS.flatMap((w) =>
        WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w],
);


/**
 * Convert a natural-language phrase into a moment date instance.
 *
 * Supported values include "today", "tomorrow", "yesterday",
 * "next Monday", "last Friday" and long month names such as
 * "december 25" or "august 20th".  Abbreviated month names are not
 * recognised.  If the phrase cannot be parsed, `null` is returned.
 */
function phraseToMoment(phrase: string): moment.Moment | null {
        const now = moment();
        const lower = phrase.toLowerCase().trim();

        const customMap: Record<string,string> = (phraseToMoment as any).customDates || {};
        if (lower in customMap) {
                const val = customMap[lower];
                const m = moment(val, ["MM-DD","M-D","MMMM D","MMM D"], true);
                if (m.isValid()) {
                        m.year(now.year());
                        if (m.isBefore(now, "day")) m.add(1, "year");
                        return m;
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
                let monthName = mdy[1];
                if (monthName.length <= 3) {
                        const idx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthName.slice(0,3));
                        monthName = ["january","february","march","april","may","june","july","august","september","october","november","december"][idx];
                }
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
                let monthName = lastMd[1];
                if (monthName.length <= 3) {
                        const idx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthName.slice(0,3));
                        monthName = ["january","february","march","april","may","june","july","august","september","october","november","december"][idx];
                }
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
                        const idx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthName.slice(0,3));
                        monthName = ["january","february","march","april","may","june","july","august","september","october","november","december"][idx];
                }
                const dayNum = parseInt(md[2]);
                if (!isNaN(dayNum)) {
                        const target = now.clone().month(monthName).date(dayNum);
                        if (!target.isValid()) return null;
                        if (target.isBefore(now, "day")) target.add(1, "year");
                        return target;
                }
        }
        return null;
}

(phraseToMoment as any).customDates = {};

/* ------------------------------------------------------------------ */
/* Suggest box                                                        */
/* ------------------------------------------------------------------ */

/**
 * Suggest box that proposes dates as the user types natural
 * language expressions.  Selecting a suggestion will replace the
 * typed phrase with a wikilink to the appropriate daily note.
 */
class DDSuggest extends EditorSuggest<string> {
        plugin: DynamicDates;
        private _last: string[] = [];
        constructor(app: App, plugin: DynamicDates) {
                super(app);
                this.plugin = plugin;
        }

        /**
         * Decide whether a suggestion popup should appear for the word at the
         * current cursor position.
         */
        onTrigger(
                cursor: EditorPosition,
                editor: Editor,
                _file: TFile,
        ): EditorSuggestTriggerInfo | null {
                const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);

                // Track word positions so we can look back multiple words
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

                        // never pop on bare/partial "last" / "next"
                        if (["l","la","las","last","n","ne","nex","next"].includes(query))
                                continue;

                        // for stand-alone phrases (no qualifier) require ≥3 chars
                        if (!hasQualifier && query.length < 3) continue;

                        // must map to a known phrase or a recognised month/day
                        if (!all.some((p) => p.startsWith(query)) && !phraseToMoment(query))
                                continue;

                        return {
                                start: { line: cursor.line, ch: startCh },
                                end:   { line: cursor.line, ch: cursor.ch },
                                query: raw,
                        };
                }

                return null;
        }

        /**
         * Build the list of suggestion strings that should be shown for the
         * given query.
         */
        getSuggestions(ctx: EditorSuggestContext): string[] {
                const q = ctx.query;
                const qLower = q.toLowerCase();

                const direct = phraseToMoment(qLower);
                if (direct) {
                        this._last = [direct.format(this.plugin.getDateFormat())];
                        return this._last;
                }

                const uniq = new Set<string>();
                for (const p of this.plugin.allPhrases()) {
                        if (!p.startsWith(qLower)) continue;
                        const dt = phraseToMoment(p);
                        if (dt) uniq.add(dt.format(this.plugin.getDateFormat()));
                }
                this._last = [...uniq];
                return this._last;
        }

        /** Render a single entry in the suggestion dropdown. */
        renderSuggestion(value: string, el: HTMLElement) {
                const query = this.context?.query || "";
                let phrase = query.toLowerCase();
                const target = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
                const candidates = this.plugin
                        .allPhrases()
                        .filter((p) =>
                                p.startsWith(phrase) &&
                                phraseToMoment(p)?.format("YYYY-MM-DD") === target,
                        );
                if (candidates.length) {
                        phrase = candidates.sort((a, b) => a.length - b.length)[0];
                }

                const settings = this.plugin.settings;
                const custom = this.plugin.customCanonical(phrase);
                let alias: string;

                if (settings.aliasFormat === "keep") {
                        alias = custom || query;
                } else if (settings.aliasFormat === "date") {
                        const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
                        alias = moment(target, "YYYY-MM-DD").format(fmt);
                } else {
                        if (candidates.length) {
                                phrase = candidates.sort((a, b) => a.length - b.length)[0];
                                const canonical = this.plugin.customCanonical(phrase);
                                if (canonical) {
                                        alias = canonical;
                                } else {
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
                                                        if (isProperNoun(w)) return properCase(w);
                                                        if (["last", "next"].includes(w.toLowerCase()) && t)
                                                                return t;
                                                        return w.replace(/\b\w/g, ch => ch.toUpperCase());
                                                })
                                                .join(" ");
                                }
                        } else {
                                const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
                                alias = moment(target, "YYYY-MM-DD").format(fmt);
                        }
                }

                const niceDate = moment(target, "YYYY-MM-DD").format("MMMM Do, YYYY");
                el.createDiv({ text: `${niceDate} (${alias})` });
        }

        /**
         * Replace the typed phrase with the selected wikilink and optionally
         * create the daily note on disk.
         */
        selectSuggestion(value: string, ev: KeyboardEvent | MouseEvent) {
                const { editor, start, end, query } = this.context!;
                const { settings } = this.plugin;
	
		/* ----------------------------------------------------------------
		   1. Find the canonical phrase that maps to this calendar date
		----------------------------------------------------------------- */
                const targetDate = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");

                const candidates = this.plugin.allPhrases().filter(p =>
                        p.startsWith(query.toLowerCase()) &&
                        phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate
                );

                let phrase = query.toLowerCase();
                let alias: string;
                const custom = this.plugin.customCanonical(phrase);

                if (settings.aliasFormat === "keep") {
                        alias = custom || query;
                } else if (settings.aliasFormat === "date") {
                        const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
                        alias = moment(targetDate, "YYYY-MM-DD").format(fmt);
                } else {
                        if (candidates.length) {
                                phrase = candidates.sort((a, b) => a.length - b.length)[0];
                                const canonical = this.plugin.customCanonical(phrase);
                                if (canonical) {
                                        alias = canonical;
                                } else {
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
                                                        if (isProperNoun(w)) return properCase(w);
                                                        if (["last", "next"].includes(w.toLowerCase()) && t)
                                                                return t;
                                                        return w.replace(/\b\w/g, ch => ch.toUpperCase());
                                                })
                                                .join(" ");
                                }
                        } else {
                                const fmt = needsYearAlias(query) ? "MMMM Do, YYYY" : "MMMM Do";
                                alias = moment(targetDate, "YYYY-MM-DD").format(fmt);
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
                if (ev && (ev as any).key != null) {
                        const key = (ev as any).key === "Enter" ? "Enter" : (ev as any).key === "Tab" ? "Tab" : "";
                        if (key && key !== settings.acceptKey) return;
                        if ((ev as any).shiftKey && settings.noAliasWithShift) {
                                final = `[[${linkPath}]]`;
                        }
                        if (typeof (ev as any).preventDefault === "function") {
                                (ev as any).preventDefault();
                        }
                }

                editor.replaceRange(
                        final,
                        start,
                        end,
                );


                this.close();
        }

        onKeyDown(ev: KeyboardEvent): boolean {
                if (ev.key === 'Tab' && this.plugin.settings.acceptKey === 'Tab' && this.context) {
                        if (typeof ev.preventDefault === 'function') ev.preventDefault();
                        const list = this._last;
                        const value = list[0];
                        if (value) this.selectSuggestion(value, ev);
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
export default class DynamicDates extends Plugin {
        settings: DDSettings = DEFAULT_SETTINGS;
        customMap: Record<string, string> = {};

        refreshCustomMap(): void {
                this.customMap = {};
                for (const key of Object.keys(this.settings.customDates || {})) {
                        this.customMap[key.toLowerCase()] = key;
                }
                (phraseToMoment as any).customDates = Object.fromEntries(
                        Object.entries(this.settings.customDates || {}).map(([k, v]) => [k.toLowerCase(), v]),
                );
        }

        getDailySettings(): any {
                const mc = (this.app as any).metadataCache;
                if (mc && typeof mc.getDailyNoteSettings === "function") {
                        try {
                                return mc.getDailyNoteSettings();
                        } catch {}
                }
                return (this.app as any).internalPlugins?.plugins?.["daily-notes"]?.instance?.options || {};
        }

        getDailyFolder(): string {
                const daily = this.getDailySettings();
                return daily?.folder || "";
        }

        getDateFormat(): string {
                const daily = this.getDailySettings();
                return daily?.format || "YYYY-MM-DD";
        }

        allPhrases(): string[] {
                return [...PHRASES, ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase())];
        }

        /** Return the canonical form for a custom phrase, if any. */
        customCanonical(lower: string): string | null {
                return this.customMap[lower.toLowerCase()] || null;
        }

        async onload() {
                await this.loadSettings();
                const sugg = new DDSuggest(this.app, this);
                this.registerEditorSuggest(sugg);
                this.registerDomEvent(document, 'keydown', (ev: KeyboardEvent) => {
                        sugg.onKeyDown(ev);
                });
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
                this.refreshCustomMap();
        }
        async saveSettings() {
                await this.saveData(this.settings);
                this.refreshCustomMap();
        }

        linkForPhrase(phrase: string): string | null {
                const m = phraseToMoment(phrase);
                if (!m) return null;
                const value = m.format(this.getDateFormat());
                const targetDate = m.format("YYYY-MM-DD");
                const custom = this.customCanonical(phrase);
                let alias: string;
                if (custom) {
                        alias = custom;
                } else if (this.settings.aliasFormat === "keep") {
                        alias = phrase;
                } else if (this.settings.aliasFormat === "date") {
                        const fmt = needsYearAlias(phrase) ? "MMMM Do, YYYY" : "MMMM Do";
                        alias = m.format(fmt);
                } else {
                        alias = phrase
                                .split(/\s+/)
                                .map((w) => (isProperNoun(w) ? properCase(w) : w))
                                .join(" ");
                }
                const folder = this.getDailyFolder();
                const linkPath = (folder ? folder + "/" : "") + value;
                return `[[${linkPath}|${alias}]]`;
        }

        convertText(text: string): string {
                const phrases = [...this.allPhrases()].sort((a, b) => b.length - a.length);
                for (const p of phrases) {
                        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const re = new RegExp(`\\b${esc}\\b`, "gi");
                        text = text.replace(re, (m) => this.linkForPhrase(m) ?? m);
                }
                return text;
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
                        .setName("Alias style")
                        .setDesc("How the alias part of links is formatted")
                        .addDropdown((d) =>
                                d
                                        .addOptions({
                                                capitalize: "Capitalize phrase",
                                                keep: "Keep typed text",
                                                date: "Format as date",
                                        })
                                        .setValue(this.plugin.settings.aliasFormat)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.aliasFormat = v as any;
                                                await this.plugin.saveSettings();
                                        }),
                        );

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


                // A legacy JSON input for custom dates existed here in early
                // versions of the plugin. It has been removed to simplify the
                // settings UI while retaining support for custom phrases via
                // the individual mapping fields above.

        }
}
