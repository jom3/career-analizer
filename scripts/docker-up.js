// Levanta el stack de desarrollo descartando antes los volúmenes de
// node_modules, para que se repueblen desde la imagen recién construida.
// Sin este paso los named volumes quedan con dependencias obsoletas cuando
// cambian (docker-compose.yml monta backend_node_modules/frontend_node_modules).
const { execSync } = require('child_process');
const path = require('path');

const COMPOSE_FILE = 'docker-compose.yml';
const NODE_MODULES_VOLUMES = ['backend_node_modules', 'frontend_node_modules'];

function run(command) {
  console.log(`$ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function projectName() {
  return path.basename(process.cwd()).toLowerCase();
}

function removeNodeModulesVolumes() {
  const prefix = projectName();
  for (const volume of NODE_MODULES_VOLUMES) {
    const fullName = `${prefix}_${volume}`;
    try {
      run(`docker volume rm ${fullName}`);
    } catch {
      console.log(`Volume ${fullName} no existe; omitiendo.`);
    }
  }
}

run(`docker compose -f ${COMPOSE_FILE} down`);
removeNodeModulesVolumes();
run(`docker compose -f ${COMPOSE_FILE} up -d --build`);