const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'site');
const output = path.join(root, 'dist');

if (!fs.existsSync(source)) {
  console.error('Erro: pasta site não encontrada.');
  process.exit(1);
}

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });

if (!fs.existsSync(path.join(output, 'index.html'))) {
  console.error('Erro: dist/index.html não foi gerado.');
  process.exit(1);
}

console.log('Build concluído: dist/ gerado com sucesso.');
