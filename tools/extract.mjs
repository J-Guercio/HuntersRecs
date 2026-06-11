// Pull result.places out of the workflow's task-output JSON into tools/enriched.json.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
const raw = JSON.parse(readFileSync(src, 'utf8'));
const places = raw.result?.places || raw.places || [];
writeFileSync(new URL('./enriched.json', import.meta.url), JSON.stringify(places, null, 2));
console.log(`Wrote ${places.length} places to enriched.json`);
