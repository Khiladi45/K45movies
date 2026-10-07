import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  memo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useCatalog, usePosts } from "@/hooks/useProvider";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useProviderStore } from "@/store/useProviderStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import ContinueWatching from "@/Home/components/ContinueWatching";
import Skeleton from "@/components/Skeleton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 34;
const CARD_HEIGHT = 430;
const CARD_SPACING = 16;
const CARD_STEP = CARD_WIDTH + CARD_SPACING;

// ✅ FIX 1: Create an Animated version of FlatList to support native driver scroll events
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function HomeScreen({ navigation }: any) {
  const activeProvider = useProviderStore((state) => state.activeProvider);
  const {
    data: catalogs,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCatalog(activeProvider);

  // Catalogs without a filter/id can never fetch posts (usePosts stays
  // disabled), which left their skeleton on screen forever.
  const validCatalogs = useMemo(
    () => (catalogs || []).filter((c: any) => c.filter || c.id),
    [catalogs],
  );

  const carouselCategories = validCatalogs.slice(0, 4);

  const { data: cat1Posts, isLoading: cat1Loading } = usePosts(
    activeProvider,
    carouselCategories[0]?.filter || carouselCategories[0]?.id,
  );
  const { data: cat2Posts, isLoading: cat2Loading } = usePosts(
    activeProvider,
    carouselCategories[1]?.filter || carouselCategories[1]?.id,
  );
  const { data: cat3Posts, isLoading: cat3Loading } = usePosts(
    activeProvider,
    carouselCategories[2]?.filter || carouselCategories[2]?.id,
  );
  const { data: cat4Posts, isLoading: cat4Loading } = usePosts(
    activeProvider,
    carouselCategories[3]?.filter || carouselCategories[3]?.id,
  );
  const isCarouselLoading =
    cat1Loading || cat2Loading || cat3Loading || cat4Loading;

  const carouselItems = useMemo(() => {
    const mixed: any[] = [];
    const seen = new Set<string>();
    const maxItems = 2;

    const allCategories = [
      {
        posts: cat1Posts || [],
        title: carouselCategories[0]?.title || "New Release",
      },
      {
        posts: cat2Posts || [],
        title: carouselCategories[1]?.title || "Trending",
      },
      {
        posts: cat3Posts || [],
        title: carouselCategories[2]?.title || "Popular",
      },
      {
        posts: cat4Posts || [],
        title: carouselCategories[3]?.title || "Featured",
      },
    ];

    for (let i = 0; i < maxItems; i++) {
      allCategories.forEach((cat) => {
        if (cat.posts[i] && !seen.has(cat.posts[i].link)) {
          seen.add(cat.posts[i].link);
          mixed.push({
            ...cat.posts[i],
            categoryTitle: cat.title,
            uniqueKey: `${cat.posts[i].link}-${cat.title}-${i}`,
          });
        }
      });
    }

    return mixed.slice(0, 8);
  }, [cat1Posts, cat2Posts, cat3Posts, cat4Posts, catalogs]);

  if (isCatalogLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CarouselSkeleton />
        <CategorySkeleton />
        <CategorySkeleton />
        <CategorySkeleton />
      </View>
    );
  }

  if (catalogError) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-4">
        <Text className="text-white text-center">
          Failed to load from provider. Check your connection, then reinstall
          the provider from the Providers screen.
        </Text>
        <Text className="text-gray-400 text-center text-xs mt-3">
          {(catalogError as any)?.message || String(catalogError)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        data={validCatalogs}
        ListHeaderComponent={
          <>
            {carouselItems.length > 0 ? (
              <HotstarCarousel
                items={carouselItems}
                navigation={navigation}
                providerId={activeProvider}
              />
            ) : isCarouselLoading ? (
              <CarouselSkeleton />
            ) : null}
            <ContinueWatching navigation={navigation} />
          </>
        }
        renderItem={({ item }) => (
          <CategorySection category={item} navigation={navigation} />
        )}
        keyExtractor={keyExtractor}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
}

const keyExtractor = (item: any) => String(item.id || item.title);

function CarouselSkeleton() {
  return (
    <View style={styles.carouselWrapper}>
      <Skeleton style={styles.carouselCard} />
    </View>
  );
}

function CategorySkeleton() {
  return (
    <View style={{ marginBottom: 24, marginLeft: 16, marginRight: 16 }}>
      <Skeleton
        style={{ width: 130, height: 18, borderRadius: 4, marginBottom: 14 }}
      />
      <View style={{ flexDirection: "row", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 128 }}>
            <Skeleton style={{ width: 128, height: 192, borderRadius: 8 }} />
            <Skeleton
              style={{ width: 96, height: 12, borderRadius: 4, marginTop: 8 }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ✅ Premium spring-scale button wrapper
function ScaleButton({ onPress, children, style }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.85,
      friction: 6,
      useNativeDriver: true,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

const HotstarCarousel = memo(function HotstarCarousel({
  items,
  navigation,
  providerId,
}: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // ✅ FIX 2: Use `any` for the ref to avoid TS conflicts with AnimatedFlatList
  const flatListRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const toggleWatchlist = useWatchlistStore((state) => state.toggleWatchlist);
  const movies = useWatchlistStore((state) => state.movies);

  const isInWatchlist = (link: string) => movies.some((m) => m.link === link);

  const handleAddToWatchlist = (item: any) => {
    toggleWatchlist({
      link: item.link,
      title: item.title,
      image: item.image,
      providerId: providerId,
      type: item.type,
    });
  };

  useEffect(() => {
    if (isPaused || items.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % items.length;
      const offset = nextIndex * CARD_STEP;

      // ✅ FIX 3: Safely call scrollToOffset on the AnimatedFlatList
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset, animated: true });
      }
      setCurrentIndex(nextIndex);
    }, 8000);

    return () => clearInterval(interval);
  }, [currentIndex, items.length, isPaused]);

  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / CARD_STEP);
    if (index !== currentIndex && index >= 0 && index < items.length) {
      setCurrentIndex(index);
    }
  };

  // ✅ Native-driver animated scroll for buttery smooth card scaling
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true, listener: handleScroll },
  );

  const handlePlay = (item: any) => {
    navigation.navigate("Detail", {
      movie: item,
      providerId: providerId,
    });
  };

  return (
    <View style={styles.carouselWrapper}>
      {/* ✅ FIX 4: Use AnimatedFlatList instead of standard FlatList */}
      <AnimatedFlatList
        ref={flatListRef}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STEP}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollBegin={() => setIsPaused(true)}
        onMomentumScrollEnd={() => setIsPaused(false)}
        contentContainerStyle={styles.carouselContent}
        keyExtractor={(item: any) => item.uniqueKey || item.link}
        getItemLayout={(data: any, index: number) => ({
          length: CARD_STEP,
          offset: CARD_STEP * index,
          index,
        })}
        renderItem={({ item, index }: { item: any; index: number }) => {
          // Scroll-driven smooth scale + dim (runs at 60fps on native thread)
          const inputRange = [
            (index - 1) * CARD_STEP,
            index * CARD_STEP,
            (index + 1) * CARD_STEP,
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.92, 1, 0.92],
            extrapolate: "clamp",
          });

          const dimOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.35, 0, 0.35],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              style={[styles.carouselCard, { transform: [{ scale }] }]}
            >
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => handlePlay(item)}
                style={{ width: "100%", height: "100%" }}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={250}
                />

                <LinearGradient
                  colors={[
                    "rgba(0,0,0,0)",
                    "rgba(0,0,0,0.2)",
                    "rgba(0,0,0,0.75)",
                    "rgba(0,0,0,0.99)",
                  ]}
                  locations={[0, 0.5, 0.8, 1]}
                  style={styles.gradientOverlay}
                />

                <Animated.View
                  style={[styles.dimOverlay, { opacity: dimOpacity }]}
                  pointerEvents="none"
                />

                <View style={styles.topBadge}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={styles.topBadgeText}>{item.categoryTitle}</Text>
                </View>

                <View style={styles.bottomContent}>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataText}>2024</Text>
                      <Text style={styles.metadataDot}>•</Text>
                      <Text style={styles.metadataText}>HD</Text>
                      <Text style={styles.metadataDot}>•</Text>
                      <Text style={styles.metadataText}>Action</Text>
                    </View>
                  </View>

                  <View style={styles.rightButtonsColumn}>
                    <ScaleButton
                      onPress={() => handleAddToWatchlist(item)}
                      style={[
                        styles.watchlistCircleButton,
                        isInWatchlist(item.link) &&
                          styles.watchlistCircleButtonActive,
                      ]}
                    >
                      <Ionicons
                        name={isInWatchlist(item.link) ? "checkmark" : "add"}
                        size={22}
                        color="#fff"
                      />
                    </ScaleButton>

                    <ScaleButton
                      onPress={() => handlePlay(item)}
                      style={styles.playCircleButton}
                    >
                      <LinearGradient
                        colors={["#ffffff", "#e8e8e8", "#b5b5b5"]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.playGradient}
                      >
                        <Ionicons name="play" size={18} color="#000" />
                      </LinearGradient>
                    </ScaleButton>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />
    </View>
  );
});

