const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

async function main() {
  if (hre.network.name !== 'monadTestnet') {
    throw new Error('Sponsio deployments must target --network monadTestnet');
  }
  const Sponsio = await hre.ethers.getContractFactory('Sponsio');
  const sponsio = await Sponsio.deploy();
  await sponsio.waitForDeployment();
  const address = await sponsio.getAddress();
  const code = await hre.ethers.provider.getCode(address);
  if (code === '0x') throw new Error('Deployment completed without bytecode');

  const output = {
    network: 'monadTestnet',
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    address,
    deployedAt: new Date().toISOString(),
  };
  const outputPath = path.join(__dirname, '..', 'deployments', 'monad-testnet.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  const readmePath = path.join(__dirname, '..', 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const contractSection = [
    '<!-- SPONSIO_CONTRACT_START -->',
    `- Monad Testnet contract: [\`${address}\`](https://testnet.monadscan.com/address/${address})`,
    '<!-- SPONSIO_CONTRACT_END -->',
  ].join('\n');
  fs.writeFileSync(
    readmePath,
    readme.replace(
      /<!-- SPONSIO_CONTRACT_START -->[\s\S]*?<!-- SPONSIO_CONTRACT_END -->/,
      contractSection,
    ),
  );
  const explorerUrl = `https://testnet.monadscan.com/address/${address}`;
  const socialPath = path.join(__dirname, '..', 'docs', 'SOCIAL_PACK.md');
  fs.writeFileSync(
    socialPath,
    fs.readFileSync(socialPath, 'utf8').replaceAll('[MONADSCAN_URL]', explorerUrl),
  );
  const pitchPath = path.join(__dirname, '..', 'PITCH.md');
  fs.writeFileSync(
    pitchPath,
    fs.readFileSync(pitchPath, 'utf8')
      .replace('- Monad Testnet contract: pending', `- Monad Testnet contract: <${explorerUrl}>`)
      .replace('- Verified source: pending', `- Verified source: <${explorerUrl}#code>`),
  );
  console.log(`Sponsio deployed to ${address}`);
  console.log(`https://testnet.monadscan.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
