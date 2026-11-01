/** Opaque ids for hidden blocks: only the owning seat knows the salt, so an alias says nothing about the block. */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const alias = (salt: string, id: string) => 'h' + hash(salt + id) + hash(id + salt);
