const { Service } = require('node-windows');
const path = require('path');

const roboPath = path.dirname(__filename);
const scriptPath = path.join(roboPath, 'index.js');
const logDir = path.join(roboPath, 'logs');

const svc = new Service({
  name: 'SpeedFlow Robo CT-e',
  description: 'Robo de captura de CT-e e NF-e para o SpeedFlow Logistics',
  script: scriptPath,
  workingDirectory: roboPath,
  env: [
    { name: 'NODE_ENV', value: 'production' }
  ],
  logOnAsAccount: 'LocalSystem',
  logOnAsPassword: null
});

svc.on('install', function () {
  console.log('Servico instalado com sucesso.');
  svc.start();
  console.log('Servico iniciado.');
  console.log(`Verifique os logs em: ${logDir}`);
});

svc.on('alreadyinstalled', function () {
  console.log('Servico ja estava instalado.');
});

svc.on('start', function () {
  console.log('Servico em execucao.');
});

svc.on('error', function (err) {
  console.error('Erro ao gerenciar o servico:', err.message || err);
  process.exit(1);
});

svc.install();
