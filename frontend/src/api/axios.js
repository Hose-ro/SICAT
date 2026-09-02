import axios from "axios";
import { useAuthStore } from "../store/authStore";

const DEFAULT_API_URL = import.meta.env.DEV
  ? "http://localhost:3000/api"
  : "https://api.sicatapp.com/api";
const envApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = envApiUrl || DEFAULT_API_URL;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

const SELF_HANDLED_AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/me",
  "/auth/request-email-verification",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestPath = err.config?.url ?? "";
    const handlesOwnUnauthorized = SELF_HANDLED_AUTH_PATHS.some((path) =>
      requestPath.includes(path),
    );

    if (!err.response) {
      err.response = {
        data: {
          message:
            "No pudimos conectar con el servicio. Intenta de nuevo en unos momentos.",
        },
      };
    }

    if (err.response?.status === 401 && !handlesOwnUnauthorized) {
      useAuthStore.getState().logout?.();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
