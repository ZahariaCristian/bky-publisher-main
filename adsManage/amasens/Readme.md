(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const regionSelect = document.querySelector("#regionId");

    if (!regionSelect) {
        throw new Error("Open the Amasens publish page first.");
    }

    async function getData(action, parameter, id) {
        const url =
            `/index.php?page=ajax` +
            `&action=${encodeURIComponent(action)}` +
            `&${encodeURIComponent(parameter)}=${encodeURIComponent(id)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`${action} failed: HTTP ${response.status}`);
        }

        return await response.json();
    }

    const regions = Array.from(regionSelect.options)
        .filter(option => option.value)
        .map(option => ({
            id: option.value,
            name: option.textContent.trim()
        }));

    const output = [];

    for (let r = 0; r < regions.length; r++) {
        const region = regions[r];

        console.log(
            `Regione ${r + 1}/${regions.length}: ${region.name}`
        );

        const provinces = await getData(
            "cities",
            "regionId",
            region.id
        );

        const regionResult = {
            id: region.id,
            name: region.name,
            provinces: []
        };

        for (let p = 0; p < provinces.length; p++) {
            const province = provinces[p];

            console.log(
                `Provincia ${p + 1}/${provinces.length}: ${province.s_name}`
            );

            const comuni = await getData(
                "city_areas",
                "cityAreaId",
                province.pk_i_id
            );

            regionResult.provinces.push({
                id: String(province.pk_i_id),
                name: province.s_name,
                slug: province.s_slug || "",
                comuni: comuni.map(comune => ({
                    id: String(comune.pk_i_id),
                    name: comune.s_name,
                    slug: comune.s_slug || ""
                }))
            });

            await wait(300);
        }

        output.push(regionResult);
        await wait(500);
    }

    const json = JSON.stringify(output, null, 2);
    const blob = new Blob([json], {
        type: "application/json"
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "amasens-locations.json";
    link.click();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    console.log("Export completed.");
})();


