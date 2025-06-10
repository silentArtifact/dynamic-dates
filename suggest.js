"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const holidays_1 = require("./holidays");
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
        // Skip suggestions inside code or wiki links
        // inside fenced block?
        let fenced = false;
        // Scan from the top of the file to find unmatched fences
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
        // inside inline code?
        if ((lineBefore.split("`").length - 1) % 2 === 1)
            return null;
        // inside a wiki link?
        const fullLine = editor.getLine(cursor.line);
        const open = fullLine.lastIndexOf("[[", cursor.ch);
        if (open !== -1) {
            const close = fullLine.indexOf("]]", open + 2);
            if (close === -1 || close >= cursor.ch)
                return null;
        }
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
            if (!all.some((p) => (0, holidays_1.prefixMatch)(p, query)) && !(0, holidays_1.phraseToMoment)(query))
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
        const direct = this.plugin.momentForPhrase
            ? this.plugin.momentForPhrase(qLower)
            : (0, holidays_1.phraseToMoment)(qLower);
        if (direct) {
            this._last = [direct.format(this.plugin.getDateFormat())];
            return this._last;
        }
        const uniq = new Set();
        const phrases = this.plugin.phrasesForPrefix
            ? this.plugin.phrasesForPrefix(qLower)
            : this.plugin.allPhrases().filter(p => (0, holidays_1.prefixMatch)(p, qLower));
        for (const p of phrases) {
            const dt = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(p)
                : (0, holidays_1.phraseToMoment)(p);
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
            .filter((p) => {
            const m = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(p)
                : (0, holidays_1.phraseToMoment)(p);
            return (0, holidays_1.prefixMatch)(p, phrase) && m?.format("YYYY-MM-DD") === target;
        });
        if (!candidates.length && (0, holidays_1.isHolidayQualifier)(phrase)) {
            const m = this.plugin.momentForPhrase
                ? this.plugin.momentForPhrase(phrase)
                : (0, holidays_1.phraseToMoment)(phrase);
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
    /**
     * Replace the typed phrase with the selected wikilink and optionally
     * create the daily note on disk.
     */
    async selectSuggestion(value, ev) {
        const { editor, start, end, query } = this.context;
        const { settings } = this.plugin;
        // 1. Find the canonical phrase that maps to this calendar date
        const targetDate = (0, obsidian_1.moment)(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");
        const candidates = this.plugin.allPhrases().filter(p => (0, holidays_1.prefixMatch)(p, query.toLowerCase()) &&
            (0, holidays_1.phraseToMoment)(p)?.format("YYYY-MM-DD") === targetDate);
        if (!candidates.length && (0, holidays_1.isHolidayQualifier)(query.toLowerCase())) {
            const m = (0, holidays_1.phraseToMoment)(query.toLowerCase());
            if (m && m.format("YYYY-MM-DD") === targetDate) {
                candidates.push(query.toLowerCase());
            }
        }
        let phrase = query.toLowerCase();
        if (candidates.length) {
            phrase = candidates.sort((a, b) => a.length - b.length)[0];
        }
        const alias = this.plugin.buildAlias(phrase, query);
        // 2. Build the wikilink with alias
        const link = `[[${value}|${alias}]]`;
        // 3. Insert, respecting the Shift-modifier behaviour
        let final = link;
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
            if (typeof ev.preventDefault === 'function')
                ev.preventDefault();
            if (typeof ev.stopPropagation === 'function')
                ev.stopPropagation();
            const value = this._last[0];
            if (value)
                void this.selectSuggestion(value, ev);
            return true;
        }
        return false;
    }
}
exports.default = DDSuggest;
