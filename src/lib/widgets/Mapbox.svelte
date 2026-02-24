<script lang="ts">
    import {onMount, onDestroy} from "svelte";
    import mapboxgl from "mapbox-gl";
    import "mapbox-gl/dist/mapbox-gl.css";
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import {PUBLIC_MABOX_TOKEN} from "$env/static/public";

    const styles = {
        light: "mapbox://styles/mapbox/light-v11",
        dark: "mapbox://styles/mapbox/dark-v11",
    };

    type Spot = {
        kind: "point";
        name: string;
        lon: number;
        lat: number;
    };

    type Props = {
        spot: Spot;
    };

    let {spot = $bindable()}: Props = $props();

    const settings = get_settings_context();

    let mapContainer = $state<HTMLDivElement | null>(null);
    let map = $state<mapboxgl.Map | null>(null);
    let marker = $state<mapboxgl.Marker | null>(null);
    let resizeObserver: ResizeObserver | null = null;

    function place_marker(lon: number, lat: number) {
        if (!map) return;

        if (marker) {
            marker.setLngLat([lon, lat]);
        } else {
            const el = document.createElement("div");
            el.className = "marker";
            el.innerHTML = `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.4812 31.281C16.6875 27.258 24 17.5078 24 12.0311C24 5.38895 18.625 0 12 0C5.375 0 0 5.38895 0 12.0311C0 17.5078 7.3125 27.258 10.5188 31.281C11.2875 32.2397 12.7125 32.2397 13.4812 31.281ZM12 8.02076C13.0609 8.02076 14.0783 8.44328 14.8284 9.19537C15.5786 9.94746 16 10.9675 16 12.0311C16 13.0948 15.5786 14.1148 14.8284 14.8669C14.0783 15.619 13.0609 16.0415 12 16.0415C10.9391 16.0415 9.92172 15.619 9.17157 14.8669C8.42143 14.1148 8 13.0948 8 12.0311C8 10.9675 8.42143 9.94746 9.17157 9.19537C9.92172 8.44328 10.9391 8.02076 12 8.02076Z" fill="var(--color-fg)"/>
</svg>
`;
            marker = new mapboxgl.Marker({element: el}).setLngLat([lon, lat]).addTo(map);
        }
    }

    onMount(() => {
        if (!mapContainer) return;

        mapboxgl.accessToken = PUBLIC_MABOX_TOKEN;

        map = new mapboxgl.Map({
            container: mapContainer,
            style: styles[settings.colorScheme],
            center: [spot.lon, spot.lat],
            zoom: 6,
            attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        resizeObserver = new ResizeObserver(() => map?.resize());
        resizeObserver.observe(mapContainer);

        map.on("load", () => {
            place_marker(spot.lon, spot.lat);
        });

        map.on("dblclick", (e) => {
            e.preventDefault();
            const {lng, lat} = e.lngLat;
            spot = {kind: "point", name: `Point(${lng} ${lat})`, lon: lng, lat};
        });
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
        map?.remove();
    });

    $effect(() => {
        const style = styles[settings.colorScheme];
        if (!map) return;

        map.setStyle(style);

        // marker gets wiped when style reloads, re-add it
        map.once("style.load", () => {
            marker = null;
            place_marker(spot.lon, spot.lat);
        });
    });

    $effect(() => {
        if (!map || !marker) return;
        place_marker(spot.lon, spot.lat);
        map.flyTo({center: [spot.lon, spot.lat]});
    });
</script>

<div class="w-full h-full rounded-2xl" bind:this={mapContainer}></div>
