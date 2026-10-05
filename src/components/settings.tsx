import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useThemeStore } from "../store/useThemeStore";
import {
  useProfileStore,
  PRESET_AVATARS,
  Profile,
} from "../store/useProfileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function UserSettings({ navigation }: any) {
  const { primaryColor } = useThemeStore();
  const {
    profiles,
    activeProfileId,
    addProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    getActiveProfile,
  } = useProfileStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const activeProfile = getActiveProfile();

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  const openAddModal = () => {
    setEditingProfile(null);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const openEditModal = (profile: Profile) => {
    setEditingProfile(profile);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: SCREEN_WIDTH,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setEditingProfile(null);
    });
  };

  const handleSaveProfile = (data: {
    name: string;
    avatarUri: string;
    isCustom?: boolean;
  }) => {
    if (editingProfile) {
      updateProfile(editingProfile.id, data);
    } else {
      addProfile(data);
    }
    closeModal();
  };

  const handleDeleteProfile = (profile: Profile) => {
    Alert.alert(
      "Delete Profile?",
      `Remove "${profile.name}" from your profiles?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteProfile(profile.id),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Settings</Text>
            <MaterialCommunityIcons
              name="creation"
              size={16}
              color={primaryColor}
              style={styles.sparkleIcon}
            />
          </View>
          <Text style={styles.headerSubtitle}>
            Manage your account and app preferences
          </Text>
        </View>

        {/* Active Profile Card */}
        <View style={styles.profileSection}>
          <View style={styles.sectionHeader}>
            <View style={[styles.redLine, { backgroundColor: primaryColor }]} />
            <Text style={styles.sectionTitle}>ACTIVE PROFILE</Text>
          </View>

          {activeProfile ? (
            <TouchableOpacity
              style={[
                styles.activeProfileCard,
                { borderColor: withOpacity(primaryColor, "33") },
              ]}
              onPress={() => openEditModal(activeProfile)}
              activeOpacity={0.8}
            >
              <View style={styles.profileImageWrapper}>
                <Image
                  source={{ uri: activeProfile.avatarUri }}
                  style={[styles.profileImage, { borderColor: primaryColor }]}
                />
                <View
                  style={[styles.activeDot, { backgroundColor: primaryColor }]}
                />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{activeProfile.name}</Text>
                <View
                  style={[
                    styles.premiumBadge,
                    {
                      backgroundColor: withOpacity(primaryColor, "1A"),
                      borderColor: withOpacity(primaryColor, "4D"),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="diamond-stone"
                    size={12}
                    color={primaryColor}
                  />
                  <Text style={[styles.premiumText, { color: primaryColor }]}>
                    ACTIVE
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.profileArrowBtn}
                onPress={() => openEditModal(activeProfile)}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.noProfileCard}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.noProfileIcon,
                  { borderColor: withOpacity(primaryColor, "40") },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={32}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.noProfileTitle}>No Profile Set</Text>
              <Text style={styles.noProfileSubtitle}>
                Tap to create your first profile
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Appearance */}
        <Section title="APPEARANCE" primaryColor={primaryColor}>
          <SettingItem
            icon={
              <Ionicons
                name="color-palette-outline"
                size={24}
                color={primaryColor}
              />
            }
            iconBg={withOpacity(primaryColor, "1A")}
            title="Theme"
            subtitle="Choose your preferred theme"
            rightElement={
              <View
                style={[styles.themeToggle, { backgroundColor: primaryColor }]}
              >
                <Ionicons name="moon-outline" size={16} color="#fff" />
                <Text style={styles.themeToggleText}>Dark</Text>
              </View>
            }
            onPress={() => navigation.navigate("ThemeSettings")}
          />
        </Section>

        {/* Playback & Download */}
        <Section title="PLAYBACK & DOWNLOAD" primaryColor={primaryColor}>
          <SettingItem
            icon={
              <MaterialCommunityIcons
                name="play-box-outline"
                size={24}
                color="#a855f7"
              />
            }
            iconBg="rgba(168, 85, 247, 0.1)"
            title="Providers"
            subtitle="Choose and manage providers"
            onPress={() => navigation.navigate("Providers")}
          />
          <SettingItem
            icon={
              <Ionicons name="download-outline" size={24} color="#38bdf8" />
            }
            iconBg="rgba(56, 189, 248, 0.1)"
            title="Download Settings"
            subtitle="Manage download quality and storage"
            isLast
          />
        </Section>

        {/* Personalization */}
        <Section title="PERSONALIZATION" primaryColor={primaryColor}>
          <SettingItem
            icon={
              <Ionicons name="heart-outline" size={24} color={primaryColor} />
            }
            iconBg={withOpacity(primaryColor, "1A")}
            title="Watchlist Settings"
            subtitle="Manage your watchlist preferences"
            onPress={() => navigation.navigate("Watchlist")}
          />
          <SettingItem
            icon={
              <MaterialCommunityIcons name="tune" size={24} color="#f97316" />
            }
            iconBg="rgba(249, 115, 22, 0.1)"
            title="Preference Settings"
            subtitle="Content, language and playback preferences"
            isLast
          />
        </Section>

        {/* All Profiles */}
        <View style={styles.profileSection}>
          <View style={styles.sectionHeader}>
            <View style={[styles.redLine, { backgroundColor: primaryColor }]} />
            <Text style={styles.sectionTitle}>
              ALL PROFILES ({profiles.length})
            </Text>
          </View>

          <View style={styles.sectionContent}>
            {profiles.length === 0 ? (
              <View style={styles.emptyProfiles}>
                <Ionicons name="people-outline" size={36} color="#444" />
                <Text style={styles.emptyProfilesText}>No profiles yet</Text>
              </View>
            ) : (
              profiles.map((profile, idx) => {
                const isActive = profile.id === activeProfileId;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.profileListItem,
                      idx === profiles.length - 1 && styles.profileListItemLast,
                      isActive && {
                        backgroundColor: withOpacity(primaryColor, "08"),
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setActiveProfile(profile.id)}
                    onLongPress={() => handleDeleteProfile(profile)}
                  >
                    <Image
                      source={{ uri: profile.avatarUri }}
                      style={styles.profileListImage}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.profileListName}>{profile.name}</Text>
                      {isActive && (
                        <Text
                          style={[
                            styles.profileListActive,
                            { color: primaryColor },
                          ]}
                        >
                          Currently Active
                        </Text>
                      )}
                    </View>
                    {isActive ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={primaryColor}
                      />
                    ) : (
                      <TouchableOpacity onPress={() => openEditModal(profile)}>
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {/* Add Profile Button */}
            <TouchableOpacity
              style={styles.addProfileButton}
              onPress={openAddModal}
            >
              <Ionicons name="add-circle" size={22} color={primaryColor} />
              <Text style={[styles.addProfileText, { color: primaryColor }]}>
                Add New Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <Section title="ACCOUNT" primaryColor={primaryColor}>
          <SettingItem
            icon={<Ionicons name="log-out-outline" size={24} color="#ef4444" />}
            iconBg="rgba(239, 68, 68, 0.1)"
            title="Logout"
            subtitle="Sign out of your account"
            titleColor="#ef4444"
            isLast
          />
        </Section>
      </ScrollView>

      {/* Add/Edit Profile Modal */}
      <AddEditProfileModal
        visible={modalVisible}
        onClose={closeModal}
        onSave={handleSaveProfile}
        profile={editingProfile}
        primaryColor={primaryColor}
        fadeAnim={fadeAnim}
        slideAnim={slideAnim}
      />
    </View>
  );
}

/* ================= Add/Edit Profile Modal ================= */
function AddEditProfileModal({
  visible,
  onClose,
  onSave,
  profile,
  primaryColor,
  fadeAnim,
  slideAnim,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    avatarUri: string;
    isCustom?: boolean;
  }) => void;
  profile: Profile | null;
  primaryColor: string;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
}) {
  const [selectedAvatar, setSelectedAvatar] = useState(
    profile?.avatarUri || PRESET_AVATARS[0],
  );
  const [name, setName] = useState(profile?.name || "");
  const [isCustom, setIsCustom] = useState(profile?.isCustom || false);

  React.useEffect(() => {
    if (visible) {
      setSelectedAvatar(profile?.avatarUri || PRESET_AVATARS[0]);
      setName(profile?.name || "");
      setIsCustom(profile?.isCustom || false);
    }
  }, [visible, profile]);

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Needed",
        "Please allow photo access to upload your picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedAvatar(result.assets[0].uri);
      setIsCustom(true);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Needed", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedAvatar(result.assets[0].uri);
      setIsCustom(true);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a name for this profile.");
      return;
    }
    onSave({ name: name.trim(), avatarUri: selectedAvatar, isCustom });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[styles.modalBackdrop, { opacity: fadeAnim }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateX: slideAnim }],
              borderColor: withOpacity(primaryColor, "30"),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {profile ? "Edit Profile" : "New Profile"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Avatar Preview */}
          <View style={styles.avatarPreviewWrap}>
            <Image
              source={{ uri: selectedAvatar }}
              style={styles.avatarPreview}
            />
            <View style={styles.avatarPreviewGlow}>
              <View
                style={[styles.avatarGlowRing, { borderColor: primaryColor }]}
              />
            </View>
          </View>

          {/* Upload Buttons */}
          <View style={styles.uploadRow}>
            <TouchableOpacity
              style={[styles.uploadBtn, { borderColor: primaryColor }]}
              onPress={pickImage}
            >
              <Ionicons name="images-outline" size={18} color={primaryColor} />
              <Text style={[styles.uploadBtnText, { color: primaryColor }]}>
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadBtn, { borderColor: primaryColor }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera-outline" size={18} color={primaryColor} />
              <Text style={[styles.uploadBtnText, { color: primaryColor }]}>
                Camera
              </Text>
            </TouchableOpacity>
          </View>

          {/* Preset Avatars */}
          <Text style={styles.presetTitle}>Or choose an avatar</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScroll}
          >
            {PRESET_AVATARS.map((url, idx) => {
              const isSelected = selectedAvatar === url;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setSelectedAvatar(url);
                    setIsCustom(false);
                  }}
                  style={[
                    styles.presetAvatar,
                    isSelected && {
                      borderColor: primaryColor,
                      transform: [{ scale: 1.1 }],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.presetAvatarImage}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Name Input */}
          <View style={styles.nameInputWrap}>
            <Ionicons name="person-outline" size={20} color="#888" />
            <TextInput
              style={styles.nameInput}
              placeholder="Profile name"
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoCapitalize="words"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primaryColor }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>
              {profile ? "Update Profile" : "Create Profile"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/* ================= Reusable Components ================= */
function Section({ title, children, primaryColor }: any) {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={[styles.redLine, { backgroundColor: primaryColor }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <MaterialCommunityIcons
          name="creation"
          size={12}
          color="#555"
          style={{ marginLeft: 4 }}
        />
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingItem({
  icon,
  iconBg,
  title,
  subtitle,
  rightElement,
  titleColor = "#fff",
  isLast = false,
  onPress,
}: any) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, isLast && styles.settingItemLast]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.settingTitle, { color: titleColor }]}>
            {title}
          </Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightElement ? (
        <View style={styles.settingRight}>
          {rightElement}
          <Ionicons name="chevron-forward" size={20} color="#555" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#555" />
      )}
    </TouchableOpacity>
  );
}

/* ================= Styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  scrollContent: { paddingBottom: 60 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  sparkleIcon: { marginLeft: 4, marginBottom: -10 },
  headerSubtitle: { fontSize: 14, color: "#888", marginTop: 4 },

  // Profile Section
  profileSection: { marginTop: 8, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingLeft: 4,
  },
  redLine: { width: 3, height: 14, borderRadius: 2, marginRight: 8 },
  sectionTitle: {
    fontSize: 12,
    color: "#888",
    fontWeight: "700",
    letterSpacing: 1,
  },

  activeProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  profileImageWrapper: { position: "relative", marginRight: 16 },
  profileImage: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  activeDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#0a0a0a",
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  premiumText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  profileArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },

  noProfileCard: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#0a0a0a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderStyle: "dashed",
  },
  noProfileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noProfileTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  noProfileSubtitle: { fontSize: 13, color: "#888" },

  // Sections
  sectionContainer: { marginTop: 28, paddingHorizontal: 16 },
  sectionContent: {
    backgroundColor: "#0a0a0a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    overflow: "hidden",
  },

  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  settingItemLast: { borderBottomWidth: 0 },
  settingLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textContainer: { flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  settingSubtitle: { fontSize: 13, color: "#888" },
  settingRight: { flexDirection: "row", alignItems: "center" },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  themeToggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },

  // Profile List
  emptyProfiles: { alignItems: "center", padding: 28, gap: 8 },
  emptyProfilesText: { color: "#666", fontSize: 13 },
  profileListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  profileListItemLast: { borderBottomWidth: 0 },
  profileListImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1a1a1a",
  },
  profileListName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  profileListActive: { fontSize: 11, fontWeight: "700" },

  addProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  addProfileText: { fontSize: 15, fontWeight: "700" },

  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },

  avatarPreviewWrap: {
    alignItems: "center",
    marginBottom: 18,
    position: "relative",
  },
  avatarPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1a1a1a",
  },
  avatarPreviewGlow: {
    position: "absolute",
    top: -6,
    left: "50%",
    marginLeft: -61,
    width: 122,
    height: 122,
  },
  avatarGlowRing: { width: 122, height: 122, borderRadius: 61, borderWidth: 2 },

  uploadRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  uploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  uploadBtnText: { fontSize: 14, fontWeight: "700" },

  presetTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  presetScroll: { paddingHorizontal: 4, paddingBottom: 8, gap: 10 },
  presetAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  presetAvatarImage: { width: "100%", height: "100%" },

  nameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 16,
  },
  nameInput: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
