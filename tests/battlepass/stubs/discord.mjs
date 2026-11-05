import { state } from './state.mjs';
export async function getUserGuilds() { return state.guilds; }
export function canManage(permissions, owner) { return owner === true || (BigInt(permissions || 0) & 0x20n) !== 0n || (BigInt(permissions || 0) & 0x8n) !== 0n; }
export async function getDiscordUserById() { return null; }
export async function sendGuildMessage() { return { ok: true }; }
