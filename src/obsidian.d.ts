declare module "obsidian" {
    export const moment: (...args: any[]) => moment.Moment;
    export function normalizePath(path: string): string;
    export namespace moment { export type Moment = any; }

    export interface TAbstractFile { path: string; }
    export interface TFile extends TAbstractFile {}

    export class Vault {
        getAbstractFileByPath(path: string): TAbstractFile | null;
        createFolder(path: string): Promise<void>;
        create(path: string, data: string): Promise<TFile>;
        read(file: TFile): Promise<string>;
    }

    export class Workspace {
        openLinkText(path: string, source: string, newLeaf: boolean): void;
    }

    export class App { vault: Vault; workspace: Workspace; internalPlugins: any; }

    export class Plugin {
        app: App;
        registerEditorSuggest(s: EditorSuggest<any>): void;
        registerDomEvent(el: any, type: string, cb: (ev: any) => any, options?: any): void;
        addSettingTab(tab: PluginSettingTab): void;
        addCommand(cmd: any): void;
        loadData(): Promise<any>;
        saveData(data: any): Promise<void>;
    }

    export class Editor {
        getLine(line: number): string;
        replaceRange(text: string, from: EditorPosition, to: EditorPosition): void;
        getValue(): string;
        setValue(v: string): void;
    }

    export interface EditorPosition { line: number; ch: number; }

    export class EditorSuggest<T> {
        constructor(app: App);
        app: App;
        context: { editor: Editor; start: EditorPosition; end: EditorPosition; query: string; } | null;
        close(): void;
    }

    export interface EditorSuggestContext { query: string; }
    export interface EditorSuggestTriggerInfo { start: EditorPosition; end: EditorPosition; query: string; }

    export class PluginSettingTab {
        constructor(app: App, plugin: Plugin);
        containerEl: HTMLElement;
    }

    export class Setting {
        constructor(el: HTMLElement);
        setName(name: string): this;
        setDesc(desc: string): this;
        addText(cb: (t: any) => any): this;
        addToggle(cb: (t: any) => any): this;
        addDropdown(cb: (d: any) => any): this;
        addButton(cb: (b: any) => any): this;
        addExtraButton(cb: (b: any) => any): this;
    }

    export class ButtonComponent {
        setButtonText(text: string): this;
        setTooltip(text: string): this;
        setIcon(icon: string): this;
        onClick(callback: (evt?: any) => any): this;
    }

}

interface HTMLElement {
    createDiv(options: { text: string }): HTMLElement;
    empty(): void;
}
