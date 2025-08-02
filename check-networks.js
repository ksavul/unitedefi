// check-networks.js
require("dotenv").config();

async function checkNetworks() {
  console.log(
    "🔍 Checking 1inch Limit Order support for different networks...\n"
  );

  const networks = [
    { name: "Ethereum Mainnet", id: 1 },
    { name: "Polygon", id: 137 },
    { name: "BSC", id: 56 },
    { name: "Arbitrum", id: 42161 },
    { name: "Optimism", id: 10 },
    { name: "Sepolia Testnet", id: 11155111 },
    { name: "Goerli Testnet", id: 5 },
  ];

  for (const network of networks) {
    try {
      const response = await fetch(
        `https://api.1inch.dev/orderbook/v4.0/${network.id}/`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AUTH_KEY}`,
          },
        }
      );

      if (response.ok) {
        console.log(`✅ ${network.name} (${network.id}): SUPPORTED`);
      } else {
        console.log(
          `❌ ${network.name} (${network.id}): NOT SUPPORTED (${response.status})`
        );
      }
    } catch (error) {
      console.log(
        `❌ ${network.name} (${network.id}): ERROR - ${error.message}`
      );
    }
  }

  console.log("\n💡 If Sepolia is not supported, you'll need to:");
  console.log("1. Use a mainnet (Ethereum, Polygon, etc.)");
  console.log("2. Get real tokens (small amounts for testing)");
  console.log("3. Pay real gas fees (use a cheap network like Polygon)");
}

checkNetworks().catch(console.error);
