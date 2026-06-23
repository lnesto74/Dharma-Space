import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import CorporatePortal from "./corporate/CorporatePortal";
import { isCorporateHost } from "./lib/education";
import "./styles.css";
import "./styles/marketing.css";
import "./styles/platform.css";

const Root = isCorporateHost() ? CorporatePortal : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
