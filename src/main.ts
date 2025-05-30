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
	keepAliasWithShift: boolean;
}

const DEFAULT_SETTINGS: DDSettings = {
	dateFormat: "YYYY-MM-DD",
	dailyFolder: "",
	autoCreate: false,
	keepAliasWithShift: true,
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

const PHRASES = BASE_WORDS.flatMap((w) => [w, `last ${w}`, `next ${w}`]);

function phraseToMoment(phrase: string): moment.Moment | null {
	const now = moment();
	const lower = phrase.toLowerCase();

	if (lower === "today") return now;
	if (lower === "yesterday") return now.clone().subtract(1, "day");
	if (lower === "tomorrow") return now.clone().add(1, "day");

	const weekdays = [
		"sunday",
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
	];

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
	return null;
}

/* ------------------------------------------------------------------ */
/* Suggest box                                                        */
/* ------------------------------------------------------------------ */

class DDSuggest extends EditorSuggest<string> {
	plugin: DynamicDates;
	constructor(app: App, plugin: DynamicDates) {
		super(app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile,
	): EditorSuggestTriggerInfo | null {
		const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);

		/* split into tokens and consider last two */
		const tokens = lineBefore.split(/\s+/).filter((t) => t.length);
		if (tokens.length === 0) return null;

		let prefix = tokens[tokens.length - 1];            // current fragment
		const maybePrev = tokens[tokens.length - 2]?.toLowerCase();
		const hasQualifier = ["last", "next"].includes(maybePrev);

		if (hasQualifier) prefix = `${maybePrev} ${prefix}`;

		const query = prefix.toLowerCase().trim();

		/* -----------------------------------------------------------
		   Guard-rails
		   ----------------------------------------------------------- */
		// never pop on bare/partial “last” / “next”
		if (["l","la","las","last","n","ne","nex","next"].includes(query))
			return null;

		// for stand-alone phrases (no qualifier) require ≥3 chars
		if (!hasQualifier && query.length < 3) return null;

		// must begin at least one known phrase
		if (!PHRASES.some((p) => p.startsWith(query))) return null;

		return {
			start: { line: cursor.line, ch: cursor.ch - prefix.length },
			end:   { line: cursor.line, ch: cursor.ch },
			query,
		};
	}

	getSuggestions(ctx: EditorSuggestContext): string[] {
		const q = ctx.query;

		if (PHRASES.includes(q)) {
			const dt = phraseToMoment(q);
			return dt ? [dt.format(this.plugin.settings.dateFormat)] : [];
		}

		const uniq = new Set<string>();
		for (const p of PHRASES) {
			if (!p.startsWith(q)) continue;
			const dt = phraseToMoment(p);
			if (dt) uniq.add(dt.format(this.plugin.settings.dateFormat));
		}
		return [...uniq];
	}

	renderSuggestion(value: string, el: HTMLElement) {
		el.createDiv({ text: value });
	}

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
	
		// pick the shortest matching phrase, or fall back to what was typed
		const phrase = (candidates.sort((a, b) => a.length - b.length)[0] ?? query).toLowerCase();
	
		// Capitalise each word for a nicer alias: "next tuesday" → "Next Tuesday"
		const alias = phrase.replace(/\b\w/g, ch => ch.toUpperCase());
	
		/* ----------------------------------------------------------------
		   2. Build the wikilink with alias
		----------------------------------------------------------------- */
		const linkPath =
			(settings.dailyFolder ? settings.dailyFolder + "/" : "") + value;
		const link = `[[${linkPath}|${alias}]]`;
	
		/* ----------------------------------------------------------------
		   3. Insert, respecting the Shift-modifier behaviour
		----------------------------------------------------------------- */
		const keepTypedWords =
			settings.keepAliasWithShift &&
			ev instanceof KeyboardEvent &&
			ev.shiftKey;
	
		editor.replaceRange(
			keepTypedWords ? `${query} ${link}` : link,
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
			this.app.vault.create(linkPath + ".md", "");
		}
	
		this.close();
	}
	
	
}

/* ------------------------------------------------------------------ */
/* Main plugin & settings                                             */
/* ------------------------------------------------------------------ */

export default class DynamicDates extends Plugin {
	settings: DDSettings;

	async onload() {
		await this.loadSettings();
		this.registerEditorSuggest(new DDSuggest(this.app, this));
		this.addSettingTab(new DDSettingTab(this.app, this));
		console.log("Dynamic Dates loaded");
	}

	onunload() {
		console.log("Dynamic Dates unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
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

		new Setting(containerEl)
			.setName("Date format")
			.addText((t) =>
				t
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (v) => {
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
					.onChange(async (v) => {
						this.plugin.settings.dailyFolder = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Create note if missing")
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.autoCreate)
					.onChange(async (v) => {
						this.plugin.settings.autoCreate = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Shift+Tab keeps alias")
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.keepAliasWithShift)
					.onChange(async (v) => {
						this.plugin.settings.keepAliasWithShift = v;
						await this.plugin.saveSettings();
					}),
			);
	}
}
