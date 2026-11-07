import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import { useLayoutStore, type AppLayout } from "@/store/useLayoutStore";
import { AUDIO_LANGUAGE_OPTIONS } from "@/lib/languages";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const OPTIONS: {
  value: AppLayout;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  {
    value: "provider",
    title: "Provider Based",
    description: "Browse and search inside your installed providers",
    icon: "puzzle-outline",
  },
  {
    value: "movie",
    title: "Movie Based",
    description: "Browse movies and series from TMDB, then find streams",
    icon: "movie-open-outline",
  },
  {
    value: "youtube",
    title: "YouTube Layout",
    description:
      "Video feed with Shorts, a video page, search history and a Watchlist",
    icon: "youtube",
  },
];

/**
 * Settings → LAYOUT. Rendered as one extra section on the Settings screen; it
 * only reads/writes useLayoutStore.
 */
export default function LayoutSettingsSection() {
  const { primaryColor } = useThemeStore();
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const preferredLanguage = useLayoutStore((s) => s.preferredLanguage);
  const setPreferredLanguage = useLayoutStore((s) => s.setPreferredLanguage);
  // "Choose Layout" starts collapsed; tapping the header opens the options.
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, turn]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };
  const togglePicker = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPickerOpen((v) => !v);
  };
  const current = layout === "youtube" ? "YouTube Layout" : layout === "movie" ? "Movie Based" : "Provider Based";
  const selectedLanguage =
    AUDIO_LANGUAGE_OPTIONS.find((o) => o.value === preferredLanguage) ?? AUDIO_LANGUAGE_OPTIONS[0];

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={[styles.accent, { backgroundColor: primaryColor }]} />
        <Text style={styles.sectionTitle}>LAYOUT</Text>
        <MaterialCommunityIcons
          name="creation"
          size={12}
          color="#555"
          style={{ marginLeft: 4 }}
        />
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.rowHead}
          activeOpacity={0.8}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel="Choose Layout"
        >
          <View
            style={[styles.iconBox, { backgroundColor: `${primaryColor}1A` }]}
          >
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={24}
              color={primaryColor}
            />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.title}>Choose Layout</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {open ? "Switch how Home and Search find content" : current}
            </Text>
          </View>
          <Animated.View
            style={{
              transform: [
                { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) },
              ],
            }}
          >
            <Ionicons name="chevron-down" size={22} color="#8b93a0" />
          </Animated.View>
        </TouchableOpacity>

        {open ? (
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = layout === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.8}
                onPress={() => setLayout(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  selected && {
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}14`,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={22}
                  color={selected ? primaryColor : "#8b93a0"}
                />
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionTitle,
                      selected && { color: "#fff" },
                    ]}
                  >
                    {option.title}
                    {option.value === "provider" ? "  (Default)" : ""}
                  </Text>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={selected ? primaryColor : "#555"}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        ) : null}

        {layout === "movie" && open ? (
          <View style={styles.languageBlock}>
            <View style={styles.rowHead}>
              <View
                style={[styles.iconBox, { backgroundColor: "rgba(56,189,248,0.1)" }]}
              >
                <Ionicons name="language-outline" size={24} color="#38bdf8" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.title}>Preferred Audio Language</Text>
                <Text style={styles.subtitle}>
                  Streams with this audio are listed first
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.field, pickerOpen && { borderColor: primaryColor }]}
              activeOpacity={0.85}
              onPress={togglePicker}
              accessibilityRole="button"
              accessibilityLabel="Preferred audio language"
            >
              <Text style={styles.fieldText}>{selectedLanguage.label}</Text>
              <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={20} color="#8b93a0" />
            </TouchableOpacity>
            {pickerOpen ? (
              <View style={styles.list}>
                {AUDIO_LANGUAGE_OPTIONS.map((option, i) => {
                  const active = option.value === preferredLanguage;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.listRow,
                        i > 0 && styles.listRowBorder,
                        active && { backgroundColor: `${primaryColor}1A` },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setPreferredLanguage(option.value);
                        togglePicker();
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.listText, active && { color: "#fff", fontWeight: "700" }]}>
                        {option.label}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={20} color={primaryColor} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 28, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingLeft: 4,
  },
  accent: { width: 3, height: 14, borderRadius: 2, marginRight: 8 },
  sectionTitle: {
    fontSize: 12,
    color: "#888",
    fontWeight: "700",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#0a0a0a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    padding: 16,
  },
  rowHead: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowText: { flex: 1 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 2 },
  subtitle: { color: "#888", fontSize: 13 },
  options: { marginTop: 14, gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#1f1f1f",
    backgroundColor: "#0f0f0f",
  },
  optionText: { flex: 1 },
  optionTitle: { color: "#cfd3da", fontSize: 14.5, fontWeight: "700" },
  optionDesc: { color: "#777", fontSize: 12, marginTop: 2, lineHeight: 16 },
  languageBlock: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  field: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#1f1f1f",
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  list: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  listRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1f1f1f" },
  listText: { color: "#cfd3da", fontSize: 15 },
});
