/**
 * Safely increments a number by a step, avoiding floating-point precision errors.
 * This is done by converting the numbers to integers based on their decimal places,
 * performing the addition, and then converting the result back to a float.
 *
 * @param value The number to be incremented.
 * @param step The step value to add.
 * @returns The incremented number without floating-point inaccuracies.
 */
export const safe_increment = (value: number, step: number): number => {
    const n_decimal_places = (value.toString().split(".")[1] || "").length;
    const step_decimal_places = (step.toString().split(".")[1] || "").length;
    const multiplier = Math.pow(10, Math.max(n_decimal_places, step_decimal_places));
    return (Math.round(value * multiplier) + Math.round(step * multiplier)) / multiplier;
};
