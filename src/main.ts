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
        dateFormat: string;
        autoCreate: boolean;
        acceptKey: "Enter" | "Tab";
        noAliasWithShift: boolean;
        aliasFormat: "capitalize" | "keep" | "date";
        openOnCreate: boolean;
        customDates: Record<string, string>;
}

const DEFAULT_SETTINGS: DDSettings = {
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

                // Split the text before the cursor and inspect the last two
                // tokens so that phrases like "next friday" are handled.
                const tokens = lineBefore.split(/\s+/).filter((t) => t.length);
                if (tokens.length === 0) return null;

                let prefix = tokens[tokens.length - 1];            // current fragment
                let startCh = cursor.ch - prefix.length;
                const maybePrev = tokens[tokens.length - 2];
                let hasQualifier = false;

                if (maybePrev) {
                        const combined = `${maybePrev} ${prefix}`;
                        if (phraseToMoment(combined)) {
                                prefix = combined;
                                startCh -= maybePrev.length + 1;
                        } else if (["last", "next"].includes(maybePrev.toLowerCase())) {
                                prefix = combined;
                                startCh -= maybePrev.length + 1;
                                hasQualifier = true;
                        }
                }

                const query = prefix.toLowerCase().trim();

		/* -----------------------------------------------------------
		   Guard-rails
		   ----------------------------------------------------------- */
                // never pop on bare/partial "last" / "next"
                if (["l","la","las","last","n","ne","nex","next"].includes(query))
                        return null;

		// for stand-alone phrases (no qualifier) require ≥3 chars
		if (!hasQualifier && query.length < 3) return null;

                // must map to a known phrase or a recognised month/day
                const all = this.plugin.allPhrases();
                if (!all.some((p) => p.startsWith(query)) && !phraseToMoment(query)) return null;

                return {
                        start: { line: cursor.line, ch: startCh },
                        end:   { line: cursor.line, ch: cursor.ch },
                        query,
                };
	}

        /**
         * Build the list of suggestion strings that should be shown for the
         * given query.
         */
        getSuggestions(ctx: EditorSuggestContext): string[] {
                const q = ctx.query;

                const direct = phraseToMoment(q);
                if (direct) {
                        return [direct.format(this.plugin.settings.dateFormat)];
                }

                const uniq = new Set<string>();
                for (const p of this.plugin.allPhrases()) {
                        if (!p.startsWith(q)) continue;
                        const dt = phraseToMoment(p);
                        if (dt) uniq.add(dt.format(this.plugin.settings.dateFormat));
                }
                return [...uniq];
        }

        /** Render a single entry in the suggestion dropdown. */
        renderSuggestion(value: string, el: HTMLElement) {
                let phrase = this.context?.query.toLowerCase() || "";
                const target = moment(value, this.plugin.settings.dateFormat).format("YYYY-MM-DD");
                const candidates = this.plugin
                        .allPhrases()
                        .filter((p) =>
                                p.startsWith(phrase) &&
                                phraseToMoment(p)?.format("YYYY-MM-DD") === target,
                        );
                if (candidates.length) {
                        phrase = candidates.sort((a, b) => a.length - b.length)[0];
                }
                el.createDiv({ text: `${value} (${phrase})` });
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
                const targetDate = moment(value, settings.dateFormat).format("YYYY-MM-DD");

                const candidates = this.plugin.allPhrases().filter(p =>
                        p.startsWith(query.toLowerCase()) &&
                        phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate
                );

                let phrase = query.toLowerCase();
                let alias: string;

                if (settings.aliasFormat === "keep") {
                        alias = query;
                } else if (settings.aliasFormat === "date") {
                        alias = moment(targetDate, "YYYY-MM-DD").format("MMMM Do");
                } else {
                        if (candidates.length) {
                                phrase = candidates.sort((a, b) => a.length - b.length)[0];
                                const typedWords = query.split(/\s+/);
                                const phraseWords = phrase.split(/\s+/);
                                alias = phraseWords
                                        .map((w, i) => {
                                                const t = typedWords[i];
                                                if (
                                                        t &&
                                                        t.length === w.length &&
                                                        t.toLowerCase() === w.toLowerCase() &&
                                                        ["last", "next"].includes(w.toLowerCase())
                                                ) {
                                                        return t;
                                                }
                                                return w.replace(/\b\w/g, ch => ch.toUpperCase());
                                        })
                                        .join(" ");
                        } else {
                                alias = moment(targetDate, "YYYY-MM-DD").format("MMMM Do");
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
	
		/* ----------------------------------------------------------------
		   4. Optional auto-create note
		----------------------------------------------------------------- */
                if (
                        settings.autoCreate &&
                        !this.app.vault.getAbstractFileByPath(linkPath + ".md")
                ) {
                        const target = linkPath + ".md";
                        const folder = this.plugin.getDailyFolder().trim();
                        (async () => {
                                if (
                                        folder &&
                                        !this.app.vault.getAbstractFileByPath(folder)
                                ) {
                                        await this.app.vault.createFolder(folder);
                                }
                                let tpl = "";
                                const daily = (this.app as any).internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
                                if (daily?.template) {
                                        const f = this.app.vault.getAbstractFileByPath(daily.template);
                                        if (f) tpl = await this.app.vault.read(f as TFile);
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
export default class DynamicDates extends Plugin {
        settings: DDSettings = DEFAULT_SETTINGS;

        getDailyFolder(): string {
                const daily = (this.app as any).internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
                return daily?.folder || "";
        }

        allPhrases(): string[] {
                return [...PHRASES, ...Object.keys(this.settings.customDates || {}).map(p => p.toLowerCase())];
        }

        async onload() {
                await this.loadSettings();
                this.registerEditorSuggest(new DDSuggest(this.app, this));
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
                const daily = (this.app as any).internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
                if (daily && !this.settings.dateFormat) this.settings.dateFormat = daily.format;
                if (!this.settings.customDates) this.settings.customDates = {};
                (phraseToMoment as any).customDates = Object.fromEntries(Object.entries(this.settings.customDates).map(([k,v]) => [k.toLowerCase(), v]));
        }
        async saveSettings() {
                await this.saveData(this.settings);
                (phraseToMoment as any).customDates = Object.fromEntries(Object.entries(this.settings.customDates || {}).map(([k,v]) => [k.toLowerCase(), v]));
        }

        linkForPhrase(phrase: string): string | null {
                const m = phraseToMoment(phrase);
                if (!m) return null;
                const value = m.format(this.settings.dateFormat);
                const targetDate = m.format("YYYY-MM-DD");
                let alias: string;
                if (this.settings.aliasFormat === "keep") {
                        alias = phrase;
                } else if (this.settings.aliasFormat === "date") {
                        alias = m.format("MMMM Do");
                } else {
                        const typedWords = phrase.split(/\s+/);
                        const phraseWords = phrase.split(/\s+/);
                        alias = phraseWords
                                .map((w, i) => {
                                        const t = typedWords[i];
                                        if (
                                                t &&
                                                t.length === w.length &&
                                                t.toLowerCase() === w.toLowerCase() &&
                                                ["last", "next"].includes(w.toLowerCase())
                                        ) {
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

        convertText(text: string): string {
                const phrases = [...this.allPhrases()].sort((a, b) => b.length - a.length);
                for (const p of phrases) {
                        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const re = new RegExp(`\\b${esc}\\b`, "gi");
                        text = text.replace(re, (m) => this.linkForPhrase(m.toLowerCase()) ?? m);
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
                        .setName("Date format")
                        .setDesc("Format used when inserting dates")
                        .addDropdown((d) =>
                                d
                                        .addOptions({
                                                "YYYY-MM-DD": "YYYY-MM-DD",
                                                "DD-MM-YYYY": "DD-MM-YYYY",
                                                "MM-DD-YYYY": "MM-DD-YYYY",
                                                "YYYY/MM/DD": "YYYY/MM/DD",
                                        })
                                        .setValue(this.plugin.settings.dateFormat)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.dateFormat = v;
                                                await this.plugin.saveSettings();
                                        }),
                        );


                new Setting(containerEl)
                        .setName("Create note if missing")
                        .addToggle((t) =>
                                t
                                        .setValue(this.plugin.settings.autoCreate)
                                        .onChange(async (v: boolean) => {
                                                this.plugin.settings.autoCreate = v;
                                                await this.plugin.saveSettings();
                                        }),
                        );

                new Setting(containerEl)
                        .setName("Open note on creation")
                        .addToggle((t) =>
                                t
                                        .setValue(this.plugin.settings.openOnCreate)
                                        .onChange(async (v: boolean) => {
                                                this.plugin.settings.openOnCreate = v;
                                                await this.plugin.saveSettings();
                                        }),
                        );


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

                containerEl.createDiv({ text: "Custom date mappings" });
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
                                        b.onClick(async () => {
                                                delete this.plugin.settings.customDates[phrase];
                                                await this.plugin.saveSettings();
                                                this.display();
                                        }));
                });
                new Setting(containerEl)
                        .addButton(b =>
                                b.setButtonText("Add")
                                 .onClick(() => {
                                         this.plugin.settings.customDates["New phrase"] = "01-01";
                                         this.display();
                                 }));

                new Setting(containerEl)
                        .setName("Custom dates (JSON)")
                        .addText((t) =>
                                t
                                        .setPlaceholder('{"phrase":"MM-DD"}')
                                        .setValue(JSON.stringify(this.plugin.settings.customDates))
                                        .onChange(async (v: string) => {
                                                try {
                                                        this.plugin.settings.customDates = JSON.parse(v || '{}');
                                                } catch {}
                                                await this.plugin.saveSettings();
                                        }),
                        );

        }
}
