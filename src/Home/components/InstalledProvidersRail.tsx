import React, { memo, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useProviderStore } from "@/store/useProviderStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useProviders } from "@/lib/providerApi";
import { modulesOf } from "@/providers/registry";

const CARD_WIDTH = 100;
const CARD_HEIGHT = 50;

const prettifyName = (raw: string) => {
  const name = String(raw || "").trim();
  if (!name) return "Provider";
  if (/\s/.test(name)) return name;
  const spaced = name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
  if (/\s/.test(spaced)) {
    return spaced
      .split(" ")
      .map((word) =>
        word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1),
      )
      .join(" ");
  }
  return name.toUpperCase();
};

const isAnimeProvider = (id: string) =>
  /anim|anime|waifu|otaku|hi\s*anime|kickass/i.test(id);

const providerCategories = (id: string): string => {
  const categories = ["Movies"];
  const modules = modulesOf(id);
  if (modules.includes("episodes")) categories.push("Series");
  if (isAnimeProvider(id)) {
    categories.length = 0;
    categories.push("Anime");
    if (modules.includes("episodes")) categories.push("Series");
  }
  return categories.slice(0, 2).join(" · ");
};

const InstalledProvidersRail = memo(function InstalledProvidersRail() {
  const { primaryColor } = useThemeStore();
  const activeProvider = useProviderStore((s) => s.activeProvider);
  const installedProviders = useProviderStore((s) => s.installedProviders);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);
  const { data: providers } = useProviders();

  const cards = useMemo(() => {
    return installedProviders.map((id) => {
      const manifest = (providers || []).find((p: any) => p.value === id);
      return {
        id,
        name: prettifyName(manifest?.display_name || manifest?.name || id),
        categories: providerCategories(id),
      };
    });
  }, [installedProviders, providers]);

  if (cards.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* <View style={styles.headerRow}>
        <View style={[styles.headerLine, { backgroundColor: primaryColor }]} />
        <Text style={styles.headerTitle}>Providers</Text>
        <Text style={styles.headerCount}>{cards.length}</Text>
      </View> */}
      <FlatList
        data={cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isActive = item.id === activeProvider;
          return (
         <TouchableOpacity
           activeOpacity={0.85}
           onPress={() => setActiveProvider(item.id)}
           style={[
            styles.card,
             isActive && {
                borderWidth: 1,
              },
            ]}
        >
         {isActive && (
           <ImageBackground
            source={require('../../../assets/mini-providerbg.png')}
            resizeMode="cover"
            style={styles.activeBackground}
            imageStyle={{
              borderRadius: 12,
            }}
           >
         {/* Your existing provider card content */}
          </ImageBackground>
        )}
 
               {!isActive && ( 
                <LinearGradient
                colors={["#1c1c1e", "#0a0a0a", "#000"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />  )}
              <View
                style={[
                  styles.glow,
                  { backgroundColor: `${primaryColor}14` },
                ]}
              />
                 {!isActive && (
              <Ionicons
                name="film-outline"
                size={54}
                color="rgba(255,255,255,0.05)"
                style={styles.watermark}
              />
                 )}
              <View style={styles.cardContent}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                {/* <Text style={styles.cardCategories} numberOfLines={1}>
                  {item.categories}
                </Text> */}
              </View>
            
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 14,
  },
  headerLine: { width: 4, height: 18, borderRadius: 2 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  headerCount: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  glow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  watermark: {
    position: "absolute",
    right: 10,
    bottom: 8,
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  cardCategories: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
  activeDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activeBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default InstalledProvidersRail;
