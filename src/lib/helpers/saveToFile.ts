import {save} from "@tauri-apps/plugin-dialog";
import {writeTextFile} from "@tauri-apps/plugin-fs";

export const saveToFile = async (data: string, extensions: string[]) => {
    const path = await save({
        title: "Export file",
        filters: [{name: extensions.join(","), extensions}],
    });
    if (!path) {
        return false;
    }
    await writeTextFile(path, data);
    return true;
};
