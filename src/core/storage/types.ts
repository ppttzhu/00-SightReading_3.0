/**
 * Storage Provider Interface
 * 
 * Abstraction layer for remote data persistence.
 * Implement this interface to swap backends (GitHub Gist, Firebase, Supabase, etc.)
 */

import type { Slice, CustomStage, AdventureStage } from '../store/useAppStore';

export interface StageData {
  slicesPool: Slice[];
  customStages: CustomStage[];
  adventureStages?: AdventureStage[];
  updatedAt: string; // ISO timestamp
}

export interface StorageProvider {
  /** Unique name for this provider (for display/debugging) */
  name: string;

  /**
   * Save the current stage data to remote storage.
   * Called by the teacher CMS when they click "Publish".
   */
  save(data: StageData): Promise<void>;

  /**
   * Load stage data from remote storage.
   * Called by the student app on startup.
   * Returns null if no data exists yet.
   */
  load(): Promise<StageData | null>;
}
