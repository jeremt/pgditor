import {save} from "@tauri-apps/plugin-dialog";
import {writeFile, writeTextFile} from "@tauri-apps/plugin-fs";

export const save_to_file = async (data: string | Uint8Array, extensions: string[], default_path?: string) => {
    const path = await save({
        title: "Export file",
        defaultPath: default_path,
        filters: [{name: extensions.join(","), extensions}],
    });
    if (!path) {
        return false;
    }
    if (typeof data === "string") {
        await writeTextFile(path, data);
    } else {
        await writeFile(path, data);
    }
    return true;
};
