export const leftChestPlacement = "front_left_chest";
export function printfulPlacement(placement: string) {
  return placement === leftChestPlacement ? "front" : placement;
}
