import React, { createContext, useEffect, useState, useCallback } from "react";
import { initWeb3, web3 } from "./web3";

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleAccountsChanged = (accounts) => {
    setAccount(accounts[0]);
    setIsConnected(!!accounts[0]);
  };

  const reconnect = useCallback(async () => {
    try {
      await initWeb3();
      const accounts = await web3.eth.getAccounts();
      handleAccountsChanged(accounts);
    } catch (error) {
      console.error("Reconnection failed:", error);
    }
  }, []);

  const disconnect = async () => {
    setAccount(null);
    setIsConnected(false);
  };

  useEffect(() => {
    const initialize = async () => {
      await reconnect();
    };

    initialize();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("disconnect", reconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("disconnect", reconnect);
      }
    };
  }, [reconnect]);

  return (
    <Web3Context.Provider
      value={{ account, web3, isConnected, reconnect, disconnect }}
    >
      {children}
    </Web3Context.Provider>
  );
};
