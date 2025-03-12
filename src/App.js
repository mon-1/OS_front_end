import React, { useContext, useState, useEffect, useCallback } from "react";
import "./App.css";
import { Web3Context } from "./Web3Context";
import OmniStakerL2 from "./OmniStakerL2.json";
import logo from ".logos/Omni_Staker_Logo.jpg";
import { getWeb3, checkConnection } from "./web3";
import layerZeroLogo from ".logos/LayerZero_logo.png";
import ethenaLogo from ".logos/Ethena.avif";

// GasPriceOracle address remains the same
const gasPriceOracleAddress = "0x420000000000000000000000000000000000000F";

// Add this new component before the App component
const TransactionPopup = ({ txHash, onClose }) => {
  const baseScanUrl = `https://basescan.org/tx/${txHash}`;
  const layerZeroScanUrl = `https://layerzeroscan.com/tx/${txHash}`;

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
          href={baseScanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-popup-link"
        >
          View on BaseScan
        </a>
        <a
          href={layerZeroScanUrl}
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

function App() {
  const { account, web3, reconnect, disconnect } = useContext(Web3Context);
  const [stakeAmount, setStakeAmount] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [usdeFee, setUsdeFee] = useState(null);
  const [l1BaseFee, setL1BaseFee] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [batchStakeFee, setBatchStakeFee] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [showTxPopup, setShowTxPopup] = useState(false);

  const contractAddress = "0xC0c0EbfC83e9E9d1A2ED809B4F841BcFB58ACEFE";

  const oftStakingAddress = "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34";
  const oftUnstakingAddress = "0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2";

  // getContract uses the new ABI
  const getContract = useCallback(() => {
    if (!web3) {
      throw new Error("Web3 is not initialized");
    }
    return new web3.eth.Contract(OmniStakerL2, contractAddress);
  }, [web3]);

  // GasPriceOracle retrieval (unchanged)
  const getGasPriceOracleContract = useCallback(() => {
    if (!web3) {
      throw new Error("Web3 is not initialized");
    }
    const abi = [
      {
        inputs: [],
        name: "l1BaseFee",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ];
    return new web3.eth.Contract(abi, gasPriceOracleAddress);
  }, [web3]);

  const fetchL1BaseFee = useCallback(async () => {
    try {
      const contract = getGasPriceOracleContract();
      const fee = await contract.methods.l1BaseFee().call();
      setL1BaseFee(web3.utils.fromWei(fee, "gwei"));
    } catch (error) {
      console.error("Error fetching L1 base fee:", error);
    }
  }, [web3, getGasPriceOracleContract]);

  const decodeErrorData = useCallback(
    (errorHex) => {
      if (!errorHex) return null;
      const dataWithoutSignature = errorHex.slice(10);
      try {
        const minFee = "0x" + dataWithoutSignature.slice(0, 64);
        const requiredFee = "0x" + dataWithoutSignature.slice(64, 128);
        const minFeeDecimal = BigInt(minFee).toString();
        const requiredFeeDecimal = BigInt(requiredFee).toString();
        return {
          minFee: web3.utils.fromWei(minFeeDecimal, "ether"),
          requiredFee: web3.utils.fromWei(requiredFeeDecimal, "ether"),
        };
      } catch (e) {
        console.error("Error decoding data:", e);
        return null;
      }
    },
    [web3]
  );

  const estimateFee = useCallback(
    async (amount, isStaking = true) => {
      try {
        if (!amount || isNaN(amount) || amount <= 0) {
          throw new Error("Invalid amount");
        }
        const contract = getContract();
        const amountInWei = web3.utils.toWei(amount.toString(), "ether");
        const oftAddress = isStaking ? oftStakingAddress : oftUnstakingAddress;
        console.log("Calling estimate_fee_helper with:", {
          amountInWei,
          oftAddress,
          account,
        });
        // Note: For solo staking, pass false for _batch; for batch, pass true.
        const fee = await contract.methods
          .estimate_fee_helper(amountInWei, oftAddress, !isStaking)
          .call({ from: account });
        console.log("estimate_fee_helper result:", fee);
        return fee;
      } catch (error) {
        console.error("Fee estimation error details:", {
          error,
          message: error.message,
        });
        throw error;
      }
    },
    [web3, account, getContract, oftStakingAddress, oftUnstakingAddress]
  );

  const handleTransactionError = async (error) => {
    if (error.message.includes("Extension context invalidated")) {
      setError("MetaMask connection lost. Trying to reconnect...");
      await reconnect();
      setError("Please try transaction again");
    } else {
      setError(error.message);
    }
  };

  const handleRpcError = async () => {
    const isConnected = await checkConnection();
    if (!isConnected) {
      const newWeb3 = await getWeb3();
      if (newWeb3) {
        return true;
      }
    }
    return false;
  };

  const executeTransaction = async (txFunction) => {
    setLoading(true);
    setError(null);
    setTxStatus("Preparing transaction...");
    try {
      if (!(await checkConnection())) {
        setTxStatus("Reconnecting...");
        await handleRpcError();
      }
      const result = await txFunction();
      setTxStatus("Transaction successful!");
      return result;
    } catch (error) {
      if (error.message.includes("JSON-RPC")) {
        setTxStatus("Network error, retrying...");
        const recovered = await handleRpcError();
        if (recovered) {
          return await txFunction();
        }
      }
      throw error;
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  // Remove unstake and unstake message functions (no longer needed)

  // NEW: Fetch the threshold value from the contract
  const fetchThreshold = useCallback(async () => {
    if (web3 && account) {
      try {
        const contract = getContract();
        const thresh = await contract.methods.threshold().call();
        setThreshold(thresh);
      } catch (error) {
        console.error("Error fetching threshold:", error);
      }
    }
  }, [web3, account, getContract]);

  // Update fee estimates and calculate batch fee based on threshold
  const updateFeeEstimates = useCallback(async () => {
    if (web3 && account) {
      try {
        const usdeEstimate = await estimateFee("10", true);
        const feeInEther = Number(web3.utils.fromWei(usdeEstimate, "ether"));
        // Round solo fee to 6 decimals
        const soloFee = Number(feeInEther.toFixed(6));
        // Use threshold if available and > 0, otherwise fallback to 5
        const divisor =
          threshold && Number(threshold) > 0 ? Number(threshold) : 5;
        const batchFee = Number((feeInEther / divisor).toFixed(6));
        setUsdeFee(soloFee);
        setBatchStakeFee(batchFee);
      } catch (error) {
        console.error("Error estimating fees:", error);
      }
    }
  }, [web3, account, estimateFee, threshold]);

  useEffect(() => {
    if (web3 && account) {
      fetchThreshold();
      updateFeeEstimates();
      fetchL1BaseFee();
      const interval = setInterval(() => {
        updateFeeEstimates();
        fetchL1BaseFee();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [account, web3, updateFeeEstimates, fetchL1BaseFee, fetchThreshold]);

  // Remove stake_batch or unstake functions from actions
  // For now, we only display estimates.

  const erc20ABI = [
    {
      constant: false,
      inputs: [
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
      ],
      name: "approve",
      outputs: [{ name: "", type: "bool" }],
      type: "function",
    },
    {
      constant: true,
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      name: "allowance",
      outputs: [{ name: "", type: "uint256" }],
      type: "function",
    },
  ];

  const checkAllowanceUSDE = async (amountInWei) => {
    if (!web3 || !account) throw new Error("Web3 or account not available");
    const tokenContract = new web3.eth.Contract(erc20ABI, oftStakingAddress);
    const allowance = await tokenContract.methods
      .allowance(account, contractAddress)
      .call();
    return BigInt(allowance) >= BigInt(amountInWei);
  };

  const approveUSDE = async (amountInWei) => {
    if (!web3 || !account) {
      throw new Error("Web3 or account not available");
    }
    const tokenContract = new web3.eth.Contract(erc20ABI, oftStakingAddress);
    console.log("Approving USDE spending for amount:", amountInWei);
    return await tokenContract.methods
      .approve(contractAddress, amountInWei)
      .send({ from: account });
  };

  const stake_USDe = async () => {
    try {
      await executeTransaction(async () => {
        if (!web3 || !account) throw new Error("Please connect your wallet");
        const contract = getContract();
        const amountInWei = web3.utils.toWei(stakeAmount, "ether");

        const allowanceEnough = await checkAllowanceUSDE(amountInWei);
        if (!allowanceEnough) {
          await approveUSDE(amountInWei);
          console.log("Approval successful for stake_USDe");
        } else {
          console.log(
            "Sufficient allowance available, skipping approval for stake_USDe"
          );
        }

        // Retrieve the fee estimated by the contract method
        const fee = await estimateFee(stakeAmount, true);
        console.log("Passing fee", fee, "to stake_USDe payable function");

        // Pass the fee in the transaction's value field
        const tx = await contract.methods
          .stake_USDe(amountInWei)
          .send({ from: account, value: fee });
        console.log("stake_USDe transaction successful:", tx);

        // Show popup for successful transaction
        setTxHash(tx.transactionHash);
        setShowTxPopup(true);

        // Auto-hide popup after 15 seconds
        setTimeout(() => {
          setShowTxPopup(false);
          setTxHash(null);
        }, 15000);

        return tx;
      });
    } catch (error) {
      await handleTransactionError(error);
    }
  };

  const stake_USDe_batch = async () => {
    try {
      await executeTransaction(async () => {
        if (!web3 || !account) throw new Error("Please connect your wallet");
        const contract = getContract();
        const amountInWei = web3.utils.toWei(stakeAmount, "ether");

        const allowanceEnough = await checkAllowanceUSDE(amountInWei);
        if (!allowanceEnough) {
          await approveUSDE(amountInWei);
          console.log("Approval successful for stake_USDe_batch");
        } else {
          console.log(
            "Sufficient allowance available, skipping approval for stake_USDe_batch"
          );
        }

        console.log("Calling stake_with_batch with amount:", amountInWei);
        const tx = await contract.methods
          .stake_USDe_batch(amountInWei)
          .send({ from: account });
        console.log("stake_with_batch transaction successful:", tx);
      });
    } catch (error) {
      await handleTransactionError(error);
    }
  };

  const withdraw_sUSDe_batch = async () => {
    try {
      await executeTransaction(async () => {
        if (!web3 || !account) throw new Error("Please connect your wallet");
        const contract = getContract();
        console.log("Calling withdraw (batch withdrawal)");
        const tx = await contract.methods
          .withdraw_sUSDe_batch() // Adjust the method name and parameters as needed
          .send({ from: account });
        console.log("Withdraw transaction successful:", tx);
      });
    } catch (error) {
      await handleTransactionError(error);
    }
  };

  // Add popup close handler
  const handleClosePopup = () => {
    setShowTxPopup(false);
    setTxHash(null);
  };

  return (
    <div className="App">
      <div className="explainer-container">
        <div className="explainer left">
          {/* Updated left explainer for Solo Stake */}
          <h3>Solo Stake</h3>
          <p>
            In a solo stake you pay the full cross-chain transfer fee and
            receive your tokens directly. The cost displayed below is for
            staking 10 USDE tokens.
          </p>
          <ol>
            <li>Connect your wallet</li>
            <li>Enter the amount you want to stake</li>
            <li>Review fee estimates below</li>
          </ol>
          <div className="fee-estimate">
            <p>Solo Stake Fee Estimate (for 10 USDE):</p>
            <strong>
              {usdeFee !== null ? `${usdeFee} ETH` : "Calculating..."}
            </strong>
            <p>L1 Base Fee:</p>
            <strong>
              {l1BaseFee
                ? `${Number(l1BaseFee).toFixed(2)} Gwei`
                : "Calculating..."}
            </strong>
          </div>
        </div>

        <div className="main-content">
          <div className="wallet-connection">
            {account ? (
              <div className="account-info">
                <span className="account-address">
                  {account.slice(0, 6)}...{account.slice(-4)}
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

          <div className="logo-container">
            <img src={logo} className="App-logo" alt="Omni Staker Logo" />
          </div>

          {account ? (
            <div className="staking-container">
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="Enter amount"
                disabled={loading}
                className="amount-input"
              />
              {/* New action buttons */}
              <div className="button-group">
                <button
                  onClick={stake_USDe}
                  disabled={loading || !stakeAmount}
                  className="action-button solo-btn"
                >
                  Stake Solo
                </button>
                <button
                  onClick={stake_USDe_batch}
                  disabled={loading || !stakeAmount}
                  className="action-button batch-btn"
                >
                  Stake with Batch
                </button>
                <button
                  onClick={withdraw_sUSDe_batch}
                  disabled={loading}
                  className="action-button withdraw-btn"
                >
                  Withdraw Batch
                </button>
              </div>
              {txStatus && <div className="status-message">{txStatus}</div>}
              {error && <div className="error-message">{error}</div>}
            </div>
          ) : (
            <div className="connect-prompt">
              Please connect your wallet to view fee estimates
            </div>
          )}

          {account && (
            <div className="batches-info">
              <h4>Your Batches</h4>
              {/* <p>Fee estimates are for solo and batched staking.</p> */}
            </div>
          )}

          <div className="powered-by">
            <span>Powered by </span>
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
        </div>

        <div className="explainer right">
          {/* Updated right explainer for Batched Stake */}
          <h3>Batched Stake</h3>
          <p>
            In a batched stake you only pay a reduced fee – the solo fee divided
            by 5. Tokens must be withdrawn upon finality (exact time varies).
          </p>
          <div className="fee-estimate">
            <p>Batched Stake Fee Estimate:</p>
            <strong>
              {batchStakeFee !== null
                ? `${batchStakeFee} ETH`
                : "Calculating..."}
            </strong>
          </div>
        </div>
      </div>
      <div className="social-links">
        <a
          href="https://github.com/owl11/Omni-Staker/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Github
        </a>
        {/* ...existing social link code... */}
      </div>
      {/* Add this before closing div */}
      {showTxPopup && txHash && (
        <TransactionPopup txHash={txHash} onClose={handleClosePopup} />
      )}
    </div>
  );
}

export default App;
