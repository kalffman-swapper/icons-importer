import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import readline from 'node:readline/promises';

const svgDir = 'svg';
const pngDir = 'png';


async function getProviders(svgDir) {
    const entries = await fs.readdir(svgDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
}


async function* walk(dir) {
    for await (const d of await fs.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) {
            yield* walk(entry);
        } else if (d.isFile() && entry.endsWith('.svg')) {
            yield entry;
        }
    }
}


async function convertSvgToPngVariants(svgPath) {
    // Mirror svg/<provider>/<icon>.svg to png/<provider>/<icon>_{variant}_{size}.png
    const relPath = path.relative(svgDir, svgPath); // <provider>/<icon>.svg
    const baseName = relPath.replace(/\.svg$/, '');
    const outDir = path.join(pngDir, path.dirname(relPath));
    await fs.mkdir(outDir, { recursive: true });
    const svgContent = await fs.readFile(svgPath, 'utf8');

    // Only convert to PNG at different sizes, keep original SVG colors
    const sizes = [24, 48, 64, 128];
    for (const size of sizes) {
        const pngPath = path.join(
            pngDir,
            `${baseName}_${size}.png`
        );
        await sharp(Buffer.from(svgContent))
            .resize({ width: size })
            .png()
            .toFile(pngPath);
    }
}


async function getAllSvgFiles(dir) {
    const files = [];
    for await (const file of walk(dir)) {
        files.push(file);
    }
    return files;
}




(async () => {
    const providers = await getProviders(svgDir);
    if (providers.length === 0) {
        console.error('No providers found in svg/.');
        process.exit(1);
    }
    console.log('Available providers:');
    providers.forEach((p, i) => console.log(`${i + 1}. ${p}`));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let provider;
    while (true) {
        const answer = await rl.question('Choose a provider by number: ');
        const idx = parseInt(answer, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < providers.length) {
            provider = providers[idx];
            break;
        }
        console.log('Invalid selection. Please try again.');
    }

    rl.close();

    const providerDir = path.join(svgDir, provider);
    const svgFiles = await getAllSvgFiles(providerDir);
    const total = svgFiles.length;
    let count = 0;
    for (const svgFile of svgFiles) {
        try {
            await convertSvgToPngVariants(svgFile);
            count++;
            const percent = ((count / total) * 100).toFixed(2);
            process.stdout.write(`Progress: ${count}/${total} (${percent}%)\r`);
        } catch (err) {
            console.error(`Failed to convert ${svgFile}:`, err.message);
        }
    }
    console.log(`\nAll SVGs for provider "${provider}" converted to PNG.`);
})();
