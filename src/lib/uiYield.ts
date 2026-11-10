import { InteractionManager } from "react-native";

/**
 * Provider scraping runs on the same JS thread that draws the UI. These
 * helpers give the UI room to render between heavy steps so screens stay
 * smooth while sources load.
 */

/**
 * Waits until running animations/transitions (e.g. a screen sliding in)
 * finish, with a ceiling so work never waits forever.
 */
export const afterInteractions = (maxWaitMs = 600): Promise<void> =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const handle = InteractionManager.runAfterInteractions(finish);
    setTimeout(() => {
      handle.cancel?.();
      finish();
    }, maxWaitMs);
  });

export { createBatcher, yieldToUI } from "./uiYieldCore";
