import {expect, test} from "vitest";
import {catch_error} from "./catch_error";

test("Promise examples", async () => {
    const throw_error = async () => {
        throw new Error("simple error");
    };
    const result = await catch_error(throw_error());
    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
        expect(result.message).toBe("simple error");
    }

    const check_age = async (age: number) => {
        if (age < 18) {
            throw new Error("🔞");
        }
        return "ok";
    };
    const is_adult = await catch_error(check_age(25));
    expect(is_adult).toBe("ok");
    const is_child = await catch_error(check_age(16));
    expect(is_child).toBeInstanceOf(Error);
    if (is_child instanceof Error) {
        expect(is_child.message).toBe("🔞");
    }
});

test("Custom error", async () => {
    class SystemError extends Error {
        constructor(
            public level: "unrecoverable" | "retry" | "ignore",
            message: string,
        ) {
            super(message);
            this.name = "SystemError";
        }
    }

    const load_file = async (file_path: string) => {
        throw new SystemError("unrecoverable", `file ${file_path} not found`);
    };

    const error = await catch_error(load_file("data.csv"));
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SystemError);
    expect(error.name).toBe("SystemError");
    if (error instanceof SystemError) {
        expect(error.level).toBe("unrecoverable");
    }
});

test("Sync value examples", () => {
    const get_number = () => 42;
    const result = catch_error(get_number);

    expect(result).toBe(42);
});

test("Sync error thrown", () => {
    const throw_error = () => {
        throw new Error("boom");
    };

    const result = catch_error(throw_error);

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
        expect(result.message).toBe("boom");
    }
});

test("Sync non-error thrown value", () => {
    const throw_string = () => {
        throw "oops";
    };

    const result = catch_error(throw_string);

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
        expect(result.message).toBe("Thrown value of type string that doesn't extends Error: oops");
    }
});

test("Function returning a promise", async () => {
    const async_fn = async () => "ok";

    const result = await catch_error(() => async_fn());

    expect(result).toBe("ok");
});

test("Function returning a rejected promise", async () => {
    const async_fn = async () => {
        throw new Error("fail");
    };

    const result = await catch_error(async () => await async_fn());

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
        expect(result.message).toBe("fail");
    }
});

test("System JS error (ReferenceError)", () => {
    const access_undefined = () => {
        // @ts-expect-error — intentionally accessing an undefined variable
        return not_defined_variable;
    };

    const result = catch_error(access_undefined);

    expect(result).toBeInstanceOf(Error);
    expect(result).toBeInstanceOf(ReferenceError);

    if (result instanceof Error) {
        expect(result.name).toBe("ReferenceError");
        expect(result.message).toBe("not_defined_variable is not defined");
    }
});
