/**
 * Safely executes the given function or promise and returns either the value or the thrown error instance.
 *
 * @example
 * const data = catch_error(() => get_data()); // sync call should always be wrapped by a function
 * if (data instanceof Error) {
 *     return handle_error(data); // data is Error
 * }
 * console.log(data); // data is whatever type returns by get_data()
 *
 * @example
 * const data = await catch_error(fetch_data());
 * if (data instanceof Error) {
 *     return handle_error(data); // data is Error
 * }
 * console.log(data); // data is the unwrapped promise result
 *
 * @example
 * const data = await catch_error(stream_data());
 * if (data instanceof StreamingError) {
 *     return data.tokens; // access custom properties of StreamingError
 * } else if (data instanceof Error) { // handle other errors
 *     return handle_error(data); // data is Error
 * }
 * console.log(data); // data is the unwrapped promise result
 */
export function catchError<T>(promise: Promise<T>): Promise<T | Error>;
export function catchError<T>(fn: () => T): T | Error;
export function catchError(input: unknown): unknown {
    try {
        if (typeof input === "function") {
            const result = (input as () => unknown)();

            if (result instanceof Promise) {
                return result.catch(errorWithFallback);
            }

            return result;
        }

        if (input instanceof Promise) {
            return input.catch(errorWithFallback);
        }

        return input;
    } catch (err) {
        return errorWithFallback(err);
    }
}

function errorWithFallback(err: unknown): Error {
    return err instanceof Error
        ? err
        : new Error(`Thrown value of type ${typeof err} that doesn't extends Error: ${err}`);
}
