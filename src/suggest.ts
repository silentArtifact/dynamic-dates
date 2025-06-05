import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, moment, TFile } from "obsidian";
import { phraseToMoment, prefixMatch, isHolidayQualifier } from "./holidays";
import type DynamicDates from "./plugin";
export default class DDSuggest extends EditorSuggest<string> {
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

               // Skip suggestions inside code or wiki links
               // inside fenced block?
               let fenced = false;
               const WINDOW = 20;
               const startLine = Math.max(0, cursor.line - WINDOW);
               for (let i = startLine; i <= cursor.line; i++) {
                       let line = editor.getLine(i);
                       if (i === cursor.line) line = line.slice(0, cursor.ch);
                       let idx = 0;
                       while ((idx = line.indexOf("```", idx)) !== -1) {
                               fenced = !fenced;
                               idx += 3;
                       }
               }
               if (fenced) return null;

                // inside inline code?
                if ((lineBefore.split("`").length - 1) % 2 === 1) return null;

                // inside a wiki link?
                const fullLine = editor.getLine(cursor.line);
                const open = fullLine.lastIndexOf("[[", cursor.ch);
                if (open !== -1) {
                        const close = fullLine.indexOf("]]", open + 2);
                        if (close === -1 || close >= cursor.ch) return null;
                }

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
                        if (!all.some((p) => prefixMatch(p, query)) && !phraseToMoment(query))
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
                       : this.plugin.allPhrases().filter(p => prefixMatch(p, qLower));
               for (const p of phrases) {
                       const dt = (this.plugin as any).momentForPhrase
                               ? (this.plugin as any).momentForPhrase(p)
                               : phraseToMoment(p);
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

        /**
         * Replace the typed phrase with the selected wikilink and optionally
         * create the daily note on disk.
         */
        async selectSuggestion(value: string, ev: KeyboardEvent | MouseEvent) {
                const { editor, start, end, query } = this.context!;
                const { settings } = this.plugin;
                // 1. Find the canonical phrase that maps to this calendar date
                const targetDate = moment(value, this.plugin.getDateFormat()).format("YYYY-MM-DD");

                const candidates = this.plugin.allPhrases().filter(p =>
                        prefixMatch(p, query.toLowerCase()) &&
                        phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate
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
                // 2. Build the wikilink with alias
                const link = `[[${value}|${alias}]]`;
                // 3. Insert, respecting the Shift-modifier behaviour
                let final = link;
                if (ev instanceof KeyboardEvent) {
                        const key = ev.key === "Enter" ? "Enter" : ev.key === "Tab" ? "Tab" : "";
                        if (key && key !== settings.acceptKey) return;
                       if (ev.shiftKey && settings.noAliasWithShift) {
                               final = `[[${value}]]`;
                       }
                        if (typeof ev.preventDefault === "function") ev.preventDefault();
                        if (typeof ev.stopPropagation === "function") ev.stopPropagation();
                }

                editor.replaceRange(
                        final,
                        start,
                        end,
                );

                this.close();
        }

        onKeyDown(ev: KeyboardEvent): boolean {
                if (this.context && ev.key === this.plugin.settings.acceptKey) {
                        if (typeof ev.preventDefault === 'function') ev.preventDefault();
                        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
                        const value = this._last[0];
                        if (value) void this.selectSuggestion(value, ev);
                        return true;
                }
                return false;
        }

}

export interface PrefixTrieNode { children: Map<string, PrefixTrieNode>; phrase: string | null; }

