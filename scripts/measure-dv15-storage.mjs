import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function summary(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return { path: relative, files: 0, bytes: 0 };
  let files = 0, bytes = 0;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile()) { files += 1; bytes += fs.statSync(target).size; }
    }
  };
  walk(absolute);
  return { path: relative, files, bytes };
}
const rows = ['public/dv15', 'data/dv15/inbox', 'data/dv15/compact', 'public/dv12', 'public/dv11', 'public/dv9'].map(summary);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows, totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0) }, null, 2));
