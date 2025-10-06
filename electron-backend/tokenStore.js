// Almacén en memoria para tokens externos (SIAAN, etc.)
// Este archivo vive en el proceso principal; no persiste entre reinicios.

let externalTokens = {
  token: null,
  uniqueCode: null,
  tokenExpiry: null,
  updatedAt: null,
};

function setExternalTokens({ token, uniqueCode, tokenExpiry }) {
  externalTokens = {
    token: token || null,
    uniqueCode: uniqueCode || null,
    tokenExpiry: tokenExpiry || null,
    updatedAt: new Date().toISOString(),
  };
}

function getExternalTokens() {
  return { ...externalTokens };
}

module.exports = { setExternalTokens, getExternalTokens };
