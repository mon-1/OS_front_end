// import React, { useContext, useState } from "react";
// import { Web3Context, Web3Provider } from "../../src/Web3Context";
// import IL2StakerSolo from "../../src/IL2StakerSolo.json";

// const App = () => {
//   const { account, web3 } = useContext(Web3Context);
//   const [stakeAmount, setStakeAmount] = useState("");
//   const contractAddress = "0x5C8ea964F8F09E4992A0cAB5638adED110514b27";
//   const contract = web3
//     ? new web3.eth.Contract(IL2StakerSolo, contractAddress)
//     : null;

//   const estimateFee = async (amount) => {
//     if (contract) {
//       try {
//         const fee = await contract.methods
//           .estimateOFTFee(web3.utils.toWei(amount, "ether"), contractAddress)
//           .call();
//         console.log("Estimated Fee:", fee.nativeFee);
//         return fee.nativeFee;
//       } catch (error) {
//         console.error("Error estimating fee:", error);
//         throw error;
//       }
//     }
//     return "0";
//   };

//   const stake = async () => {
//     try {
//       if (contract) {
//         const amountInWei = web3.utils.toWei(stakeAmount, "ether");
//         console.log("Staking Amount in Wei:", amountInWei);
//         const nativeFee = await estimateFee(stakeAmount);
//         console.log("Native Fee for Staking:", nativeFee);
//         await contract.methods
//           .stake(amountInWei)
//           .send({ from: account, value: nativeFee });
//         console.log("Stake transaction sent");
//       }
//     } catch (error) {
//       console.error("Error staking:", error);
//     }
//   };

//   return (
//     <div>
//       <input
//         type="text"
//         value={stakeAmount}
//         onChange={(e) => setStakeAmount(e.target.value)}
//         placeholder="Enter amount to stake"
//       />
//       <button onClick={stake}>Stake</button>
//     </div>
//   );
// };

// const AppWrapper = () => (
//   <Web3Provider>
//     <App />
//   </Web3Provider>
// );

// export default AppWrapper;
