export const clearLegacyAuthStorage = () => {
  localStorage.removeItem("sicat_token");
  localStorage.removeItem("token");
  localStorage.removeItem("sicat-auth");
};
