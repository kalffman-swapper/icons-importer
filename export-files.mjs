import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { 
    downloadNPMPackage, 
    IconSet, 
    exportToDirectory, 
    cleanupSVG, 
    runSVGO, 
    parseColors, 
    isEmptyColor 
} from '@iconify/tools';

// Directories
const cacheDir = 'cache';
const outDir = 'svg';

let downloaded;
let cacheExists = false;
try {
    await access(cacheDir, fsConstants.F_OK);
    cacheExists = true;
} catch (e) {
    cacheExists = false;
}

if (cacheExists) {
    console.log('Cache directory exists, using cached package.');
    // Simulate the structure returned by downloadNPMPackage
    downloaded = {
        contentsDir: cacheDir + '/package',
        version: 'cached',
    };
} else {
    console.log('Downloading latest package');
    downloaded = await downloadNPMPackage({ package: '@iconify/json', target: cacheDir });
    console.log('Downloaded package version', downloaded.version);
}

// Get a list of icon sets
const list = JSON.parse(
    await readFile(downloaded.contentsDir + '/collections.json', 'utf8')
);

const prefixes = Object.keys(list);

console.log('Got', prefixes.length, 'icon sets');

// Export each icon set
for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];

    // Read file
    const data = JSON.parse(
        await readFile(`${downloaded.contentsDir}/json/${prefix}.json`, 'utf8')
    );

    // Create IconSet
    const iconSet = new IconSet(data);

    iconSet.forEach((name, type) => {
        if (type !== 'icon') {
            return;
        }

        const svg = iconSet.toSVG(name);
        if (!svg) {
            // Invalid icon
            iconSet.remove(name);
            return;
        }

        // Clean up and optimise icons
        try {
            // Cleanup icon code
            cleanupSVG(svg);

            var currentColor = "#fcfcfc";

            // Assume icon is monotone: replace color with currentColor, add if missing
            // If icon is not monotone, remove this code
            parseColors(svg, {
                defaultColor: currentColor,
                callback: (attr, colorStr, color) => {
                    return !color || isEmptyColor(color) ? colorStr : currentColor;
                },
            });

            // Optimise
            runSVGO(svg);
        } catch (err) {
            // Invalid icon
            console.error(`Error parsing ${name}:`, err);
            iconSet.remove(name);
            return;
        }

        // Update icon
        iconSet.fromSVG(name, svg);
    });

    // Export it
    console.log('Exporting', iconSet.info.name);

    await exportToDirectory(iconSet, {
        target: `${outDir}/${prefix}`,
    });
}

console.log('Dowonload and export complete!');
