import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useProviderStore } from "@/store/useProviderStore";
import { useProviders } from "@/lib/providerApi";
import { NO_LANGUAGE, languageName } from "@/lib/languages";

/** Installed providers as {id, name}, names from the provider list. */
export function useInstalledProviderNames() {
  const installed = useProviderStore((s) => s.installedProviders);
  const { data } = useProviders();
  return useMemo(
    () =>
      installed.map((id) => {
        const hit = (data as any[] | undefined)?.find((p) => p.value === id);
        return { id, name: hit?.display_name || id.charAt(0).toUpperCase() + id.slice(1) };
      }),
    [installed, data],
  );
}

/**
 * Movie Based layout: for the preferred audio language, pick the provider that
 * is searched first and whose sources (highest quality first) lead the list.
 */
export default function PriorityProviderPicker() {
  const { primaryColor } = useThemeStore();
  const language = useLayoutStore((s) => s.preferredLanguage);
  const priorityProviders = useLayoutStore((s) => s.priorityProviders);
  const setPriorityProvider = useLayoutStore((s) => s.setPriorityProvider);
  const providers = useInstalledProviderNames();

  if (!language || language === NO_LANGUAGE) return null;
  const current = priorityProviders[language] || null;
  const options = [{ id: null as string | null, name: "None" }, ...providers];

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{`First provider for ${languageName(language)}`}</Text>
      <Text style={styles.subtitle}>
        Searched first; its highest-quality sources are suggested first.
      </Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = option.id === current;
          return (
            <TouchableOpacity
              key={option.id ?? "none"}
              style={[
                styles.chip,
                active && { borderColor: primaryColor, backgroundColor: `${primaryColor}1F` },
              ]}
              onPress={() => setPriorityProvider(language, option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              {active ? <Ionicons name="checkmark" size={14} color={primaryColor} /> : null}
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{option.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {providers.length === 0 ? (
        <Text style={styles.subtitle}>Install a provider first.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 14 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  subtitle: { color: "#8b93a0", fontSize: 12, marginTop: 2, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2f37",
    backgroundColor: "#161a20",
  },
  chipText: { color: "#c5cbd3", fontSize: 13, fontWeight: "600" },
});
