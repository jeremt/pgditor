import {load, type Store} from "@tauri-apps/plugin-store";

export class StoreContext {
    private store?: Store;

    constructor(public storePath: string) {}

    /**
     * Returns the value for the given key or undefined if the key does not exist.
     */
    getFromStore = async <T>(key: string) => {
        if (!this.store) {
            this.store = await load(this.storePath);
        }
        return this.store.get<T>(key);
    };

    /**
     * Inserts a key-value pair into the store.
     */
    setToStore = async <T>(key: string, value: T) => {
        if (!this.store) {
            this.store = await load(this.storePath);
        }
        await this.store.set(key, value);
    };

    /**
     * Saves the store to disk at the store's path.
     */
    saveToStore = async () => {
        if (!this.store) {
            this.store = await load(this.storePath);
        }
        await this.store.save();
    };
}
