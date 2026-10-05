import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useThemeStore } from "../store/useThemeStore";

// ---------- THEME DATA ----------
const POPULAR = [
  { name: "Ocean", hex: "#007AFF", icon: "waves", family: "mci" },
  { name: "Royal Blue", hex: "#2563EB", icon: "crown", family: "mci" },
  { name: "Emerald", hex: "#10B981", icon: "gem", family: "mci" },
  { name: "Purple", hex: "#A855F7", icon: "diamond", family: "mci" },
  { name: "Rose", hex: "#E11D48", icon: "rose", family: "mci" },
];

const VIBRANT = [
  { name: "Crimson", hex: "#FF0033", icon: "flame-outline", family: "ion" },
  { name: "Coral", hex: "#FF6B6B", icon: "flower-outline", family: "ion" },
  { name: "Orange", hex: "#F97316", icon: "circle-slice-8", family: "mci" },
  { name: "Gold", hex: "#F59E0B", icon: "star-outline", family: "ion" },
  { name: "Lime", hex: "#84CC16", icon: "leaf-outline", family: "ion" },
  { name: "Teal", hex: "#14B8A6", icon: "water-outline", family: "ion" },
  { name: "Cyan", hex: "#06B6D4", icon: "lightning-outline", family: "ion" },
  { name: "Sky", hex: "#0EA5E9", icon: "cloud-outline", family: "ion" },
  { name: "Indigo", hex: "#6366F1", icon: "planet-outline", family: "ion" },
  { name: "Violet", hex: "#8B5CF6", icon: "sparkles-outline", family: "ion" },
];

const SOFT = [
  { name: "Pink", hex: "#EC4899", icon: "heart-outline", family: "ion" },
  { name: "Magenta", hex: "#D946EF", icon: "hexagon-outline", family: "ion" },
  { name: "Slate", hex: "#64748B", icon: "triangle-outline", family: "ion" },
  { name: "Mint", hex: "#34D399", icon: "leaf-outline", family: "ion" },
];

const ALL_COLORS = [...POPULAR, ...VIBRANT, ...SOFT];

const withOpacity = (hex: string, opacity: string) => `${hex}${opacity}`;

// Unified square card size (smaller design)
const CARD_SIZE = 62;
const CARD_GAP = 10;

