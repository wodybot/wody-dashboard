// Mutable test state shared by the stand-ins: who is signed in, which servers they manage, which database the API sees.
export const state = { session: null, guilds: [], delegates: new Set(), blocked: new Set(), db: null };
