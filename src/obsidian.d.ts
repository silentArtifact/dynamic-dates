declare module "obsidian" {
    export const moment: (...args: any[]) => moment.Moment;
    export namespace moment { export type Moment = any; }

    export class Vault {
        getAbstractFileByPath(path: string): any;
        createFolder(path: string): Promise<void>;
        create(path: string, data: string): Promise<void>;
        read(file: any): Promise<string>;
    }

    export class Workspace {
        openLinkText(path: string, source: string, newLeaf: boolean): void;
    }

    export class App { vault: Vault; workspace: Workspace; internalPlugins: any; }

    export class Plugin {
        app: App;
        registerEditorSuggest(s: EditorSuggest<any>): void;
        addSettingTab(tab: PluginSettingTab): void;
        addCommand(cmd: any): void;
        loadData(): Promise<any>;
        saveData(data: any): Promise<void>;
    }

    export class Editor {
        getLine(line: number): string;
        replaceRange(text: string, from: any, to: any): void;
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
        addText(cb: (t: any) => any): this;
        addToggle(cb: (t: any) => any): this;
        addDropdown(cb: (d: any) => any): this;
    }

    export interface TFile {}
}

interface HTMLElement {
    createDiv(options: { text: string }): HTMLElement;
    empty(): void;
}
