// approve-weth.js
require('dotenv').config();
const { Wallet, JsonRpcProvider, Contract, parseEther } = require('ethers');

const WETH_ADDRESS = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const SPENDER = '0x111111125421ca6dc452d289314280a0f8842a65';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

async function approve() {
  console.log('🔓 Approving WETH for 1inch trading...\n');
  
  const provider = new JsonRpcProvider('https://sepolia.drpc.org', 11155111, {
    staticNetwork: true
  });
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const weth = new Contract(WETH_ADDRESS, ERC20_ABI, wallet);
  
  const currentAllowance = await weth.allowance(wallet.address, SPENDER);
  console.log('Current allowance:', currentAllowance.toString());
  
  if (currentAllowance > 0n) {
    console.log('✅ Already approved!');
    return;
  }
  
  const maxAmount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  console.log('\nApproving WETH...');
  
  try {
    const tx = await weth.approve(SPENDER, maxAmount);
    console.log('TX:', tx.hash);
    console.log('Waiting for confirmation...');
    await tx.wait();
    console.log('✅ Approved!\n');
    console.log('Now run: node working-demo.js');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

approve();
