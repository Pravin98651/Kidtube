const { exec } = require('child_process');

function startTunnel() {
  console.log('Starting localtunnel on port 8080...');
  
  // Use a random subdomain but save it so we can print it
  const tunnel = exec('npx localtunnel --port 8080 --subdomain kidtube-backend-stable');

  tunnel.stdout.on('data', (data) => {
    console.log(`[Tunnel]: ${data.trim()}`);
  });

  tunnel.stderr.on('data', (data) => {
    console.error(`[Tunnel Error]: ${data.trim()}`);
  });

  tunnel.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}. Restarting in 3 seconds...`);
    setTimeout(startTunnel, 3000); // Restart immediately
  });
}

startTunnel();
