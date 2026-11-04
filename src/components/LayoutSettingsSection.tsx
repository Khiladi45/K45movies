import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import { useThemeStore } from "@/store/useThemeStore";
import { useLayoutStore, type AppLayout } from "@/store/useLayoutStore";
import { AUDIO_LANGUAGE_OPTIONS } from "@/lib/languages";

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
        <View style={styles.rowHead}>
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
            <Text style={styles.subtitle}>
              Switch how Home and Search find content
            </Text>
          </View>
        </View>

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

        {layout === "movie" ? (
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
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelected}
              itemTextStyle={styles.dropdownItem}
              inputSearchStyle={styles.dropdownSearch}
              activeColor={`${primaryColor}22`}
              iconColor="#8b93a0"
              data={AUDIO_LANGUAGE_OPTIONS}
              labelField="label"
              valueField="value"
              search
              searchPlaceholder="Search language"
              maxHeight={320}
              placeholder="Select language"
              value={preferredLanguage}
              onChange={(item: { value: string }) =>
                setPreferredLanguage(item.value)
              }
            />
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
  dropdown: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 14,
  },
  dropdownList: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    borderColor: "#1f1f1f",
  },
  dropdownPlaceholder: { color: "#777", fontSize: 14 },
  dropdownSelected: { color: "#fff", fontSize: 14, fontWeight: "600" },
  dropdownItem: { color: "#ddd", fontSize: 14 },
  dropdownSearch: {
    color: "#fff",
    borderRadius: 10,
    borderColor: "#1f1f1f",
    height: 42,
  },
});
