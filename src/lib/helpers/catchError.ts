/**
 * Handle try catches errors as values.
 *
 * You can pass an array of possible errors if you want to catch only specific errors.
 *
 * @example
 * class NotFoundError extends Error {
 *      name = "NotFoundError";
 *      status = 404;
 * }
 * const [error, data] = await catchError(getData(), [NotFoundError]);
 *
 * @param promise The promise to resolve
 * @param errors The errors that should be handled, if undefined it catches all errors.
 * @returns
 */
export const catchError = async <T, E extends new (message?: string) => Error>(
    promise: Promise<T>,
    errors?: E[]
): Promise<[undefined, T] | [InstanceType<E>]> => {
    try {
        return [undefined, await promise];
    } catch (error) {
        if (errors === undefined) {
            // any error
            return [(error instanceof Error ? error : new Error(`${error}`)) as InstanceType<E>];
        }
        if (errors.some((possibleError) => error instanceof possibleError)) {
            return [error as InstanceType<E>];
        }
        throw error; // unexpected error
    }
};
