declare module "obsidian" {
    export const moment: any;
    export class Plugin { app: App; }
    export class App { vault: any; }
    export class Editor {
        getLine(line: number): string;
        replaceRange(text: string, from: any, to: any): void;
    }
    export interface EditorPosition { line: number; ch: number; }
    export class EditorSuggest<T> {
        constructor(app: App);
        context: {editor: Editor; start: EditorPosition; end: EditorPosition; query: string;} | null;
        close(): void;
    }
    export interface EditorSuggestContext { query: string; }
    export interface EditorSuggestTriggerInfo { start: EditorPosition; end: EditorPosition; query: string; }
    export class PluginSettingTab { constructor(app: App, plugin: Plugin); }
    export class Setting {
        constructor(el: HTMLElement);
        setName(name: string): this;
        addText(cb: (t: any) => any): this;
        addToggle(cb: (t: any) => any): this;
    }
    export interface TFile {}
}
