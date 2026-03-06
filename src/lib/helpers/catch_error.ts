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
export function catch_error<T>(promise: Promise<T>): Promise<T | Error>;
export function catch_error<T>(fn: () => T): T | Error;
export function catch_error(input: unknown): unknown {
    try {
        if (typeof input === "function") {
            const result = (input as () => unknown)();

            if (result instanceof Promise) {
                return result.catch(error_with_fallback);
            }

            return result;
        }

        if (input instanceof Promise) {
            return input.catch(error_with_fallback);
        }

        return input;
    } catch (err) {
        return error_with_fallback(err);
    }
}

function error_with_fallback(err: unknown): Error {
    if (err instanceof Error) {
        // is already and error
        return err;
    }
    if (err !== null && typeof err === "object" && "message" in err && typeof err.message === "string") {
        // is an object that looks like an error but doesnt extends Error
        return new Error(err.message);
    }
    if (typeof err === "string") {
        // is directly a string
        return new Error(err.startsWith("Error: ") ? err.slice("Error: ".length) : err);
    }
    // final fallback with explicit message
    return new Error(`Thrown value of type ${typeof err} that doesn't extends Error: ${err}`);
}
