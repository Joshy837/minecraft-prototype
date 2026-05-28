import * as THREE from 'three';
import { supabase } from './supabase.js';
import { PlayerBody } from '../player/PlayerBody.js';

export class Multiplayer {
  constructor(scene, worldId, localUserId) {
    this._scene       = scene;
    this._worldId     = worldId;
    this._localUserId = localUserId;
    this._channel     = null;
    this._remotes     = new Map(); // userId -> { body, pos, yaw, vel }
    this._broadcastTimer = 0;
    this._getState    = null;
    this._dead        = false; // set true on intentional leave
  }

  join(getState) {
    this._getState = getState;

    if (this._channel) {
      this._channel.unsubscribe();
      this._channel = null;
    }

    this._channel = supabase.channel(`game:${this._worldId}`, {
      config: { presence: { key: this._localUserId } },
    });

    this._channel
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel.presenceState();

        for (const userId of [...this._remotes.keys()]) {
          if (!(userId in state)) {
            this._remotes.get(userId).body.dispose();
            this._remotes.delete(userId);
          }
        }

        for (const [userId, presences] of Object.entries(state)) {
          if (userId === this._localUserId) continue;
          this._applyRemote(userId, presences[0]);
        }
      })
      .subscribe(async (status) => {
        if (this._dead) return;
        if (status === 'SUBSCRIBED') {
          await this._channel.track(this._getState());
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => { if (!this._dead) this.join(this._getState); }, 3000);
        }
      });

  }

  _applyRemote(userId, state) {
    if (!state) return;
    let remote = this._remotes.get(userId);
    if (!remote) {
      remote = {
        body: new PlayerBody(this._scene),
        pos:  new THREE.Vector3(),
        yaw:  0,
        vel:  new THREE.Vector3(),
      };
      this._remotes.set(userId, remote);
    }
    remote.pos.set(state.pos.x, state.pos.y, state.pos.z);
    remote.yaw = state.yaw;
    remote.vel.set(state.vel?.x ?? 0, state.vel?.y ?? 0, state.vel?.z ?? 0);
  }

  update(dt, ambient) {
    this._broadcastTimer += dt;
    if (this._broadcastTimer >= 2.0 && this._channel && this._getState) {
      this._broadcastTimer = 0;
      this._channel.track(this._getState());
    }

    for (const remote of this._remotes.values()) {
      remote.body.update(remote.pos, remote.yaw, 1, dt, remote.vel, ambient);
    }
  }

  leave() {
    this._dead = true;
    for (const remote of this._remotes.values()) remote.body.dispose();
    this._remotes.clear();
    this._channel?.unsubscribe();
    this._channel = null;
  }
}
