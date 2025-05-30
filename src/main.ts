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
        dailyFolder: string;
        autoCreate: boolean;
        acceptKey: "Enter" | "Tab";
        noAliasWithShift: boolean;
        aliasFormat: "capitalize" | "keep" | "date";
        openOnCreate: boolean;
}

const DEFAULT_SETTINGS: DDSettings = {
        dateFormat: "YYYY-MM-DD",
        dailyFolder: "",
        autoCreate: false,
        acceptKey: "Tab",
        noAliasWithShift: false,
        aliasFormat: "capitalize",
        openOnCreate: false,
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
                if (!PHRASES.some((p) => p.startsWith(query)) && !phraseToMoment(query)) return null;

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
                for (const p of PHRASES) {
                        if (!p.startsWith(q)) continue;
                        const dt = phraseToMoment(p);
                        if (dt) uniq.add(dt.format(this.plugin.settings.dateFormat));
                }
                return [...uniq];
        }

        /** Render a single entry in the suggestion dropdown. */
        renderSuggestion(value: string, el: HTMLElement) {
                el.createDiv({ text: value });
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

                const candidates = PHRASES.filter(p =>
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
                                alias = phrase.replace(/\b\w/g, ch => ch.toUpperCase());
                        } else {
                                alias = moment(targetDate, "YYYY-MM-DD").format("MMMM Do");
                        }
                }
	
		/* ----------------------------------------------------------------
		   2. Build the wikilink with alias
		----------------------------------------------------------------- */
                const linkPath =
                        (settings.dailyFolder ? settings.dailyFolder + "/" : "") + value;
                const link = `[[${linkPath}|${alias}]]`;
	
		/* ----------------------------------------------------------------
		   3. Insert, respecting the Shift-modifier behaviour
		----------------------------------------------------------------- */
                let final = link;
                if (ev instanceof KeyboardEvent) {
                        const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
                        if (key && key !== settings.acceptKey) return;
                        if (ev.shiftKey && settings.noAliasWithShift) {
                                final = `[[${linkPath}]]`;
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
                        const folder = settings.dailyFolder.trim();
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
                if (daily) {
                        if (!this.settings.dateFormat) this.settings.dateFormat = daily.format;
                        if (!this.settings.dailyFolder) this.settings.dailyFolder = daily.folder;
                }
        }
        async saveSettings() {
                await this.saveData(this.settings);
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
                        alias = phrase.replace(/\b\w/g, ch => ch.toUpperCase());
                }
                const linkPath = (this.settings.dailyFolder ? this.settings.dailyFolder + "/" : "") + value;
                return `[[${linkPath}|${alias}]]`;
        }

        convertText(text: string): string {
                const phrases = [...PHRASES].sort((a, b) => b.length - a.length);
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
			.addText((t) =>
				t
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.plugin.settings.dateFormat)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.dateFormat = v.trim() || "YYYY-MM-DD";
                                                await this.plugin.saveSettings();
                                        }),
			);

		new Setting(containerEl)
			.setName("Daily-note folder")
			.addText((t) =>
				t
					.setPlaceholder("Daily")
					.setValue(this.plugin.settings.dailyFolder)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.dailyFolder = v.trim();
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
                        .addText((t) =>
                                t
                                        .setPlaceholder("Tab")
                                        .setValue(this.plugin.settings.acceptKey)
                                        .onChange(async (v: string) => {
                                                const val = v.trim() === "Enter" ? "Enter" : "Tab";
                                                this.plugin.settings.acceptKey = val as any;
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
                        .addText((t) =>
                                t
                                        .setPlaceholder("capitalize")
                                        .setValue(this.plugin.settings.aliasFormat)
                                        .onChange(async (v: string) => {
                                                this.plugin.settings.aliasFormat = (v.trim() as any) || "capitalize";
                                                await this.plugin.saveSettings();
                                        }),
                        );

        }
}
