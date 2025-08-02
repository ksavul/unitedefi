// polygon-limit-order.js
require("dotenv").config();
const {
  Api,
  LimitOrder,
  MakerTraits,
  Address,
  randBigInt,
  getLimitOrderV4Domain,
} = require("@1inch/limit-order-sdk");
const { Wallet, JsonRpcProvider, parseUnits, formatUnits } = require("ethers");

// Polygon Mainnet Configuration
const CONFIG = {
  NETWORK_ID: 137, // Polygon
  RPC_URL: "https://polygon-rpc.com", // Free public RPC
  TOKENS: {
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // Wrapped MATIC
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon (6 decimals)
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT on Polygon (6 decimals)
  },
  LIMIT_ORDER_CONTRACT: "0x111111125421ca6dc452d289314280a0f8842a65", // Same on all networks
  EXPLORER: "https://polygonscan.com",
};

async function main() {
  console.log("🚀 1inch Limit Order - Polygon Mainnet\n");
  console.log("⚠️  This uses REAL funds on Polygon (but fees are very low)\n");

  const authKey = process.env.AUTH_KEY;
  if (!authKey) {
    console.log("❌ Missing AUTH_KEY in .env");
    process.exit(1);
  }

  // Setup
  const provider = new JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("👛 Wallet:", wallet.address);

  // Check balances
  const { Contract } = require("ethers");

  // Check MATIC balance
  const maticBalance = await provider.getBalance(wallet.address);
  console.log("💰 MATIC:", formatUnits(maticBalance, 18));

  if (maticBalance < parseUnits("0.1", 18)) {
    console.log("\n❌ You need at least 0.1 MATIC for gas fees");
    console.log("Get MATIC from:");
    console.log("- Any exchange (Binance, Coinbase, etc.)");
    console.log(
      "- Bridge from Ethereum: https://wallet.polygon.technology/bridge"
    );
    process.exit(0);
  }

  // Check WMATIC balance
  const wmatic = new Contract(
    CONFIG.TOKENS.WMATIC,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const wmaticBalance = await wmatic.balanceOf(wallet.address);
  console.log("💰 WMATIC:", formatUnits(wmaticBalance, 18));

  if (wmaticBalance === 0n) {
    console.log("\n❌ You need WMATIC to trade");
    console.log("Creating wrap-matic.js for you...");

    const fs = require("fs").promises;
    const wrapScript = `// wrap-matic.js
require('dotenv').config();
const { Wallet, JsonRpcProvider, Contract, parseEther } = require('ethers');

async function wrapMatic() {
  const provider = new JsonRpcProvider('https://polygon-rpc.com');
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const wmatic = new Contract(WMATIC, [
    'function deposit() payable',
    'function balanceOf(address) view returns (uint256)'
  ], wallet);
  
  console.log('Wrapping 1 MATIC...');
  const tx = await wmatic.deposit({ value: parseEther('1') });
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('✅ Wrapped!');
}

wrapMatic().catch(console.error);
`;
    await fs.writeFile("wrap-matic.js", wrapScript);
    console.log("✅ Created wrap-matic.js");
    console.log("Run: node wrap-matic.js");
    process.exit(0);
  }

  // Create order
  const salt = randBigInt((1n << 256n) - 1n);
  const nonce = randBigInt((1n << 40n) - 1n);
  const expiration = BigInt(Math.floor(Date.now() / 1000)) + 300n; // 5 minutes

  const makerTraits = MakerTraits.default()
    .withExpiration(expiration)
    .withNonce(nonce);

  const makerTraitsValue = makerTraits.asBigInt().toString();

  const order = new LimitOrder({
    salt: salt.toString(),
    maker: new Address(wallet.address),
    receiver: new Address("0x0000000000000000000000000000000000000000"),
    makerAsset: new Address(CONFIG.TOKENS.WMATIC),
    takerAsset: new Address(CONFIG.TOKENS.USDC),
    makingAmount: parseUnits("0.1", 18).toString(), // 0.1 WMATIC
    takingAmount: parseUnits("0.05", 6).toString(), // 0.05 USDC (6 decimals!)
    makerTraits: makerTraitsValue,
  });

  console.log("\n📝 Order created:");
  console.log("- Selling: 0.1 WMATIC");
  console.log("- For: 0.05 USDC");
  console.log("- Rate: 0.5 USDC per WMATIC\n");

  // Sign order
  const domain = getLimitOrderV4Domain(CONFIG.NETWORK_ID);
  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "receiver", type: "address" },
      { name: "makerAsset", type: "address" },
      { name: "takerAsset", type: "address" },
      { name: "makingAmount", type: "uint256" },
      { name: "takingAmount", type: "uint256" },
      { name: "makerTraits", type: "uint256" },
    ],
  };

  const values = {
    salt: order.salt,
    maker: order.maker.toString(),
    receiver: order.receiver.toString(),
    makerAsset: order.makerAsset.toString(),
    takerAsset: order.takerAsset.toString(),
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    makerTraits: makerTraitsValue,
  };

  console.log("✍️  Signing...");
  const signature = await wallet.signTypedData(domain, types, values);
  console.log("✅ Signed\n");

  // Submit using Api
  const api = new Api({
    authKey: authKey,
    networkId: CONFIG.NETWORK_ID,
    httpConnector: {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return JSON.parse(text);
      },
      post: async (url, data, headers) => {
        console.log("Submitting to:", url);
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return JSON.parse(text);
      },
    },
  });

  console.log("📤 Submitting order...");

  try {
    await api.submitOrder(order, signature);
    console.log("\n🎉 SUCCESS! Your limit order is live on Polygon!");
    console.log("Order hash:", order.getOrderHash(CONFIG.NETWORK_ID));
    console.log("\n📊 View your order:");
    console.log(`https://app.1inch.io/#/${CONFIG.NETWORK_ID}/limit-order/`);
  } catch (error) {
    console.log("❌ Error:", error.message);

    if (error.message.includes("allowance")) {
      console.log("\n💡 You need to approve WMATIC first!");

      const approveScript = `// approve-wmatic.js
require('dotenv').config();
const { Wallet, JsonRpcProvider, Contract } = require('ethers');

async function approve() {
  const provider = new JsonRpcProvider('https://polygon-rpc.com');
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const SPENDER = '0x111111125421ca6dc452d289314280a0f8842a65';
  
  const wmatic = new Contract(WMATIC, [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ], wallet);
  
  const current = await wmatic.allowance(wallet.address, SPENDER);
  if (current > 0n) {
    console.log('Already approved!');
    return;
  }
  
  console.log('Approving WMATIC...');
  const tx = await wmatic.approve(SPENDER, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('✅ Approved!');
}

approve().catch(console.error);
`;
      const fs = require("fs").promises;
      await fs.writeFile("approve-wmatic.js", approveScript);
      console.log("✅ Created approve-wmatic.js");
      console.log("Run: node approve-wmatic.js");
    }
  }
}

main().catch(console.error);
