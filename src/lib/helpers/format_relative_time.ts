export const format_relative_time = (
    date: Date | number,
    baseDate: Date = new Date(),
    locales: Intl.LocalesArgument = "fr",
) => {
    const target_date = date instanceof Date ? date : new Date(date);
    const diff_in_seconds = Math.floor((baseDate.getTime() - target_date.getTime()) / 1000);

    if (Math.abs(diff_in_seconds) < 5) {
        return "maintenant";
    }

    const rtf = new Intl.RelativeTimeFormat(locales, {numeric: "auto"});

    const intervals = [
        {unit: "year" as Intl.RelativeTimeFormatUnit, seconds: 31536000},
        {unit: "month" as Intl.RelativeTimeFormatUnit, seconds: 2592000},
        {unit: "week" as Intl.RelativeTimeFormatUnit, seconds: 604800},
        {unit: "day" as Intl.RelativeTimeFormatUnit, seconds: 86400},
        {unit: "hour" as Intl.RelativeTimeFormatUnit, seconds: 3600},
        {unit: "minute" as Intl.RelativeTimeFormatUnit, seconds: 60},
        {unit: "second" as Intl.RelativeTimeFormatUnit, seconds: 1},
    ];

    for (const {unit, seconds} of intervals) {
        const value = Math.floor(diff_in_seconds / seconds);
        if (Math.abs(value) >= 1) {
            return rtf.format(-value, unit);
        }
    }

    return rtf.format(-diff_in_seconds, "second");
};
