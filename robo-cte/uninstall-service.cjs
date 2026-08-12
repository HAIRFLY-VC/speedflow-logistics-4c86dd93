const { Service } = require('node-windows');
const path = require('path');

const roboPath = path.dirname(__filename);
const scriptPath = path.join(roboPath, 'index.js');

const svc = new Service({
  name: 'SpeedFlow Robo CT-e',
  description: 'Robo de captura de CT-e e NF-e para o SpeedFlow Logistics',
  script: scriptPath,
  workingDirectory: roboPath
});

svc.on('uninstall', function () {
  console.log('Servico desinstalado com sucesso.');
});

svc.on('error', function (err) {
  console.error('Erro ao desinstalar o servico:', err.message || err);
  process.exit(1);
});

svc.uninstall();
