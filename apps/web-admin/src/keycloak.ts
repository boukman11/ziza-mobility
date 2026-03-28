import Keycloak from "keycloak-js";

const KC_URL = import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080";
const KC_REALM = import.meta.env.VITE_KEYCLOAK_REALM || "ziza";
const KC_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "ziza-admin";

export const keycloak = new Keycloak({
  url: KC_URL,
  realm: KC_REALM,
  clientId: KC_CLIENT_ID,
});

let refreshTimer: number | undefined;

export async function initKeycloak() {
  await keycloak.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });

  // keep token fresh (best effort)
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (keycloak.authenticated) {
      keycloak.updateToken(30).catch(() => {});
    }
  }, 10_000);
}

export function login() {
  return keycloak.login({ redirectUri: window.location.origin + window.location.pathname });
}

export function logout() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  return keycloak.logout({ redirectUri: window.location.origin });
}
