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

    export interface EventRef {
        el: HTMLElement | Document | Window;
        type: string;
        handler: (ev: Event) => any;
        options?: AddEventListenerOptions;
    }

    export interface DailyNoteSettings {
        folder?: string;
        format?: string;
    }

    export class Plugin {
        app: App;
        manifest: any;
        constructor(app: App, manifest: any);
        registerEditorSuggest(s: EditorSuggest<any>): void;
        registerDomEvent<E extends Event>(
            el: HTMLElement | Document | Window,
            type: string,
            cb: (ev: E) => any,
            options?: AddEventListenerOptions
        ): EventRef;
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
        app: App;
        plugin: Plugin;
        containerEl: HTMLElement;
        display(): void;
    }

    export class Modal {
        constructor(app: App);
        containerEl: HTMLElement;
        contentEl: HTMLElement;
        open(): void;
        close(): void;
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
