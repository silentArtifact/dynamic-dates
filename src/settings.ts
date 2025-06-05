export interface DDSettings {
  /** @deprecated Date format is now taken from the daily notes plugin */
  dateFormat?: string;
  acceptKey: "Enter" | "Tab";
  noAliasWithShift: boolean;
  customDates: Record<string, string>;
  holidayGroups: Record<string, boolean>;
  holidayOverrides: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: DDSettings = {
  acceptKey: "Tab",
  noAliasWithShift: false,
  customDates: {},
  holidayGroups: {},
  holidayOverrides: {},
};