export default function ThemeSettingsScreen({ navigation }: any) {
  const { primaryColor, setPrimaryColor } = useThemeStore();

  const isSelected = (hex: string) =>
    primaryColor.toLowerCase() === hex.toLowerCase();

  const selectedName =
    ALL_COLORS.find((c) => c.hex.toLowerCase() === primaryColor.toLowerCase())
      ?.name || "Custom";

  const renderIcon = (item: any, size: number, color: string) =>
    item.family === "mci" ? (
      <MaterialCommunityIcons name={item.icon} size={size} color={color} />
    ) : (
      <Ionicons name={item.icon} size={size} color={color} />
    );

  // ---------- UNIFIED SQUARE CARD (all same size & shape) ----------
  const renderColorCard = (item: any) => {
    const selected = isSelected(item.hex);
    return (
      <TouchableOpacity
        key={item.hex}
        activeOpacity={0.85}
        onPress={() => setPrimaryColor(item.hex)}
        style={[
          styles.colorCard,
          { backgroundColor: withOpacity(item.hex, "14") },
          selected && {
            borderColor: item.hex,
            shadowColor: item.hex,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        {/* Decorative diagonal stripe */}
        <View style={[styles.stripe, { backgroundColor: item.hex }]} />

        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: item.hex }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.iconWrap}>{renderIcon(item, 22, item.hex)}</View>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- SECTION HEADER ----------
  const renderSectionHeader = (
    icon: any,
    family: string,
    color: string,
    title: string,
  ) => (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionBadge,
          { backgroundColor: withOpacity(color, "1C") },
        ]}
      >
        {family === "mci" ? (
          <MaterialCommunityIcons name={icon} size={13} color={color} />
        ) : (
          <Ionicons name={icon} size={13} color={color} />
        )}
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  // ---------- DECORATIVE CROSS-LINE DIVIDER ----------
  const renderDivider = () => (
    <View style={styles.crossDivider}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerCross}>
        <View style={[styles.crossArm, { transform: [{ rotate: "45deg" }] }]} />
        <View
          style={[styles.crossArm, { transform: [{ rotate: "-45deg" }] }]}
        />
      </View>
      <View style={styles.dividerLine} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Subtle purple top-glow */}
      <LinearGradient
        colors={["#161126", "#0b0a12", "#07070a", "#07070a"]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- HEADER ---------- */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Choose Theme</Text>
            <Text style={styles.headerSubtitle}>
              Select your preferred accent color
            </Text>
          </View>

          <View style={styles.headerArt}>
            <View
              style={[styles.artCard, { transform: [{ rotate: "-14deg" }] }]}
            />
            <View
              style={[
                styles.artCard,
                styles.artCard2,
                { transform: [{ rotate: "-4deg" }] },
              ]}
            />
            <MaterialCommunityIcons
              name="palette"
              size={38}
              color="#2563EB"
              style={styles.artPalette}
            />
            <Ionicons
              name="sparkles"
              size={10}
              color="#7dd3fc"
              style={styles.artSpark1}
            />
            <Ionicons
              name="sparkles"
              size={8}
              color="#7dd3fc"
              style={styles.artSpark2}
            />
          </View>
        </View>

        {renderDivider()}

        {/* ---------- POPULAR PICKS ---------- */}
        {renderSectionHeader("star", "ion", "#3b82f6", "Popular Picks")}
        <View style={styles.rowWrap}>{POPULAR.map(renderColorCard)}</View>

        {renderDivider()}

        {/* ---------- VIBRANT ---------- */}
        {renderSectionHeader("lightning", "ion", "#F59E0B", "Vibrant")}
        <View style={styles.rowWrap}>{VIBRANT.map(renderColorCard)}</View>

        {renderDivider()}

        {/* ---------- SOFT ---------- */}
        {renderSectionHeader("heart", "ion", "#EC4899", "Soft")}
        <View style={styles.rowWrap}>{SOFT.map(renderColorCard)}</View>

        {/* ---------- BOTTOM BANNER ---------- */}
        <View
          style={[
            styles.banner,
            {
              borderColor: withOpacity(primaryColor, "50"),
              backgroundColor: withOpacity(primaryColor, "0A"),
              shadowColor: primaryColor,
            },
          ]}
        >
          <View
            style={[
              styles.bannerIcon,
              {
                borderColor: primaryColor,
                backgroundColor: withOpacity(primaryColor, "18"),
              },
            ]}
          >
            <Ionicons name="brush" size={20} color="#fff" />
          </View>

          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>{selectedName} Theme</Text>
            <Text style={styles.bannerText}>
              Your selected accent color will be used across the application.
            </Text>
          </View>

          <Svg width={110} height={56} style={styles.bannerWave}>
            <Path
              d="M0 36 C 20 16, 38 48, 58 30 S 92 14, 110 28"
              stroke={primaryColor}
              strokeWidth={1.2}
              fill="none"
              opacity={0.7}
            />
            <Path
              d="M0 42 C 20 24, 38 54, 58 38 S 92 22, 110 36"
              stroke={primaryColor}
              strokeWidth={1}
              fill="none"
              opacity={0.4}
            />
            <Path
              d="M0 48 C 20 32, 38 60, 58 46 S 92 32, 110 44"
              stroke={primaryColor}
              strokeWidth={0.8}
              fill="none"
              opacity={0.22}
            />
          </Svg>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070a" },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // ---------- HEADER ----------
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#121218",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e1e26",
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 12, color: "#8b8b93", marginTop: 4 },
  headerArt: { width: 78, height: 64 },
  artCard: {
    position: "absolute",
    width: 48,
    height: 56,
    borderRadius: 9,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#1f2a44",
    top: 0,
    left: 0,
  },
  artCard2: { left: 14, top: 5 },
  artPalette: { position: "absolute", right: -4, bottom: -6 },
  artSpark1: { position: "absolute", top: -2, right: 22 },
  artSpark2: { position: "absolute", top: 14, left: -8 },

  // ---------- CROSS-LINE DIVIDER (centered × ornament) ----------
  crossDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1f1f28",
  },
  dividerCross: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  crossArm: {
    position: "absolute",
    width: 12,
    height: 1.5,
    backgroundColor: "#3a3a46",
    borderRadius: 1,
  },

  // ---------- SECTION HEADERS ----------
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 9,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // ---------- GRID (flex-start with consistent gaps) ----------
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: CARD_GAP,
    marginBottom: 6,
  },

  // ---------- UNIFIED SQUARE COLOR CARD ----------
  colorCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e1e26",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  stripe: {
    position: "absolute",
    top: -20,
    bottom: -20,
    right: -14,
    width: 40,
    transform: [{ skewX: "-20deg" }],
    opacity: 0.85,
  },
  cardContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#fff",
    marginTop: 3,
    textAlign: "center",
    maxWidth: 58,
  },

  // ---------- SELECTED CHECK BADGE ----------
  checkBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },

  // ---------- BOTTOM BANNER ----------
  banner: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 3,
  },
  bannerText: { fontSize: 11, color: "#9aa3af", lineHeight: 16 },
  bannerWave: { position: "absolute", right: 8, bottom: 5 },
});
