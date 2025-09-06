"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import styles from "./Calendar.module.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  mode: "single" | "range";
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={`${styles.calendar} ${className ?? ""}`}
      classNames={{
        chevron: String(styles.chevron ?? ''),
        weekdays: String(styles.weekdays ?? ''),
        weekday: String(styles.weekday ?? ''),
        today: String(styles.today ?? ''),
        selected: String(styles.selected ?? ''),
        range_middle: String(styles.range_middle ?? ''),
        range_end: String(styles.range_end ?? ''),
        outside: String(styles.outside ?? ''),
        nav: String(styles.nav ?? ''),
        months: String(styles.months ?? ''),
        month: String(styles.month ?? ''),
        month_grid: String(styles.month_grid ?? ''),
        month_caption: String(styles.month_caption ?? ''),
        hidden: String(styles.hidden ?? ''),
        footer: String(styles.footer ?? ''),
        disabled: String(styles.disabled ?? ''),
        day: String(styles.day ?? ''), // the cell around day button
        day_button: String(styles.day_button ?? ''), // the day button
        cell: String(styles.cell ?? ''),
        caption_label: String(styles.caption_label ?? ''),
        button_previous: String(styles.button_previous ?? ''),
        button_next: String(styles.button_next ?? ''),
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
