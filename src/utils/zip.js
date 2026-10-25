import { zipSync, strToU8 } from 'fflate';

export function downloadZip(files, name) {
  const input = {};
  files.forEach(f => { input[f.path] = [strToU8(f.content), { level: 0 }]; });
  const blob = new Blob([zipSync(input)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}