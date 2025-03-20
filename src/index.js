import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Web3Provider } from "./Web3Context";
import AnalyticsComponent from "./Analytics";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Web3Provider>
      <App />
      <AnalyticsComponent />
    </Web3Provider>
  </React.StrictMode>
);

reportWebVitals();
