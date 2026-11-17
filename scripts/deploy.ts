/**
 * Deploys AjoForwarder, AjoPassbook and AjoCircle, then writes their addresses to
 * deployments/<network>.json and web/src/lib/deployments/<network>.json for the app.
 *
 *   Local:   npx hardhat node            (terminal 1)
 *            npx hardhat run scripts/deploy.ts --network localhost   (terminal 2)
 *   Testnet: npx hardhat run scripts/deploy.ts --network qieTestnet  (needs DEPLOYER_PRIVATE_KEY in .env)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying to ${network.name} (chain ${chainId}) from ${deployer.address}`);

  const forwarder = await (await ethers.getContractFactory("AjoForwarder")).deploy();
  await forwarder.waitForDeployment();
  const passbook = await (await ethers.getContractFactory("AjoPassbook")).deploy(await forwarder.getAddress());
  await passbook.waitForDeployment();
  const circle = await (await ethers.getContractFactory("AjoCircle")).deploy();
  await circle.waitForDeployment();

  const out: Record<string, unknown> = {
    network: network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    deployBlock: await ethers.provider.getBlockNumber(),
    AjoForwarder: await forwarder.getAddress(),
    AjoPassbook: await passbook.getAddress(),
    AjoCircle: await circle.getAddress(),
  };

  // Circle mode's stablecoin. Mainnet uses real QUSDC (set QUSDC_ADDRESS in .env);
  // local and testnet get a stand-in test token so circles can be tried for free.
  if (network.name === "qieMainnet") {
    if (!process.env.QUSDC_ADDRESS) throw new Error("Set QUSDC_ADDRESS in .env before deploying to mainnet.");
    out.Stablecoin = ethers.getAddress(process.env.QUSDC_ADDRESS);
  } else {
    const stable = await (await ethers.getContractFactory("MockStable")).deploy();
    await stable.waitForDeployment();
    out.Stablecoin = await stable.getAddress();
  }

  const json = JSON.stringify(out, null, 2);
  for (const dir of [path.join(__dirname, "..", "deployments"), path.join(__dirname, "..", "web", "src", "lib", "deployments")]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${network.name}.json`), json + "\n");
  }
  console.log(json);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
