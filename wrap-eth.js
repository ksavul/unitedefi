// wrap-eth.js
require('dotenv').config();
const { Wallet, JsonRpcProvider, Contract, parseEther } = require('ethers');

const WETH_ADDRESS = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const WETH_ABI = [
    'function deposit() payable',
    'function balanceOf(address) view returns (uint256)'
];

async function wrapETH() {
    console.log('🔄 Wrapping ETH to WETH on Sepolia...\n');
    
    const provider = new JsonRpcProvider('https://sepolia.drpc.org', 11155111, {
        staticNetwork: true
    });
    const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
    const weth = new Contract(WETH_ADDRESS, WETH_ABI, wallet);
    
    const balanceBefore = await weth.balanceOf(wallet.address);
    console.log('Current WETH balance:', balanceBefore.toString());
    
    const amountToWrap = parseEther('0.001');
    console.log('\nWrapping 0.001 ETH...');
    
    try {
        const tx = await weth.deposit({ value: amountToWrap });
        console.log('Transaction sent:', tx.hash);
        console.log('Waiting for confirmation...');
        await tx.wait();
        console.log('✅ ETH wrapped successfully!');
        
        const balanceAfter = await weth.balanceOf(wallet.address);
        console.log('\nNew WETH balance:', balanceAfter.toString());
        console.log('\nYou can now run: node testnet-demo.js');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

wrapETH();
