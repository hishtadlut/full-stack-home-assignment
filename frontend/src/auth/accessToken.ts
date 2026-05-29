let accessToken: string | null = null;

const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'token';

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const discardPersistedAccessToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
};
