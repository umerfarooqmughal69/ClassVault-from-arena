export const USERNAME_DOMAIN = "class.local";

export const usernameToEmail = (username: string): string => {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
};

export const isValidUsername = (username: string): boolean => {
  // Username must be 2-32 characters, alphanumeric plus underscores or dashes
  return /^[A-Za-z0-9_-]{2,32}$/.test(username.trim());
};

export const isValidPassword = (password: string): boolean => {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
};
