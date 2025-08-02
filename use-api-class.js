// use-api-class.js
require("dotenv").config();
const { Api } = require("@1inch/limit-order-sdk");

async function main() {
  console.log("🚀 Testing 1inch API class\n");

  const authKey = process.env.AUTH_KEY;
  if (!authKey) {
    console.log("❌ Missing AUTH_KEY in .env");
    process.exit(1);
  }

  // Create API instance with httpConnector
  const api = new Api({
    authKey: authKey,
    networkId: 11155111,
    httpConnector: {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response.json();
      },
      post: async (url, data, headers) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response.json();
      },
    },
  });

  console.log("API instance created");
  console.log(
    "Available methods:",
    Object.getOwnPropertyNames(Object.getPrototypeOf(api))
  );

  // Check if api has properties
  console.log("\nAPI properties:");
  for (const key in api) {
    console.log(`- ${key}:`, typeof api[key]);
  }

  // Try to get active orders to test the API
  try {
    console.log("\nTrying to fetch orders for a test address...");
    const orders = await api.getOrdersByMaker(
      "0x0000000000000000000000000000000000000000"
    );
    console.log("Success! API is working");
    console.log("Orders:", orders);
  } catch (error) {
    console.log("Error:", error.message);
  }

  // Check the URL structure
  console.log("\nAPI Base URL:", api.baseUrl);
  console.log("URL method returns:", api.url("/test"));

  // Test what happens when we try to submit
  console.log("\nTesting submitOrder structure...");
  try {
    // This will fail but show us the URL
    await api.submitOrder({
      order: {
        salt: "1",
        maker: "0x0000000000000000000000000000000000000000",
        receiver: "0x0000000000000000000000000000000000000000",
        makerAsset: "0x0000000000000000000000000000000000000000",
        takerAsset: "0x0000000000000000000000000000000000000000",
        makingAmount: "1",
        takingAmount: "1",
        makerTraits: "0",
      },
      signature: "0x",
      extension: "0x",
    });
  } catch (error) {
    console.log("Submit error (expected):", error.message);
  }
}

main().catch(console.error);
