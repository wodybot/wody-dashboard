export const UNLIMITED_LIMIT = 1000000;
export const isUnlimited = (n) => Number(n) >= UNLIMITED_LIMIT;
export const FREE_LIMITS = {
  ticket_panels: 1,
  reaction_panels: 1,
  captcha_roles: 1,
  auto_responses: 5,
  custom_commands: 5,
  scheduled_messages: 1,
  giveaways: 1,
  forums: 1,
};
export const limitFor = (key, premium) => (premium ? UNLIMITED_LIMIT : FREE_LIMITS[key]);
