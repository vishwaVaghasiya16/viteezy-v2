const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const venvPython = isWindows 
  ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
  : path.join(__dirname, 'venv', 'bin', 'python');

const uvicorn = spawn(venvPython, [
  '-m', 'uvicorn',
  'app.main:app',
  '--reload',
  '--host', '0.0.0.0',
  '--port', '8000'
], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: isWindows
});

uvicorn.on('error', (error) => {
  console.error('Failed to start Python server:', error);
  process.exit(1);
});

uvicorn.on('exit', (code) => {
  console.log(`Python server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  uvicorn.kill('SIGINT');
});

process.on('SIGTERM', () => {
  uvicorn.kill('SIGTERM');
});

