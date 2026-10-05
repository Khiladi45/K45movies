import React from "react";
import {
  Image,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

// 👇 Import your theme store (adjust the path if your store is located elsewhere)
import { useThemeStore } from "@/store/useThemeStore";

import HomeStack from "../Home/homeStack";
import GlobalSearch from "@/components/search";
import AddProviders from "@/components/providersAdd";
import Watchlist from "@/components/watchlist";
import UserSettings from "@/components/settings";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Tab = createBottomTabNavigator();

const CURVE_HEIGHT = 20;
const BAR_HEIGHT = 60;
const GLOW_SIZE = 110;

function CurvedTabBar({ state, navigation, descriptors, insets }: any) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const bottomInset = insets?.bottom ?? safe.bottom;
  const barHeight = BAR_HEIGHT + bottomInset;

  // 👇 Get the dynamic theme color from Zustand
  const { primaryColor } = useThemeStore();

  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;
  const activeX = state.index * tabWidth + tabWidth / 2;
  const midX = SCREEN_WIDTH / 2;

  const curve = `M 0 ${CURVE_HEIGHT} Q ${midX} 0 ${SCREEN_WIDTH} ${CURVE_HEIGHT}`;
  const totalSvgHeight = barHeight + CURVE_HEIGHT;
  const body = `${curve} L ${SCREEN_WIDTH} ${totalSvgHeight} L 0 ${totalSvgHeight} Z`;

  return (
    <View style={[styles.barRoot, { height: barHeight }]}>
      <Svg
        width={SCREEN_WIDTH}
        height={totalSvgHeight}
        style={{ position: "absolute", top: -CURVE_HEIGHT, left: 0 }}
      >
        <Defs>
          <LinearGradient
            id="active-glow"
            gradientUnits="userSpaceOnUse"
            x1={activeX - 120}
            y1="0"
            x2={activeX + 120}
            y2="0"
          >
            {/* 👇 Dynamic theme color for the curve glow */}
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0" />
            <Stop offset="50%" stopColor={primaryColor} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={body} fill="#06090f" />
        <Path d={curve} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
        <Path
          d={curve}
          fill="none"
          stroke="url(#active-glow)"
          strokeWidth="3"
        />
        <Path
          d={curve}
          fill="none"
          stroke="url(#active-glow)"
          strokeWidth="8"
          strokeOpacity="0.25"
        />
      </Svg>

      <View
        style={[styles.row, { height: barHeight, paddingBottom: bottomInset }]}
      >
        {state.routes.map((route: any, index: any) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              LayoutAnimation.easeInEaseOut();
              navigation.navigate(route.name, undefined, { merge: true });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              <View style={styles.iconWrap}>
                {focused && (
                  <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
                    <Defs>
                      <RadialGradient id={`glow-${route.key}`}>
                        {/* 👇 Dynamic theme color for the icon background glow */}
                        <Stop
                          offset="0%"
                          stopColor={primaryColor}
                          stopOpacity="0.45"
                        />
                        <Stop
                          offset="60%"
                          stopColor={primaryColor}
                          stopOpacity="0.15"
                        />
                        <Stop
                          offset="100%"
                          stopColor={primaryColor}
                          stopOpacity="0"
                        />
                      </RadialGradient>
                    </Defs>
                    <Rect
                      width={GLOW_SIZE}
                      height={GLOW_SIZE}
                      fill={`url(#glow-${route.key})`}
                    />
                  </Svg>
                )}
                <View style={styles.iconCenter}>
                  {options.tabBarIcon?.({
                    focused,
                    // 👇 Dynamic theme color for the active icon
                    color: focused ? "#ECEDEE" : "#8b93a0",
                    size: 23,
                  })}
                </View>
              </View>

              {focused && (
                // 👇 Dynamic theme color for the active label text
                <Text style={[styles.label, { color: "#ECEDEE" }]}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function BottomTabs() {
  // 👇 Get theme color here too, for the Profile image border
  const { primaryColor } = useThemeStore();

  return (
    <View style={{ flex: 1, backgroundColor: "#000", overflow: "hidden" }}>
      <Tab.Navigator
        tabBar={(props) => <CurvedTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        initialRouteName="HomeTab"
      >
        <Tab.Screen
          name="Providers"
          component={AddProviders}
          options={{
            title: "Providers",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="extension-puzzle-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={GlobalSearch}
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" color={color} size={size} />
            ),
          }}
        />

        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Watchlist"
          component={Watchlist}
          options={{
            title: "Watchlist",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bag-add-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={UserSettings}
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) => (
              <Image
                source={{ uri: "https://i.pravatar.cc/75" }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  opacity: focused ? 1 : 0.55,
                  borderWidth: focused ? 2 : 0,
                  // 👇 Dynamic theme color for the profile border
                  borderColor: primaryColor,
                }}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  barRoot: { overflow: "visible", backgroundColor: "transparent" },
  row: { flexDirection: "row", overflow: "visible" },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  iconWrap: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    marginTop: -(GLOW_SIZE - 60) / 2,
    marginBottom: -(GLOW_SIZE - 60) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: -15,
    marginBottom: 10,
  },
});
