// Implements SPEC §17 Audio types and definitions

export type AudioBusName = 'master' | 'music' | 'crowd' | 'commentary' | 'sfx';

export type SfxId =
  // Match SFX (§17.3)
  | 'whistle_short'
  | 'whistle_long'
  | 'whistle_fulltime'
  | 'kick_pass'
  | 'kick_shot'
  | 'header'
  | 'net'
  | 'post'
  | 'tackle'
  // UI & System SFX (§17.3, §19.7)
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_error'
  | 'ui_whoosh'
  | 'ui_cut'
  | 'ui_tick'
  | 'ui_clack'
  | 'ui_paper'
  | 'ui_stamp'
  | 'notification'
  | 'camera_shutter'
  // Room Ambience One-shots (§17.5)
  | 'car_door'
  | 'footstep'
  | 'door_open'
  | 'door_close'
  | 'phone_ring'
  | 'door_knock'
  | 'chair_creak'
  | 'studs_tile'
  | 'studs_concrete'
  | 'cone_hit'
  | 'mic_tap'
  | 'locker_bang';

export type CrowdOneShotId =
  | 'goal_roar'
  | 'away_cheer'
  | 'groan_miss'
  | 'ooh_save'
  | 'boo_foul'
  | 'chant';

export type MusicTrackId = 'title_theme' | 'menu_loop' | 'season_end';

export type RoomId =
  | 'exterior'
  | 'corridor'
  | 'office'
  | 'boardroom'
  | 'dressing'
  | 'tunnel'
  | 'training'
  | 'press';

export interface PlaySfxOptions {
  /** Stereo pan position [-1.0, 1.0], clamped to [-0.6, 0.6] per SPEC §17.3 */
  pan?: number;
  /** Relative volume multiplier (1.0 default) */
  volume?: number;
  /** For kick events: shot is louder and has punchier drop */
  isShot?: boolean;
}

export interface PlayCrowdOptions {
  /** Relative volume multiplier (1.0 default) */
  volume?: number;
  /** Home goal (0 dB full) vs Away goal (-8 dB) */
  isHome?: boolean;
}
