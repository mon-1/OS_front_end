import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";

let web3;
let provider;

const RPC_TIMEOUT = 10000; // 10 seconds

const RPC_ENDPOINTS = [
  process.env.REACT_APP_RPC_ENDPOINT_1,
  process.env.REACT_APP_RPC_ENDPOINT_2,
  process.env.REACT_APP_RPC_ENDPOINT_3,
  process.env.REACT_APP_RPC_ENDPOINT_4,
  process.env.REACT_APP_RPC_ENDPOINT_5,
].filter(Boolean); // Filter out any undefined values

if (RPC_ENDPOINTS.length === 0) {
  throw new Error("No RPC endpoints configured in environment variables");
}

const CHAIN_CONFIG = {
  chainId: "0x2105",
  chainName: "Base",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: RPC_ENDPOINTS,
  blockExplorerUrls: ["basescan.org"],
};

const createProvider = (rpcUrl) => {
  if (rpcUrl.startsWith("wss")) {
    return new Web3.providers.WebsocketProvider(rpcUrl, {
      timeout: RPC_TIMEOUT,
      reconnect: {
        auto: true,
        delay: 1000,
        maxAttempts: 5,
      },
    });
  }
  return new Web3.providers.HttpProvider(rpcUrl, {
    timeout: RPC_TIMEOUT,
  });
};

const tryRpcConnection = async (rpcUrl) => {
  try {
    const provider = createProvider(rpcUrl);
    const tempWeb3 = new Web3(provider);

    // Test connection with timeout
    const connectionTest = Promise.race([
      tempWeb3.eth.getBlockNumber(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("RPC Timeout")), RPC_TIMEOUT)
      ),
    ]);

    await connectionTest;
    return tempWeb3;
  } catch (error) {
    console.warn(`RPC ${rpcUrl} failed:`, error.message);
    return null;
  }
};

const initWeb3 = async () => {
  try {
    provider = await detectEthereumProvider();

    if (!provider) {
      // Try RPC endpoints if no MetaMask
      for (const rpcUrl of RPC_ENDPOINTS) {
        const web3Instance = await tryRpcConnection(rpcUrl);
        if (web3Instance) {
          web3 = web3Instance;
          console.log("Connected via RPC:", rpcUrl);
          return web3;
        }
      }
      throw new Error("No working RPC endpoint found");
    }

    web3 = new Web3(provider);

    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("User rejected account access");
      throw error;
    }

    const currentChainId = await web3.eth.getChainId();
    const targetChainId = parseInt(CHAIN_CONFIG.chainId, 16);

    if (currentChainId !== targetChainId) {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_CONFIG.chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [CHAIN_CONFIG],
            });
          } catch (addError) {
            console.error("Failed to add network:", addError);
            // Try fallback RPC connections
            for (const rpcUrl of RPC_ENDPOINTS) {
              const fallbackWeb3 = await tryRpcConnection(rpcUrl);
              if (fallbackWeb3) {
                web3 = fallbackWeb3;
                console.log("Connected using fallback RPC:", rpcUrl);
                return;
              }
            }
            throw new Error("Failed to connect to any RPC endpoint");
          }
        } else {
          throw switchError;
        }
      }
    }

    // Verify connection
    const isConnected = await web3.eth.net.isListening();
    if (!isConnected) {
      throw new Error("Failed to establish web3 connection");
    }

    console.log("Web3 initialized successfully");
    return web3;
  } catch (error) {
    console.error("Web3 initialization failed:", error);
    throw error;
  }
};

const checkConnection = async () => {
  try {
    await web3.eth.net.isListening();
    return true;
  } catch (error) {
    return false;
  }
};

const getWeb3 = async () => {
  if (!web3 || !(await checkConnection())) {
    await initWeb3();
  }
  return web3;
};

export { initWeb3, getWeb3, web3, checkConnection };
