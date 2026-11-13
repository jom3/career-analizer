// Copia los archivos de backend/uploads al named volume `uploads` que monta el
// backend dockerizado. Sin este paso la app dentro del contenedor no encuentra
// los CVs ni las fotos que ya existen en el host, porque la ruta
// /app/backend/uploads la resuelve el volumen y no el directorio del repo.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(process.cwd(), 'backend', 'uploads');
const VOLUME_SUFFIX = 'uploads';
// Usuario `node` de las imágenes node:22-alpine; el backend de prod corre con él.
const NODE_UID_GID = '1000:1000';

function volumeName() {
  return `${path.basename(process.cwd()).toLowerCase()}_${VOLUME_SUFFIX}`;
}

function run(command) {
  console.log(`$ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`No existe ${SOURCE_DIR}; nada para copiar.`);
  process.exit(1);
}

const volume = volumeName();
const source = SOURCE_DIR.replace(/\\/g, '/');

// cp -a preserva la estructura (uploads/profile/...) y el chown deja el
// volumen escribible para el usuario sin privilegios del contenedor.
run(
  `docker run --rm -v "${source}:/source:ro" -v ${volume}:/target alpine ` +
    `sh -c "cp -a /source/. /target/ && chown -R ${NODE_UID_GID} /target"`,
);

run(
  `docker run --rm -v ${volume}:/target alpine ` +
    `sh -c "echo 'Archivos en ${volume}:'; find /target -type f | wc -l"`,
);
