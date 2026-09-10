/** Input for reading one member-facing loyalty standing. */
export interface TrackPunchesInput {
  parlorId: string;
}

/** A parlor's loyalty standing: punches collected and what they earn. */
export interface LoyaltyStanding {
  punches: number;
  freeScoopEarned: boolean;
}