const CategorySection = memo(function CategorySection({
  category,
  navigation,
}: any) {
  const activeProvider = useProviderStore((state) => state.activeProvider);
  const { primaryColor } = useThemeStore();

  const { data: posts, isLoading, isError } = usePosts(
    activeProvider,
    category.filter || category.id,
  );

  if (isError) return null;
  if (isLoading || !posts) return <CategorySkeleton />;
  if (posts.length === 0) return null;

  return (
    <View style={{ marginBottom: 24, marginLeft: 16, marginRight: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          className="mb-3"
          style={{
            width: 4,
            height: 18,
            borderRadius: 2,
            backgroundColor: primaryColor,
          }}
        />
        <Text className="text-white text-xl font-bold mb-3">
          {category.title}
        </Text>
      </View>
      <FlatList
        data={posts}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: any, index: number) =>
          item.link || index.toString()
        }
        decelerationRate="fast"
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ width: 128 }}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("Detail", {
                movie: item,
                providerId: activeProvider,
              })
            }
          >
            <Image
              source={{ uri: item.image }}
              style={{
                width: 128,
                height: 192,
                borderRadius: 10,
                backgroundColor: "#111",
              }}
              contentFit="cover"
              transition={200}
            />
            <Text className="text-white text-sm mt-2" numberOfLines={2}>
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  carouselWrapper: {
    height: CARD_HEIGHT + 40,
    marginBottom: 20,
  },
  carouselContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  carouselCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: CARD_SPACING,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#111",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  topBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    gap: 6,
  },
  topBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    lineHeight: 34,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metadataText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metadataDot: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginHorizontal: 6,
  },
  rightButtonsColumn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },
  watchlistCircleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(42, 42, 42, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  watchlistCircleButtonActive: {
    backgroundColor: "#10b981", // Green when in watchlist
    borderColor: "#10b981",
  },
  playCircleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  playGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
