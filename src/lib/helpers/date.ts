/**
 * Get the number of days in a given month.
 * @param month The month number, 0 based
 * @param year The year, not zero based, required to account for leap years
 */
export const getDaysInMonth = (date: Date) => {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
    let days = 0;
    while (currentDate.getMonth() === date.getMonth()) {
        days++;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
};

/**
 * Adds the specified number of days to a given date.
 *
 * @param date - The starting date
 * @param days - The number of days to add (can be negative for subtracting days)
 * @returns A new Date object representing the date after adding the specified days
 * @example
 * // Add 5 days to current date
 * const futureDate = addDays(new Date(), 5);
 *
 * // Subtract 3 days from a specific date
 * const pastDate = addDays(new Date('2024-01-15'), -3);
 */
export const addDays = (date: Date, days: number) => {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

/**
 * @returns a string representation of the date in the format 'MM/DD/YYYY' or 'DD/MM/YYYY' depending on the locale
 */
export const formatDate = (date: Date, locale: string) => {
    return date.toLocaleDateString(locale);
};
