import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
  usePreferencesStore,
  type DefaultQuality,
} from "@/store/usePreferencesStore";
import { useProviderStore } from "@/store/useProviderStore";
import { AUDIO_LANGUAGE_OPTIONS, NO_LANGUAGE, languageName } from "@/lib/languages";
import { useInstalledProviderNames } from "@/components/PriorityProviderPicker";
import { useProviders } from "@/lib/providerApi";
import { ProviderManager } from "@/services/ProviderManager";
import { SandboxManager } from "@/services/SandboxManager";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

function ChoiceRow<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {subtitle ? <Text style={styles.blockSub}>{subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Focusable
              key={option.value}
              style={[styles.chip, active ? { backgroundColor: primaryColor } : null]}
              onPress={() => onChange(option.value)}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Focusable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ProvidersBlock() {
  const { data: providers, isLoading, refetch } = useProviders();
  const { installedProviders, activeProvider, toggleInstall, setActiveProvider } =
    useProviderStore();
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(
    () =>
      [...((providers as any[]) || [])].sort((a, b) => {
        const ai = installedProviders.includes(a.value) ? 0 : 1;
        const bi = installedProviders.includes(b.value) ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return String(a.display_name).localeCompare(String(b.display_name));
      }),
    [providers, installedProviders],
  );

  // Same install / remove steps as the phone Providers screen.
  const install = async (id: string) => {
    setBusy(id);
    try {
      await ProviderManager.ensureProviderBundle(id);
      if (!activeProvider || !installedProviders.includes(activeProvider)) {
        setActiveProvider(id);
      }
    } catch (e: any) {
      Alert.alert("Install failed", e?.message || "Could not download this provider.");
    } finally {
      setBusy(null);
    }
  };
  const remove = (id: string, name: string) =>
    Alert.alert("Remove provider", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          toggleInstall(id);
          SandboxManager.unloadProvider(id);
          ProviderManager.uninstallProviderFiles(id).catch(() => {});
          if (activeProvider === id) {
            const remaining = installedProviders.filter((p) => p !== id);
            const next =
              remaining[0] || (providers as any[])?.find((p) => p.value !== id)?.value;
            if (next) setActiveProvider(next);
          }
        },
      },
    ]);

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Providers</Text>
      <Text style={styles.blockSub}>
        Titles are played from your installed providers. {installedProviders.length} installed.
      </Text>
      {isLoading ? <ActivityIndicator color="#fff" style={{ alignSelf: "flex-start" }} /> : null}
      {!isLoading && list.length === 0 ? (
        <Focusable style={styles.providerRow} onPress={() => refetch()}>
          <Text style={styles.providerName}>Could not load the provider list — retry</Text>
        </Focusable>
      ) : null}
      <View style={styles.providerGrid}>
        {list.map((provider: any) => {
          const installed = installedProviders.includes(provider.value);
          return (
            <Focusable
              key={provider.value}
              style={styles.providerRow}
              onPress={() =>
                installed
                  ? remove(provider.value, provider.display_name)
                  : install(provider.value)
              }
              accessibilityLabel={`${installed ? "Remove" : "Install"} ${provider.display_name}`}
            >
              <Text style={styles.providerName} numberOfLines={1}>
                {provider.display_name}
              </Text>
              {busy === provider.value ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons
                  name={installed ? "checkmark-circle" : "add-circle-outline"}
                  size={18}
                  color={installed ? "#4ade80" : TV.muted}
                />
              )}
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}

export default function TvSettingsScreen() {
  const preferredLanguage = useLayoutStore((s) => s.preferredLanguage);
  const setPreferredLanguage = useLayoutStore((s) => s.setPreferredLanguage);
  const priorityProviders = useLayoutStore((s) => s.priorityProviders);
  const setPriorityProvider = useLayoutStore((s) => s.setPriorityProvider);
  const installedNames = useInstalledProviderNames();
  const prefs = usePreferencesStore();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <ChoiceRow
        title="Preferred audio language"
        subtitle="Sources in this language are played first."
        options={AUDIO_LANGUAGE_OPTIONS}
        value={preferredLanguage}
        onChange={setPreferredLanguage}
      />
      {preferredLanguage && preferredLanguage !== NO_LANGUAGE ? (
        <ChoiceRow<string>
          title={`First provider for ${languageName(preferredLanguage)}`}
          subtitle="Searched first; its highest-quality sources are suggested first."
          options={[
            { label: "None", value: "" },
            ...installedNames.map((p) => ({ label: p.name, value: p.id })),
          ]}
          value={priorityProviders[preferredLanguage] || ""}
          onChange={(value) => setPriorityProvider(preferredLanguage, value || null)}
        />
      ) : null}
      <ChoiceRow<DefaultQuality>
        title="Default quality"
        subtitle="HD 1080p starts fastest at good quality; 4K stays selectable in the player."
        options={[
          { label: "HD 1080p", value: "hd" },
          { label: "Auto", value: "auto" },
          { label: "Highest", value: "highest" },
          { label: "Lowest", value: "lowest" },
        ]}
        value={prefs.defaultQuality}
        onChange={(value) => prefs.setPreference("defaultQuality", value)}
      />
      <ChoiceRow<"on" | "off">
        title="Subtitles"
        subtitle="Turn subtitles on automatically when a stream has them."
        options={[
          { label: "Off", value: "off" },
          { label: "On", value: "on" },
        ]}
        value={prefs.autoSubtitles ? "on" : "off"}
        onChange={(value) => prefs.setPreference("autoSubtitles", value === "on")}
      />
      <ProvidersBlock />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  content: { paddingTop: TV.safeY + 8, paddingHorizontal: TV.safeX, paddingBottom: 40 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginBottom: 14 },
  block: { marginBottom: 22 },
  blockTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700" },
  blockSub: { color: TV.muted, fontSize: TV.text.small, marginTop: 3, marginBottom: 8 },
  chips: { gap: 10, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  providerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  providerRow: {
    width: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  providerName: { color: "#fff", fontSize: TV.text.body, fontWeight: "600", flex: 1, marginRight: 8 },
});
