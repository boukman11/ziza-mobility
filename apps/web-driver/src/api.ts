import { keycloak } from "./keycloak";
import { apiFetch as _apiFetch, uuidv4 } from "@shared/api";

export { uuidv4 };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return _apiFetch<T>(path, keycloak.token || undefined, init);
}
