import { Alert, Platform, Share, ToastAndroid } from "react-native";

export const notify = (message: string) => {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
};

export const shareVideo = async (video: { title: string; link: string }) => {
  try {
    await Share.share({ message: `${video.title}\n${video.link}` });
  } catch {
    // The user dismissing the sheet is not an error.
  }
};
