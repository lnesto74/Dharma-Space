import { getMarketingSiteUrl } from "../lib/education";

export function platformLogout() {
  localStorage.removeItem("hsos_token");
  localStorage.removeItem("hsos_user");
  window.location.href = getMarketingSiteUrl();
}

export function goToMarketingSite() {
  window.location.href = getMarketingSiteUrl();
}
