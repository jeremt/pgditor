/**
 * Helper to debounce a deeply reactive state. The input value `loadData` can also be updated.
 *
 * @example
 *
 * const debouncedState = debounced(() => initState, async (newState) => {
 *      await syncToServer(newState);
 * });
 *
 * debouncedState.data // updated data
 * debouncedState.stale // whether the current data is stale
 * debouncedState.saving // whether we are currently syncing with the server
 * debouncedState.overrideData(otherState); // force the state value
 *
 * @param load how to load the state value (can be changed, by invalidate() if comes from $props() of page for instance)
 * @param sync the function that is called automatically whenever a subvalue of the data is updated
 * @param delay the delay in milliseconds before the sync function is called after the data has become stale
 * @returns the data and whether the data is currently being changed
 */
export const debounced = <T>(load: () => T, sync: (newData: T) => Promise<void>, delay = 1000) => {
    let hasInitialized = false;

    let data = $derived.by(() => {
        hasInitialized = false;
        const statedData = $state(load());
        return statedData;
    });
    let stale = $state(false);
    let saving = $state(false);

    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = (newData: T) => {
        stale = true;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            saving = true;
            await Promise.all([sync(newData), new Promise((resolve) => setTimeout(resolve, 500))]);
            stale = false;
            saving = false;
        }, delay);
    };

    $effect(() => {
        const newData = JSON.stringify(data);
        if (!hasInitialized) {
            // prevent saving the first time
            hasInitialized = true;
            return;
        }
        debouncedUpdate(JSON.parse(newData));
    });
    return {
        get data() {
            return data;
        },
        get stale() {
            return stale;
        },
        get saving() {
            return saving;
        },
        //
        overrideData(value: T) {
            hasInitialized = false;
            data = value;
        },
    };
};
