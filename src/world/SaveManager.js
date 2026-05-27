import { supabase, ensureAuth } from '../lib/supabase.js';

function uint8ToBase64(arr) {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(str) {
  const binary = atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export const SaveManager = {
  // Must be called once on app start before any other method
  async init() {
    this._user = await ensureAuth();
  },

  get userId() { return this._user?.id ?? null; },

  async list() {
    const { data, error } = await supabase
      .from('worlds')
      .select('name, seed, created_at, updated_at')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });
    if (error) { console.error('list error:', error); return []; }
    return data.map(r => ({
      name:       r.name,
      seed:       r.seed,
      lastPlayed: new Date(r.updated_at).getTime(),
      created:    new Date(r.created_at).getTime(),
    }));
  },

  async save(name, seed, world, player, sky) {
    const chunks = {};
    for (const [key, chunk] of world.chunks) {
      if (chunk.modified) chunks[key] = uint8ToBase64(chunk.data);
    }

    const payload = {
      user_id:     this.userId,
      name,
      seed,
      time_of_day: sky.time,
      player:      {
        pos:      { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        health:   player.health,
        creative: player.creative,
        flying:   player.flying,
        yaw:      player.yaw ?? 0,
        pitch:    player.pitch ?? 0,
      },
      chunks,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('worlds')
      .upsert(payload, { onConflict: 'user_id,name' });

    if (error) console.error('save error:', error);
    return !error;
  },

  async load(name) {
    const { data, error } = await supabase
      .from('worlds')
      .select('seed, time_of_day, player, chunks')
      .eq('user_id', this.userId)
      .eq('name', name)
      .single();

    if (error || !data) { console.error('load error:', error); return null; }

    const chunks = {};
    for (const [key, b64] of Object.entries(data.chunks || {})) {
      chunks[key] = base64ToUint8(b64);
    }
    return { seed: data.seed, time: data.time_of_day, player: data.player, chunks };
  },

  async delete(name) {
    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('user_id', this.userId)
      .eq('name', name);
    if (error) console.error('delete error:', error);
  },

  // Returns { used, quota } estimated from the worlds data sizes
  async storageInfo() {
    const { data, error } = await supabase
      .from('worlds')
      .select('name, chunks')
      .eq('user_id', this.userId);
    if (error || !data) return { used: 0, quota: 500 * 1024 * 1024 };

    let used = 0;
    for (const row of data) {
      used += JSON.stringify(row.chunks).length * 2;
    }
    return { used, quota: 500 * 1024 * 1024 }; // Supabase free tier: 500 MB
  },

  async worldBytes(name) {
    const { data, error } = await supabase
      .from('worlds')
      .select('chunks')
      .eq('user_id', this.userId)
      .eq('name', name)
      .single();
    if (error || !data) return 0;
    return JSON.stringify(data.chunks).length * 2;
  },
};
