// actual-working.js
require("dotenv").config();
const {
  Api,
  LimitOrder,
  MakerTraits,
  Address,
  randBigInt,
  getLimitOrderV4Domain,
} = require("@1inch/limit-order-sdk");
const { Wallet, JsonRpcProvider, parseEther } = require("ethers");

async function main() {
  console.log("🚀 1inch Limit Order - Using Available SDK\n");

  const authKey = process.env.AUTH_KEY;
  if (!authKey) {
    console.log("❌ Missing AUTH_KEY in .env");
    process.exit(1);
  }

  // Setup
  const provider = new JsonRpcProvider("https://sepolia.drpc.org", 11155111, {
    staticNetwork: true,
  });
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("👛 Wallet:", wallet.address);

  // Check WETH balance
  const { Contract } = require("ethers");
  const weth = new Contract(
    "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await weth.balanceOf(wallet.address);
  console.log("💰 WETH:", balance.toString(), "\n");

  // Create order manually since Sdk class doesn't exist
  const salt = randBigInt((1n << 256n) - 1n);
  const nonce = randBigInt((1n << 40n) - 1n);
  const expiration = BigInt(Math.floor(Date.now() / 1000)) + 120n; // 2 minutes

  const makerTraits = MakerTraits.default()
    .withExpiration(expiration)
    .withNonce(nonce);

  // Debug makerTraits
  const makerTraitsValue = makerTraits.asBigInt().toString();
  console.log("MakerTraits after setup:", makerTraitsValue);

  const order = new LimitOrder({
    salt: salt.toString(),
    maker: new Address(wallet.address),
    receiver: new Address("0x0000000000000000000000000000000000000000"),
    makerAsset: new Address("0xfff9976782d46cc05630d1f6ebab18b2324d6b14"), // WETH
    takerAsset: new Address("0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"), // USDC
    makingAmount: "100000000000000", // 0.0001 WETH
    takingAmount: "100000", // 0.1 USDC
    makerTraits: makerTraitsValue, // Use the calculated value directly
  });

  console.log("📝 Order created");
  console.log("- Selling: 0.0001 WETH");
  console.log("- For: 0.1 USDC\n");

  // Debug: Check order structure
  console.log("Order object:", order);
  console.log("MakerTraits value:", order.makerTraits);
  console.log("MakerTraits type:", typeof order.makerTraits);

  // Sign order
  const domain = getLimitOrderV4Domain(11155111);
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

  // Make sure all values are strings
  const values = {
    salt: order.salt.toString(),
    maker: order.maker.toString(),
    receiver: order.receiver.toString(),
    makerAsset: order.makerAsset.toString(),
    takerAsset: order.takerAsset.toString(),
    makingAmount: order.makingAmount.toString(),
    takingAmount: order.takingAmount.toString(),
    makerTraits: makerTraitsValue, // Use the calculated value we stored earlier
  };

  console.log("Values for signing:", values);

  console.log("✍️  Signing...");
  const signature = await wallet.signTypedData(domain, types, values);
  console.log("✅ Signed\n");

  // Submit using Api class
  const api = new Api({
    authKey: authKey,
    networkId: 11155111,
    httpConnector: {
      get: async (url, headers) => {
        console.log("GET:", url);
        const response = await fetch(url, { headers });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return JSON.parse(text);
      },
      post: async (url, data, headers) => {
        console.log("POST:", url);
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

  console.log("📤 Submitting order using Api class...");

  try {
    // Submit the order object directly
    await api.submitOrder(order, signature);
    console.log("\n🎉 SUCCESS! Your limit order is live!");
    console.log("Order hash:", order.getOrderHash(11155111));
  } catch (error) {
    console.log("❌ Error:", error.message);

    // Check for specific errors
    if (
      error.message.includes("allowance") ||
      error.message.includes("approve")
    ) {
      console.log("\n💡 You need to approve WETH first!");
      console.log(
        "Spender address:",
        "0x111111125421ca6dc452d289314280a0f8842a65"
      );

      // Create approval script
      const fs = require("fs").promises;
      const approvalScript = `// approve-weth.js
require('dotenv').config();
const { Wallet, JsonRpcProvider, Contract } = require('ethers');

const WETH = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const SPENDER = '0x111111125421ca6dc452d289314280a0f8842a65';

async function approve() {
  const provider = new JsonRpcProvider('https://sepolia.drpc.org', 11155111, {
    staticNetwork: true
  });
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const weth = new Contract(WETH, [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ], wallet);
  
  // Check current allowance
  const currentAllowance = await weth.allowance(wallet.address, SPENDER);
  console.log('Current allowance:', currentAllowance.toString());
  
  if (currentAllowance > 0n) {
    console.log('✅ Already approved!');
    return;
  }
  
  console.log('Approving WETH...');
  const tx = await weth.approve(SPENDER, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('✅ Approved!');
}

approve().catch(console.error);
`;
      await fs.writeFile("approve-weth.js", approvalScript);
      console.log("\n✅ Created approve-weth.js");
      console.log("Run: node approve-weth.js");
    } else if (error.message.includes("404")) {
      console.log("\n⚠️  The API endpoint might not support Sepolia testnet");
      console.log("Try using Ethereum mainnet or another supported network");
    }
  }
}

main().catch(console.error);
