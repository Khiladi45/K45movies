import { Platform } from "react-native";

/**
 * True on Android TV / Google TV (react-native-tvos sets Platform.isTV from the
 * device's UI mode). Phones and tablets keep the regular interface.
 */
export const IS_TV = (Platform as { isTV?: boolean }).isTV === true;
