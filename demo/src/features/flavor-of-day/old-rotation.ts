// Kept around in case we go back to the old rotation.
export const OLD_ROTATION = ["vanilla", "chocolate", "strawberry"];

export function oldRotationFor(day: number): string {
  return OLD_ROTATION[day % OLD_ROTATION.length];
}
