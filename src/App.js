import React, { useContext, useState, useEffect, useCallback } from "react";
import "./App.css";
import { Web3Context } from "./Web3Context";
import OmniStakerL2 from "./OmniStakerL2.json";
import logo from "./Omni_Staker_Logo.jpg";
import { checkConnection } from "./web3"; // Removed unused getWeb3 import
import layerZeroLogo from "./LayerZero_logo.png";
import ethenaLogo from "./Ethena.avif";
import IERC20 from "./IERC20.json";
import githubLogo from "./GH.png";
import xLogo from "./X.png";
import GeoBlock from "./GeoBlock"; // Import the GeoBlock component

// Transaction Popup Component
const TransactionPopup = ({ txHash, onClose }) => {
  if (!txHash) return null;

  return (
    <div className="tx-popup">
      <div className="tx-popup-header">
        <span className="tx-popup-title">Transaction Submitted</span>
        <button className="tx-popup-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="tx-popup-links">
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-popup-link"
        >
          View on BaseScan
        </a>
        <a
          href={`https://layerzeroscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-popup-link"
        >
          View on LayerZero Scanner
        </a>
      </div>
    </div>
  );
};

// Constants
const CONTRACT_ADDRESS = "0xC0c0EbfC83e9E9d1A2ED809B4F841BcFB58ACEFE";
const OFT_STAKING_ADDRESS = "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34";
// Will be used for unstaking functionality in future version
const OFT_UNSTAKING_ADDRESS = "0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2"; // eslint-disable-line no-unused-vars
const GAS_PRICE_ORACLE_ADDRESS = "0x420000000000000000000000000000000000000F";
const MIN_STAKE_AMOUNT = 5;

// Transaction Status Component
const TransactionStatus = ({ status, hash }) => {
  if (!status) return null;

  const isSuccess = status.toLowerCase().includes("success");
  const isPending =
    status.toLowerCase().includes("preparing") ||
    status.toLowerCase().includes("submitting") ||
    status.toLowerCase().includes("waiting");

  return (
    <div
      className={`transaction-status ${
        isSuccess ? "success" : isPending ? "pending" : "error"
      }`}
    >
      <div className="status-icon">
        {isSuccess ? "✓" : isPending ? "⏳" : "✗"}
      </div>
      <div className="status-message">
        <p>{status}</p>
        {hash && (
          <div className="transaction-links">
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on BaseScan
            </a>
            <a
              href={`https://layerzeroscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on LayerZero Scanner
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const { account, web3, isConnected, reconnect, disconnect } =
    useContext(Web3Context);
  const [stakeAmount, setStakeAmount] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [soloFee, setSoloFee] = useState(null);
  const [batchFee, setBatchFee] = useState(null);
  const [l1BaseFee, setL1BaseFee] = useState(null);
  const [threshold, setThreshold] = useState(5);
  const [activeTab, setActiveTab] = useState("solo");
  const [batchMode, setBatchMode] = useState("stake"); // Add state for batch sub-mode
  // Will be populated when batch functionality is implemented
  const [userBatches, setUserBatches] = useState([]); // eslint-disable-line no-unused-vars
  const [ethPrice, setEthPrice] = useState(null);
  const [showTxPopup, setShowTxPopup] = useState(false);

  // Contract instances
  const getOmniStakerContract = useCallback(() => {
    if (!web3) return null;
    return new web3.eth.Contract(OmniStakerL2, CONTRACT_ADDRESS);
  }, [web3]);

  const getGasPriceOracleContract = useCallback(() => {
    if (!web3) return null;
    const abi = [
      {
        inputs: [],
        name: "l1BaseFee",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ];
    return new web3.eth.Contract(abi, GAS_PRICE_ORACLE_ADDRESS);
  }, [web3]);

  const getUSDETokenContract = useCallback(() => {
    if (!web3) return null;
    return new web3.eth.Contract(IERC20.abi, OFT_STAKING_ADDRESS);
  }, [web3]);

  // Fetch contract data
  const fetchContractData = useCallback(async () => {
    if (!web3 || !account) return;

    try {
      // Fetch threshold
      const contract = getOmniStakerContract();
      // Note: This might need to be adjusted based on your actual contract methods
      // If threshold is not directly accessible, you might need to use a different method
      try {
        const thresh = await contract.methods.threshold().call();
        setThreshold(Number(thresh) || 5);
      } catch (err) {
        console.warn("Could not fetch threshold, using default:", err);
        setThreshold(5);
      }

      // Fetch L1 base fee
      try {
        const oracleContract = getGasPriceOracleContract();
        const fee = await oracleContract.methods.l1BaseFee().call();
        setL1BaseFee(web3.utils.fromWei(fee, "gwei"));
      } catch (err) {
        console.error("Error fetching L1 base fee:", err);
      }

      // Fetch user batches if needed
      // This would be implemented based on your contract structure
    } catch (error) {
      console.error("Error fetching contract data:", error);
    }
  }, [web3, account, getOmniStakerContract, getGasPriceOracleContract]);

  // Estimate fees
  const estimateFees = useCallback(async () => {
    if (!web3 || !account) return;

    try {
      const contract = getOmniStakerContract();
      const testAmount = web3.utils.toWei("10", "ether");

      // Estimate solo fee
      const soloFeeWei = await contract.methods
        .estimate_fee_helper(testAmount, OFT_STAKING_ADDRESS, false)
        .call({ from: account });

      const soloFeeEth = Number(
        web3.utils.fromWei(soloFeeWei, "ether")
      ).toFixed(6);
      setSoloFee(soloFeeEth);

      // Calculate batch fee based on threshold
      const batchFeeEth = (Number(soloFeeEth) / threshold).toFixed(6);
      setBatchFee(batchFeeEth);
    } catch (error) {
      console.error("Error estimating fees:", error);
    }
  }, [web3, account, getOmniStakerContract, threshold]);

  // Fetch ETH price in USD
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await response.json();
      if (data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
      }
    } catch (error) {
      console.error("Error fetching ETH price:", error);
    }
  }, []);

  // Initialize and refresh data
  useEffect(() => {
    if (web3 && account) {
      fetchContractData();
      estimateFees();
      fetchEthPrice(); // Fetch ETH price initially

      const feeInterval = setInterval(() => {
        estimateFees();
        fetchContractData();
      }, 30000);

      const priceInterval = setInterval(() => {
        fetchEthPrice();
      }, 60000); // Refresh price every minute

      return () => {
        clearInterval(feeInterval);
        clearInterval(priceInterval);
      };
    } else {
      // Even if not connected, fetch ETH price
      fetchEthPrice();
      const priceInterval = setInterval(fetchEthPrice, 60000);
      return () => clearInterval(priceInterval);
    }
  }, [web3, account, fetchContractData, estimateFees, fetchEthPrice]);

  // Check and handle token allowance
  const checkAndApproveToken = async (amount) => {
    const tokenContract = getUSDETokenContract();
    const amountWei = web3.utils.toWei(amount.toString(), "ether");

    const allowance = await tokenContract.methods
      .allowance(account, CONTRACT_ADDRESS)
      .call();

    if (BigInt(allowance) < BigInt(amountWei)) {
      setTxStatus("Approving token spending...");
      const tx = await tokenContract.methods
        .approve(CONTRACT_ADDRESS, amountWei)
        .send({ from: account });
      setTxStatus("Approval successful!");
      return tx;
    }

    return true; // Already approved
  };

  // Solo stake function
  const handleSoloStake = async () => {
    if (!web3 || !account) {
      setError("Please connect your wallet");
      return;
    }

    if (isNaN(stakeAmount) || Number(stakeAmount) < MIN_STAKE_AMOUNT) {
      setError(`Minimum staking amount is ${MIN_STAKE_AMOUNT} USDE`);
      return;
    }

    setLoading(true);
    setError(null);
    setTxStatus("Preparing transaction...");
    setTxHash(null);

    try {
      // Check connection
      if (!(await checkConnection())) {
        setTxStatus("Reconnecting to network...");
        await reconnect();
      }

      // Convert amount to wei
      const amountWei = web3.utils.toWei(stakeAmount, "ether");

      // Check and approve token allowance
      await checkAndApproveToken(stakeAmount);

      // Estimate fee for this specific transaction
      const contract = getOmniStakerContract();
      const feeWei = await contract.methods
        .estimate_fee_helper(amountWei, OFT_STAKING_ADDRESS, false)
        .call({ from: account });

      setTxStatus("Submitting stake transaction...");

      // Execute stake transaction
      const tx = await contract.methods
        .stake_USDe(amountWei)
        .send({ from: account, value: feeWei });

      setTxHash(tx.transactionHash);
      setTxStatus("Stake successful! Tokens are being bridged to Ethereum.");

      // Show popup for successful transaction
      setShowTxPopup(true);

      // Auto-hide popup after 15 seconds
      setTimeout(() => {
        setShowTxPopup(false);
      }, 15000);

      // Clear input
      setStakeAmount("");
    } catch (error) {
      console.error("Staking error:", error);
      if (error.message.includes("user rejected")) {
        setError("Transaction was rejected");
      } else if (error.message.includes("insufficient funds")) {
        setError("Insufficient funds for gas fee");
      } else {
        setError(`Transaction failed: ${error.message.slice(0, 100)}...`);
      }
      setTxStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Batch stake function (placeholder for now)
  const handleBatchStake = async () => {
    setError("Batch staking coming soon!");
  };

  // Withdraw function (placeholder for now)
  const handleWithdraw = async () => {
    setError("Withdrawal functionality coming soon!");
  };

  // Clear any errors when switching tabs or batch modes
  const handleTabChange = (tab) => {
    setError(null);
    setActiveTab(tab);
  };

  const handleBatchModeChange = (mode) => {
    setError(null);
    setBatchMode(mode);
  };

  // Helper to format USD value
  const formatUsdValue = (ethAmount) => {
    if (!ethPrice || !ethAmount) return null;
    const usdValue = Number(ethAmount) * ethPrice;
    return usdValue.toFixed(2);
  };

  // Add popup close handler
  const handleClosePopup = () => {
    setShowTxPopup(false);
  };

  return (
    <GeoBlock>
      <div className="App">
        <header className="App-header">
          <div className="wallet-connection">
            {isConnected ? (
              <div className="account-info">
                <span className="account-address">
                  {account?.slice(0, 6)}...{account?.slice(-4)}
                </span>
                <button onClick={disconnect} className="disconnect-btn">
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={reconnect} className="connect-btn">
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <main className="main-container">
          <div className="logo-container">
            <img src={logo} className="App-logo" alt="Omni Staker Logo" />
            <h1>Omni Staker</h1>
            <p className="tagline">
              Cross-chain USDe staking solution powered by LayerZero
            </p>
          </div>

          <div className="staking-container">
            {/* Simplified tabs: only Solo and Batched */}
            <div className="tabs">
              <button
                className={`tab-btn ${activeTab === "solo" ? "active" : ""}`}
                onClick={() => handleTabChange("solo")}
              >
                Solo Stake
              </button>
              <button
                className={`tab-btn ${activeTab === "batch" ? "active" : ""}`}
                onClick={() => handleTabChange("batch")}
              >
                Batched Mode{" "}
                <span className="coming-soon-tag">Coming Soon</span>
              </button>
            </div>

            {isConnected ? (
              <div className="stake-form">
                {/* For batched mode, show sub-tabs */}
                {activeTab === "batch" && (
                  <div className="batch-modes">
                    <button
                      className={`batch-mode-btn ${
                        batchMode === "stake" ? "active" : ""
                      }`}
                      onClick={() => handleBatchModeChange("stake")}
                    >
                      Stake
                    </button>
                    <button
                      className={`batch-mode-btn ${
                        batchMode === "withdraw" ? "active" : ""
                      }`}
                      onClick={() => handleBatchModeChange("withdraw")}
                    >
                      Withdraw
                    </button>
                  </div>
                )}

                <div className="form-info">
                  {activeTab === "solo" && (
                    <div className="fee-info">
                      <p>
                        Solo stake fee:{" "}
                        <strong>
                          {soloFee ? `${soloFee} ETH` : "Calculating..."}
                          {soloFee && ethPrice && (
                            <span className="usd-value">
                              {" "}
                              (≈${formatUsdValue(soloFee)} USD)
                            </span>
                          )}
                        </strong>
                      </p>
                      <p>
                        L1 Base Fee:{" "}
                        <strong>
                          {l1BaseFee
                            ? `${Number(l1BaseFee).toFixed(2)} Gwei`
                            : "Loading..."}
                        </strong>
                      </p>
                      <p className="fee-description">
                        Your tokens will be staked Ethereum mainnet, and you
                        will receive sUSDe on your chain of choice.
                      </p>
                    </div>
                  )}

                  {activeTab === "batch" && batchMode === "stake" && (
                    <div className="fee-info">
                      <div className="coming-soon-overlay">
                        <span>Coming Soon</span>
                      </div>
                      <p>
                        Batch stake fee:{" "}
                        <strong>
                          {batchFee ? `${batchFee} ETH` : "Calculating..."}
                          {batchFee && ethPrice && (
                            <span className="usd-value">
                              {" "}
                              (≈${formatUsdValue(batchFee)} USD)
                            </span>
                          )}
                        </strong>
                      </p>
                      <p className="fee-description">
                        Your tokens will be batched with others to reduce fees.
                        Withdrawal available after processing.
                      </p>
                    </div>
                  )}

                  {activeTab === "batch" && batchMode === "withdraw" && (
                    <div className="fee-info">
                      <div className="coming-soon-overlay">
                        <span>Coming Soon</span>
                      </div>
                      <p className="fee-description">
                        Withdraw your batched staked tokens after they've been
                        processed on Ethereum
                      </p>
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => {
                      setStakeAmount(e.target.value);
                      setError(null);
                    }}
                    min={MIN_STAKE_AMOUNT}
                    placeholder={`Enter an amount (min. ${MIN_STAKE_AMOUNT} USDE)`}
                    disabled={
                      loading ||
                      (activeTab === "batch" && batchMode === "withdraw")
                    }
                    className="amount-input"
                  />

                  <button
                    onClick={
                      activeTab === "solo"
                        ? handleSoloStake
                        : batchMode === "stake"
                        ? handleBatchStake
                        : handleWithdraw
                    }
                    disabled={
                      loading ||
                      activeTab === "batch" || // Disable all batch functionality for now
                      (activeTab === "solo" &&
                        (!stakeAmount ||
                          Number(stakeAmount) < MIN_STAKE_AMOUNT))
                    }
                    className="action-button"
                  >
                    {loading
                      ? "Processing..."
                      : activeTab === "solo"
                      ? "Stake Solo"
                      : batchMode === "stake"
                      ? "Batch Stake"
                      : "Withdraw"}
                  </button>
                </div>

                {txStatus && (
                  <TransactionStatus status={txStatus} hash={txHash} />
                )}
                {error && <div className="error-message">{error}</div>}

                {activeTab === "batch" && batchMode === "withdraw" && (
                  <div className="batches-list">
                    <h3>Your Batches</h3>
                    <p className="no-batches">
                      Batch functionality will be available soon
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="connect-prompt">
                Please connect your wallet to use Omni Staker
              </div>
            )}
          </div>
        </main>

        <footer>
          <div className="powered-by">
            <span>Powered by</span>
            <a
              href="https://ethena.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="powered-by-link"
            >
              <img src={ethenaLogo} alt="Ethena" className="ethena-logo" />
            </a>
            <span className="powered-by-separator">&</span>
            <a
              href="https://layerzero.network"
              target="_blank"
              rel="noopener noreferrer"
              className="powered-by-link"
            >
              <img
                src={layerZeroLogo}
                alt="LayerZero"
                className="layerzero-logo"
              />
            </a>
          </div>

          <div className="social-links">
            <a
              href="https://github.com/owl11/Omni-Staker/"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <img
                src={githubLogo}
                alt="GitHub"
                className="social-icon github-icon"
              />
              <span></span>
            </a>
            <a
              href="https://x.com/Omnistaker/"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <img src={xLogo} alt="X " className="social-icon x-icon" />
              <span></span>
            </a>
          </div>
        </footer>

        {showTxPopup && txHash && (
          <TransactionPopup txHash={txHash} onClose={handleClosePopup} />
        )}
      </div>
    </GeoBlock>
  );
}

export default App;
