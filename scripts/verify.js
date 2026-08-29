const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.join(__dirname, '..');
  const deployment = JSON.parse(
    fs.readFileSync(path.join(root, 'deployments', 'monad-testnet.json'), 'utf8'),
  );
  const buildInfoDir = path.join(root, 'artifacts', 'build-info');
  const buildInfoFile = fs.readdirSync(buildInfoDir)
    .map((name) => ({ name, time: fs.statSync(path.join(buildInfoDir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time)[0]?.name;
  if (!buildInfoFile) throw new Error('Compile the contract before verification');
  const build = JSON.parse(fs.readFileSync(path.join(buildInfoDir, buildInfoFile), 'utf8'));
  const metadata = JSON.parse(
    build.output.contracts['contracts/Sponsio.sol'].Sponsio.metadata,
  );
  const payload = {
    chainId: 10143,
    contractAddress: deployment.address,
    contractName: 'contracts/Sponsio.sol:Sponsio',
    compilerVersion: `v${build.solcLongVersion}`,
    standardJsonInput: build.input,
    foundryMetadata: metadata,
  };

  const response = await fetch('https://agents.devnads.com/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.text();
  if (!response.ok) throw new Error(`Verification failed (${response.status}): ${result}`);
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
