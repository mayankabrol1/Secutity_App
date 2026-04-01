import { Keyboard, Platform, TouchableWithoutFeedback, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { twMerge } from "tailwind-merge";

export default function AppKeyboardView({
  children,
  className = "",
  contentContainerStyle,
  keyboardVerticalOffset = 24,
}) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        enableOnAndroid
        extraScrollHeight={keyboardVerticalOffset}
        extraHeight={keyboardVerticalOffset}
      >
        <View className={twMerge("flex-1", className)}>{children}</View>
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
  );
}
