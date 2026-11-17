/**
 * Creates fresh wallets for a QIE deployment and stores their keys ONLY in git-ignored env files:
 *   - deployer key -> .env                (DEPLOYER_PRIVATE_KEY)
 *   - relayer key  -> web/.env.local      (RELAYER_PRIVATE_KEY_<NETWORK>)
 * It prints addresses only, never keys, and never overwrites a key that is already set.
 *
 *   node scripts/new-wallets.cjs qieTestnet
 *
 * Fund both printed addresses with a little QIE (testnet: https://www.qie.digital/faucet).
 * Use these wallets only for AjoProof; never put personal funds in them.
 */
const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");

const network = process.argv[2];
if (!["qieTestnet", "qieMainnet"].includes(network)) {
  console.error("Usage: node scripts/new-wallets.cjs <qieTestnet|qieMainnet>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");

/** Set KEY=value in an env file only if it is missing or empty. Returns the existing value if present. */
function setOnce(file, key, value, template) {
  let text = read(file) || (template ? read(template) : "");
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = text.match(re);
  if (m && m[1].trim()) return { created: false, value: m[1].trim() };
  text = m ? text.replace(re, `${key}=${value}`) : `${text.replace(/\n?$/, "\n")}${key}=${value}\n`;
  fs.writeFileSync(file, text);
  return { created: true, value };
}

function ensureWallet(file, key, template) {
  const fresh = Wallet.createRandom();
  const r = setOnce(file, key, fresh.privateKey, template);
  return { address: new Wallet(r.value).address, created: r.created };
}

const deployer = ensureWallet(path.join(root, ".env"), "DEPLOYER_PRIVATE_KEY", path.join(root, ".env.example"));
const relayer = ensureWallet(path.join(root, "web", ".env.local"), `RELAYER_PRIVATE_KEY_${network.toUpperCase()}`);

console.log(`\nWallets for ${network} (keys saved in git-ignored files, not shown):\n`);
console.log(`  Deployer  ${deployer.address}  ${deployer.created ? "(new, saved to .env)" : "(already set in .env)"}`);
console.log(`  Relayer   ${relayer.address}  ${relayer.created ? "(new, saved to web/.env.local)" : "(already set in web/.env.local)"}`);
console.log(`\nNext: send a little ${network === "qieTestnet" ? "test " : ""}QIE to both addresses${network === "qieTestnet" ? " from https://www.qie.digital/faucet" : ""}.\n`);
